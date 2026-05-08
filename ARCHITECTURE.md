# PMS Agent V2 Architecture

Long-term architectural invariants. Behavioral constraints and working conventions live in [AGENTS.md](./AGENTS.md). Historical rationale is in [docs/ARCHITECTURE_CONSTRAINTS.md](./docs/ARCHITECTURE_CONSTRAINTS.md).

## Five-Plane Model

Every package belongs to one primary plane. Dependencies flow downward — upper planes depend on lower planes, never the reverse.

```
Agent  ──→  Capability/Policy  ──→  Executor
  │                                    │
  └──────────→  Fact Source  ←─────────┘
                    │
              Audit/Eval  (observes all)
```

| Plane | Package | Owns | Must Not Own |
|-------|---------|------|-------------|
| **Agent** | `unified-agent` | LLM understanding, tool planning, response drafting | Raw permission, PMS truth, final mutation |
| **Capability/Policy** | `safety-gateway` | Capability registry, risk class, constraints, approval rules | Business facts, executor side effects |
| **Fact Source** | `pms-platform-client` | PMS evidence — availability, reservations, workflow state | Prompt memory, Agent transcript truth |
| **Executor** | `gated-tools`, `workspace-tools` | Constrained PMS, file, bash, sandbox execution | Policy decisions |
| **Audit/Eval** | `evals`, `adapter-contracts` | Type contracts, traceability, regression proof, safety validation | Runtime authorization |

`adapter-contracts` has zero internal dependencies — it defines the shared vocabulary (`FeishuTurnInput`, `AgentResult`, `PmsApprovalCard`).

## Package Dependency Graph

```
adapter-contracts        (zero deps)
gated-tools              (zero deps)
pms-platform-client      (zero deps)
safety-gateway           (zero deps)
workspace-core           (zero deps)

unified-agent       → adapter-contracts, gated-tools, pms-platform-client
workspace-tools     → gated-tools, workspace-core
evals               → all packages + agent-service

agent-service       → all packages + @mariozechner/pi-coding-agent (external)
```

**Enforced by `scripts/boundary-guard.mjs`** — these directions are forbidden:

| Forbidden |
|----------|
| `pms-platform-client` → `unified-agent` |
| `safety-gateway` → `pms-platform-client` |
| `safety-gateway` → `gated-tools` |
| `adapter-contracts` → `agent-service` |
| `workspace-core` → `safety-gateway` |

## Customer Turn — Full Data Flow

```
FeishuTurnInput
  │
  ▼
runAgentTurn()                              [session.ts]
  │
  ├─ rememberTurn()                         [continuity.ts]
  ├─ promptAssistantText(piSession)         [pi-io.ts] → Pi LLM
  │
  ├─ runAssistantToolPlan()                 [session.ts]
  │   ├─ parseAssistantToolPlanJson()       [pi-io.ts]
  │   │
  │   ├─ [call_tool]
  │   │   └─ executeToolPlan()              [tool-plan.ts]
  │   │       └─ tool.execute()
  │   │           └─ runGatedTool()          [gated-tools]
  │   │               ├─ gateway.decide()    [safety-gateway]
  │   │               ├─ executor()          [executors.ts]
  │   │               │   └─ pmsPlatformClient   [pms-platform-client]
  │   │               └─ gateway.audit()     [safety-gateway]
  │   │
  │   └─ [bounded_read_then_workflow]
  │       └─ executeBoundedReadThenWorkflowPlan()
  │           ├─ executeToolPlan(read)       → PMS evidence
  │           ├─ selectRoomCandidates()      [room-selection.ts]
  │           └─ executeToolPlan(workflow)   → prepare confirm
  │
  ├─ [LLM unavailable only]
  │   └─ runPostLlmSafetyScaffoldFallback()  [session.ts]
  │       └─ runCustomerPmsLoop()            [customer-loop.ts]
  │
  └─ synthesizeTextReply()                  [response-synthesis.ts]
      │
      ▼
AgentResult  (text | approval_card | refusal)
```

## Safety Gateway — The Only Execution Boundary

```
GatedToolRequest → gateway.decide() → GatedDecision
                                           │
                                     [if allow]
                                           ▼
                                     executor(request)
                                           │
                                     gateway.audit()
                                           │
                                           ▼
                                     GatedToolResult<T>
```

Every tool call flows through this gate. No code path may call an executor directly.

**Tool visibility by profile** (`capability-registry.ts`):

| Profile | Visible Tools |
|---------|--------------|
| `customer_pms` | `gated_pms_read`, `gated_pms_workflow`, `gated_pms_confirm` |
| `admin_customization` | `gated_proposal_read`, `gated_proposal_write`, `gated_proposal_edit` |

## Pi SDK Boundary

`@mariozechner/pi-coding-agent` owns LLM inference, tool-call parsing, message history. Our code owns everything around it:

```
Our code                          Pi SDK
─────────                        ──────
System prompt (ResourceLoader) → LLM context
PiToolDefinition[]              → Tool manifest
turnPrompt(text)                → LLM inference
                                ← assistant text
PiToolResult.details (opaque)   ← raw tool output
```

Three casts at `apps/agent-service/src/runtime.ts:160-170` exist because `PiCreateAgentSession` parameter types have structural mismatches with our `GatedTool` types. This is a known type-impedance item — the fix is explicit adapter functions, not stronger casts.

## Workspace Zones

| Kind | Access | Read | Write | Bash | Who |
|------|--------|------|-------|------|-----|
| `proposal` | Ephemeral draft | ✅ | ✅ | ❌ | staff/admin |
| `sandbox` | Isolated execution | ✅ | ❌ | ✅ (allowlist) | admin/internal |
| `tenant_workspace` | Persistent scoped | ✅ | ✅ | ❌ | staff/admin |

Nine zone types: `metadata`, `active_skills`, `active_policies`, `proposals`, `sessions`, `memory_advisory`, `evals`, `audit`, `tmp`. Path traversal outside the declared workspace root is blocked by `safeProposalPath()`.

## Test & Eval Layout

```
tests/
  unified-agent.core.test.ts          — turn orchestration, fallback chain
  unified-agent.pms-workflow.test.ts  — PMS booking workflows
  unified-agent.events-control.test.ts — event emission, control plane
  unified-agent.helpers.ts            — shared test fixtures
  ... (20 files, 172 tests)

packages/evals/src/
  index.ts       — types, runner, CLI (148 lines)
  eval-cases.ts  — 19 eval functions across 12 categories (557 lines)
```

Eval categories: grounding, prepare-confirm, natural-confirm, sandbox, skill-proposal, prompt-injection, profile-boundary, session-continuity, intent-clarification, context-advisory, tool-planning, response-synthesis.

## Invariants

1. **Acyclic graph**. No circular imports. Enforced by boundary guard.
2. **Safety Gateway is the only execution path**. No direct Agent-to-executor call.
3. **PMS truth from pms-platform only**. No synthetic PMS evidence in production code.
4. **LLM-first**. Every turn reaches the LLM before any deterministic fallback. The fallback fires only when `llmFailed || !assistantText.trim()` — LLM genuinely unavailable.
5. **Planes don't leak**. Each package's imports stay within its plane's allowed direction.
6. **No `as Partial<T>`**. Type guards use `Record<string, unknown>`. The honest type for unvalidated objects.
7. **<350 line ceiling**. Source files exceeding this extract an owner-bound module — move code, don't redesign.
8. **Gate before done**. `pnpm build && pnpm test` (172+ tests, boundary guard, 19/19 evals) must pass.
