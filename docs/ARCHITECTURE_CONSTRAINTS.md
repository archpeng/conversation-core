# Architecture And AI-Readability Constraints

Status: active SSOT
Date: 2026-05-06
Scope: `pms-agent-v2`

## 0. Purpose

This document turns two accepted strengths into long-term constraints:

1. **Architecture clarity / iterability: 8/10** — package boundaries are mostly correct; Safety Gateway, PMS evidence, gated tools, and Agent runtime are separated enough to evolve safely.
2. **AI readability: 8/10** — package names, tests, and root docs make the project understandable to human and AI maintainers; remaining confusion comes from small runtime/scripted-loop mixing.

The goal is not to freeze the MVP. The goal is to make future changes preserve the same cognitive shape while the Agent becomes stronger.

## 1. Current Positive Baseline

### 1.1 Architecture clarity baseline

Current stable architecture:

```text
adapter-feishu
  -> apps/agent-service
  -> packages/unified-agent
  -> packages/gated-tools
  -> packages/safety-gateway
  -> packages/pms-platform-client
  -> pms-platform
```

Current plane split:

| Plane | Current package/surface | Owns | Must not own |
| --- | --- | --- | --- |
| External contract | `packages/adapter-contracts` | `FeishuTurnInput`, `AgentResult`, approval-card shape | runtime internals, Safety decisions, PMS payload shape beyond output refs |
| Service boundary | `apps/agent-service` | HTTP routes, auth, session cache, runtime wiring | policy logic, PMS business truth, raw Agent tools |
| Agent runtime | `packages/unified-agent` | pi session, profile selection, prompt, gated tool registration, turn orchestration | permission decisions, raw executors, PMS mutation authority |
| Tool gateway | `packages/gated-tools` | one runner shape, tool request envelope, executor ordering | policy semantics, business facts |
| Policy | `packages/safety-gateway` | capability registry, risk, constraints, allow/deny/approval decision, redacted audit summary | executor side effects, PMS facts |
| PMS fact source | `packages/pms-platform-client` | typed PMS HTTP calls, validation, evidence envelopes | prompt memory, profile policy, final Agent replies |
| Regression proof | `packages/evals`, `tests` | boundary proof and safety regression checks | runtime authorization |

Why this is good:

1. A future change usually has one dominant owner package.
2. High-risk invariants can be tested close to their owner.
3. AI maintainers can infer intent from package names before reading implementation.
4. Stronger Agent behavior can be added without giving the Agent raw executors.
5. PMS facts are already modeled as evidence rather than prose memory.

### 1.2 AI-readability baseline

Current AI-readable strengths:

1. Root docs state non-negotiable laws early.
2. Package names are domain-specific, not generic platform abstractions.
3. Tests encode architecture intent, not only happy paths.
4. `AgentResult` and `FeishuTurnInput` are small enough for AI to reason over.
5. The repo has explicit plan/workset truth under `docs/plan/`.
6. Negative tests reject legacy response shapes, unsafe tools, profile escalation, natural-language mutation, and uncited PMS facts.

Remaining readability risk:

```text
packages/unified-agent currently mixes pi-coding-agent runtime wiring with deterministic MVP loops.
```

This is acceptable for MVP if it stays explicitly bounded. It becomes harmful if future work hides more product workflow logic in ad-hoc regex loops instead of typed Agent/tool contracts.

## 2. Global Architecture Laws

These laws are mandatory for all future implementation slices.

### A0. One execution boundary

All tool/executor side effects must follow:

```text
Agent intent
  -> gated tool definition
  -> runGatedTool / workspace equivalent
  -> Safety Gateway decision
  -> audit event
  -> constrained executor
```

Forbidden:

```text
Agent -> raw read/write/edit/bash/http/PMS executor
Agent -> Safety Gateway optional call
executor -> invents policy after it already performed side effects
```

### A1. Five-plane separation

Never collapse these into one module:

1. Agent understanding/planning.
2. Capability/policy decision.
3. PMS fact source.
4. Executor side effect.
5. Audit/eval proof.

If a change edits three or more planes, it must be split or explicitly justified in the plan/workset.

### A2. PMS truth authority

Authoritative current PMS facts are only:

```text
PmsEvidence.source.system === "pms-platform"
```

Workspace memory, session state, skills, prompts, persona files, Feishu text, and LLM prior knowledge are advisory only.

Forbidden user-visible claims without PMS evidence:

```text
availability count
room clean/dirty state
price
reservation status
payment/order state
pending action validity
inventory/stock state
```

### A3. Proposal/approval before high-risk side effects

Natural language must not execute:

```text
reservation confirm
cancel order
price change
room state change
skill publish
active policy/config write
generated code execution
external HTTP side effect
```

Allowed result classes:

```text
approval_card
proposal
refusal
text with evidenceRefs when PMS facts are present
```

### A4. No legacy compatibility in this repo

Forbidden runtime goals:

```text
old ai-conversation response compatibility
body.replies[] output
ai-pms fallback
pi-agent-core hot path
V1/V2 dual route
compatibility shim that keeps old and new runtime paths alive
```

Reference-only use in docs/tests is allowed when the text is clearly a negative fixture or historical note.

### A5. Small typed contracts over generic frameworks

Prefer:

```text
FeishuTurnInput
AgentResult
PmsEvidence<T>
ToolRequest
SafetyDecision
WorkspaceToolRequest
```

Avoid generic layers unless a current test proves they are needed:

```text
generic channel framework
generic plugin system
generic HTTP broker
generic memory graph
generic workflow engine
multi-agent supervisor
```

## 3. Package Ownership Constraints

### 3.1 Allowed responsibilities

| Package | Allowed to add | Must not add |
| --- | --- | --- |
| `adapter-contracts` | stable external DTOs, validation helpers, negative legacy-shape tests | service runtime, PMS client calls, policy logic |
| `agent-service` | routes, request validation, auth, session cache, runtime dependency wiring | business decisions, raw executor exposure, policy shortcuts |
| `unified-agent` | pi session lifecycle, profile selection, prompt assembly, gated tool registration, turn-level orchestration | Safety decisions, raw file/PMS/bash/http execution, persistent workspace store |
| `gated-tools` | capability-specific request wrappers, one gated runner, public tool result shaping | path security policy, PMS parsing, Agent prompt logic |
| `safety-gateway` | capability registry, risk taxonomy, constraints, decision, redacted audit | filesystem writes, PMS HTTP calls, LLM calls |
| `pms-platform-client` | typed PMS endpoint mapping, input/output schemas, evidence envelope creation | user conversation logic, policy decisions, workspace memory |
| `workspace-core` | tenant workspace path/schema/store primitives when W1 executes | actor/profile policy, Agent prompt injection |
| `workspace-tools` | Safety-gated workspace tool adapters when W2 executes | active promotion workflow, Context Builder, raw filesystem bypass |
| `evals` | high-risk fixture suite and CLI regression proof | production authorization or side effects |

### 3.2 Dependency direction

Preferred direction:

```text
agent-service
  -> adapter-contracts
  -> unified-agent
  -> gated-tools
  -> safety-gateway
  -> pms-platform-client
```

Allowed cross-links:

1. `unified-agent` may import `adapter-contracts`, `gated-tools`, `pms-platform-client` types.
2. `gated-tools` may not import `safety-gateway`; it uses the `SafetyGatewayPort` interface.
3. `safety-gateway` may not import `gated-tools`; shared request shapes must remain structurally compatible or be moved to a small contract package only when needed.
4. `pms-platform-client` must not import Agent, Safety, or workspace packages.
5. `tests` and `evals` may compose all packages to prove boundaries.

Forbidden dependency direction:

```text
pms-platform-client -> unified-agent
safety-gateway -> pms-platform-client
safety-gateway -> filesystem executor
adapter-contracts -> agent-service
workspace-core -> safety-gateway
```

## 4. Agent Runtime Constraints

### R0. pi-coding-agent remains first-class Agent core

The product Agent core is `pi-coding-agent`, not a homegrown second Agent runtime.

Allowed:

```text
createAgentSession
customTools
ResourceLoader / prompt override
SessionManager
ModelRegistry
```

Forbidden:

```text
scripted model replacing pi session
second runtime selector beyond deterministic test stub
LLM bypass around gated tools
```

### R0.1. LLM-first turn ordering is mandatory

Normal Feishu/user turns must be LLM-first. The runtime may use deterministic guardrails, validators, typed parsers, and bounded workflow scaffolding, but they are not allowed to preempt the Pi/LLM session as the primary understanding/planning surface.

Required live ordering:

```text
FeishuTurnInput
  -> pi-coding-agent / LLM observes the authority-labeled prompt
  -> typed intent or tool-plan contract where applicable
  -> runtime validates shape and profile-visible tools
  -> Safety Gateway decides side effects
  -> PMS/platform/workspace executor returns evidence/proposal/audit result
  -> response synthesis validates final AgentResult
```

Allowed deterministic code:

```text
input/output validation
Safety Gateway decisions
evidence-ref validation
approval-card gating
redaction and audit shaping
bounded legacy scaffolding after LLM observation while live tool-plan wiring is incomplete
explicit test stubs
```

Forbidden runtime direction:

```text
skipping LLM on live Feishu turns because a regex workflow can answer
turning LLM into a latency fallback after deterministic business routing
expanding customer-loop/proposal-loop into the primary business brain
using prompt policy instead of Safety Gateway or PMS evidence validation
```

Any change that intentionally bypasses the LLM for live user turns must be treated as a replan-level architecture change and needs explicit plan/workset approval plus regression proof.

### R1. Deterministic loops are temporary product scaffolding

Current deterministic loops are allowed only as bounded MVP scaffolding after LLM observation, while live typed planner integration is incomplete:

```text
customer-loop.ts
proposal-loop.ts
```

They must obey:

1. They may call only gated tools.
2. They may not perform raw side effects.
3. They may not expand into broad business workflow engines.
4. Any new regex intent rule must have a targeted test and must not replace a planned typed Agent/tool contract.
5. If a loop starts carrying slots, policy, and response synthesis together, split it into typed intent/slot state + gated tool planning + response synthesis.
6. They must not be moved before the Pi/LLM prompt path for live Feishu turns unless a new plan explicitly changes the LLM-first architecture law.

### R2. LLM capability must be released through typed gated tools

The long-term direction is:

```text
LLM understands turn
  -> chooses typed gated tool
  -> Safety Gateway decides
  -> executor returns evidence/proposal/audit result
  -> LLM summarizes within authority labels
```

Not allowed:

```text
LLM gets raw filesystem/PMS/bash/http access
LLM result is trusted as PMS fact
LLM prompt policy replaces Safety Gateway policy
```

### R3. System prompt injection must be reliable

When runtime uses pi SDK, the configured `ResourceLoader` / system prompt path must actually reach `createAgentSession`.

Any change to prompt injection must prove:

1. customer/admin profiles receive the intended baseline prompt;
2. built-in raw tools remain absent unless explicitly allowed and gated;
3. hidden prompts are not surfaced to user output;
4. context additions preserve authority labels.

### R4. AgentResult remains adapter-safe

`AgentResult` is the only service output contract.

Do not expose:

```text
pi internal messages
tool traces
raw PMS payloads
raw room IDs if not needed by adapter contract
old replies[]
wrapped { result }
stack traces
```

## 5. Conversation Continuity Constraints

### C0. Continuity is not PMS truth

Session state may preserve continuity; it must not answer current PMS fact questions.

Allowed durable/redacted state:

```text
sessionRef
actorRef
recent message refs
last intent label
missing slot labels
redacted draftRef
pendingActionRef
lastEvidenceRefs
updatedAt
```

Forbidden durable state:

```text
raw user text
raw Feishu IDs
raw guest PII
raw PMS payloads
availability counts
room status
price
reservation/payment/order current state
```

### C1. Follow-up must re-read or cite PMS evidence

If a follow-up asks for current PMS facts, one of these must be true:

1. the Agent performs a fresh PMS read and returns new `evidenceRefs`; or
2. the reply clearly states it is referring to prior evidence and does not claim current state.

Default behavior for availability/order/status questions should be fresh PMS evidence.

### C2. Structured continuity must stay small

When session state grows, prefer bounded typed slots:

```ts
type ConversationSlots = {
  intent?: 'availability' | 'prepare_confirm' | 'reservation_lookup';
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  draftRef?: string;
  pendingActionRef?: string;
  lastEvidenceRefs?: string[];
  missingSlots?: string[];
};
```

Do not store full transcript as durable memory in this repo.

## 6. AI-Readability Constraints

### AI0. One file, one dominant concept

A file should be easy to summarize in one sentence.

Allowed examples:

```text
policy-engine.ts -> deterministic policy decisions
run-gated-tool.ts -> gateway-before-executor runner
customer-loop.ts -> MVP customer PMS orchestration
```

Warning signs:

```text
file contains routing + policy + persistence + prompt + executor logic
file requires reading four unrelated files to understand its primary output
```

### AI1. Names must preserve architecture intent

Prefer domain-specific names:

```text
PmsEvidence
SafetyDecision
GatedToolRequest
AgentResult
workspace_write_proposal
pendingActionRef
```

Avoid low-signal names:

```text
Manager
Handler
Processor
Context
Data
Payload
Service2
NewFlow
```

Generic names are allowed only when the package boundary already supplies the domain.

### AI2. Tests are part of the architecture documentation

Every new boundary must have a test named after the rule it protects.

Required test classes for future slices:

| Boundary | Required proof |
| --- | --- |
| external contract | valid shape accepted; invalid/legacy shape rejected |
| Safety decision | allow, deny, approval-required, redacted audit |
| gated tool | gateway called before executor; denied executor not called |
| PMS fact | final text with PMS fact has evidenceRefs |
| session continuity | no raw text/PII; follow-up re-reads evidence |
| workspace | tenant/path/profile/write constraints |
| Agent runtime | no raw built-ins; custom gated tools only; prompt injected |

### AI3. Public docs must match code surfaces

If a package or runtime behavior changes, update the smallest matching doc:

| Change | Update |
| --- | --- |
| architecture plane/ownership | `ARCHITECTURE.md` or this file |
| safety/policy red line | `SAFETY.md` and tests |
| runtime startup/env | `README.md` |
| workspace/memory boundary | `docs/WORKSPACE.md` / `docs/MEMORY_BOUNDARY.md` |
| active execution plan | `docs/plan/*` |

Do not create duplicate SSOT docs for the same rule.

### AI4. Comments must not replace structure

Allowed comments:

1. explain non-obvious security constraints;
2. cite external API quirks;
3. document why a dangerous-looking path is safe.

Forbidden comments:

```text
restating the function name
promising future behavior
"temporary" without a plan reference
"just in case"
```

### AI5. Keep negative space explicit

Every major feature document or plan must state non-goals. This is mandatory for AI maintainers because otherwise they will expand the implementation surface.

Minimum non-goal checklist for new plans:

```text
no legacy compatibility
no raw tools
no memory as PMS truth
no production mutation from natural language
no generic framework unless required by current tests
```

## 7. Iteration Constraints

### I0. Slice size rule

A slice should have one dominant boundary:

```text
contract
policy
gated tool
PMS client
runtime
conversation loop
workspace core
workspace tools
eval/hardening
```

If one slice needs multiple dominant boundaries, split it.

### I1. Replacement-only rule

When replacing a path, do not leave parallel compatibility paths unless the plan explicitly marks the residual and tests prove both cannot be called by the same production route.

### I2. Build safety before Agent power

Order for new capability families:

```text
contract/schema
  -> Safety Gateway capability/risk/constraint
  -> gated tool wrapper
  -> executor
  -> Agent visibility
  -> conversation behavior
  -> eval/regression proof
```

Wrong order:

```text
Agent prompt first
  -> raw executor
  -> policy patch later
```

### I3. Every side effect requires audit proof

For each new side-effecting capability, tests must prove:

1. allow decision records audit id;
2. deny decision records reason and does not call executor;
3. approval-required does not call executor;
4. audit summary redacts tenant, actor, secret, raw PMS, and raw target values.

### I4. Runtime defaults are not business truth

Environment defaults may support local deterministic smoke only. They must not be documented or treated as real PMS slot extraction.

If runtime uses defaults for date/roomType, tests and docs must make clear that this is a local MVP executor behavior, not conversation intelligence.

## 8. Review Checklist

Before accepting any future implementation slice, verify:

1. Does the change preserve the five-plane split?
2. Does every side effect pass Safety Gateway before execution?
3. Does any PMS fact in user-visible text have `pms-platform` evidence?
4. Did the change add legacy compatibility or duplicate routes?
5. Did the change expand deterministic loops instead of moving toward typed gated Agent tools?
6. Are session/workspace/memory surfaces advisory only?
7. Can an AI maintainer infer the package and file ownership without hidden chat context?
8. Are tests named after the protected boundary?
9. Are docs updated only at the correct SSOT surface?
10. Did `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, and relevant evals pass?

## 9. Current Known Improvement Targets

These are not defects in the architecture baseline; they are next hardening targets.

| Target | Status | Why it matters | Expected direction |
| --- | --- | --- | --- |
| Runtime/resource loader prompt injection | Hardened; keep test coverage. | Real pi sessions must receive the same baseline prompt/context that tests assume. | Runtime factory must keep passing `resourceLoader` into `createAgentSession`; runtime-level test must stay green. |
| `profile.visibleToolNames` drift | Hardened; keep metadata aligned. | AI/human readers may trust stale metadata. | Profile metadata must match registered gated tools, including `gated_pms_workflow`. |
| Deterministic loop scope | Open. | Regex loops are readable but limit Agent power if they grow. | Keep loops small; move toward typed LLM tool planning. |
| Session continuity depth | Open. | Current refs preserve safety but not rich conversation slots. | Add redacted typed slot state; never store PMS current facts. |
| Workspace/context builder missing | Open. | Advisory tenant rules are not yet available to Agent. | Execute W0-W2 first, then context-builder with authority labels. |

## 10. Enforcement Surfaces

Current enforcement:

```text
README.md laws
ARCHITECTURE.md plane split
SAFETY.md red lines
AGENTS.md runtime baseline
scripts/boundary-guard.mjs
unit tests
packages/evals
active docs/plan workset
```

Future enforcement should add only narrow checks that map to this document, for example:

1. import-boundary check for forbidden dependency directions;
2. test that real runtime passes `resourceLoader` into pi `createAgentSession`;
3. workspace path/profile checks from W1/W2;
4. eval that memory/session/workspace cannot answer current PMS facts.

Do not replace architectural discipline with a broad generic linter. Add checks only when they protect a named boundary above.
