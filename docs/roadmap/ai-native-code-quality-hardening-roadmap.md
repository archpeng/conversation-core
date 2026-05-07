# Roadmap: AI-Native Code Quality Hardening

Status: proposed execution roadmap
Date: 2026-05-07
Target repo: `pms-agent-v2`
Scope: post-MVP code-quality hardening after platform-backed PMS workflow closeout
Owner lane: future `plan-creator` / `execute-plan`

## 0. Purpose

Turn the latest code-quality review into a bounded AI-native hardening sequence.

This roadmap protects the current architecture baseline without expanding the MVP into a generic platform. The priority is executable guardrails, smaller safety surfaces, and reduced model-visible sensitive context.

Primary SSOT inputs:

- `README.md` non-negotiable laws
- `ARCHITECTURE.md` five-plane split
- `docs/ARCHITECTURE_CONSTRAINTS.md` AI-readability and package ownership constraints
- `SAFETY.md` Safety Gateway and evidence red lines
- `docs/plan/README.md` active parser control-plane contract

## 1. Current Baseline

Current accepted baseline:

```text
adapter-feishu
  -> apps/agent-service
  -> packages/unified-agent
  -> packages/gated-tools
  -> packages/safety-gateway
  -> packages/pms-platform-client
  -> pms-platform
```

Validated before this roadmap was written:

```text
pnpm build: passed
pnpm test: passed
vitest: 20 files passed, 151 tests passed
pnpm guard:boundaries: passed
pnpm eval: ok=true, passed=19, total=19, auditEvents=17
git diff --check: passed
```

Current active plan pack is already closed at `PACK_COMPLETE`; this roadmap is a successor planning artifact, not a reopened implementation pack.

## 2. Non-Goals

Do not use this roadmap to add:

```text
legacy compatibility
second Agent runtime
generic plugin framework
generic workflow engine
multi-agent supervisor
broad memory/workspace platform expansion
production PMS mutation from natural language
raw tools in Agent visibility
large session.ts refactor without a touched owner slice
```

Each item below must remain a small, proof-carrying hardening slice.

## 3. Execution Order

| Phase | Title | Primary owner boundary | Why now | Expected proof |
| --- | --- | --- | --- | --- |
| `H1` | Import-boundary guard | `scripts/boundary-guard.mjs` + boundary tests | Highest AI-native leverage: executable plane protection | guard rejects forbidden imports; build/test/guard/eval pass |
| `H2` | HTTP body size limit | `apps/agent-service` | Service boundary hardening with low product risk | oversized body rejected; normal turn unaffected |
| `H3` | Minimal PMS tool public content | `packages/unified-agent/tool-registration` | Reduce raw PMS payload in model-visible tool content | content redacted/minimal; `details.value` remains runtime-complete |
| `H4` | Runtime event logging opt-in or explicit doc | `apps/agent-service/runtime` + README if needed | Prevent production noise / leakage ambiguity | default behavior test; docs match code |
| `H5` | Opportunistic `session.ts` extraction | `packages/unified-agent` | Preserve AI readability when next touching session orchestration | only touched owner block extracted; no parallel path |

## 4. Phase Details

### H1. Add import-boundary guard

Decision:

Convert architecture ownership rules from memory/doc prose into an executable boundary check.

Minimum target checks:

| Forbidden direction | Reason |
| --- | --- |
| `packages/pms-platform-client -> packages/unified-agent` | PMS fact source must not depend on Agent runtime |
| `packages/pms-platform-client -> packages/safety-gateway` | PMS client owns evidence, not policy |
| `packages/safety-gateway -> packages/pms-platform-client` | policy must not import business fact source |
| `packages/safety-gateway -> packages/gated-tools` | gateway and tools stay decoupled by port shape |
| `packages/adapter-contracts -> apps/agent-service` | external DTOs must not depend on service runtime |
| `packages/workspace-core -> packages/safety-gateway` | workspace primitives must not own actor/profile policy |
| `packages/unified-agent -> raw legacy modules` | preserve current legacy exclusion |

Implementation shape:

- Extend `scripts/boundary-guard.mjs`; do not add a new linter framework.
- Keep existing legacy scans.
- Add tests in `tests/boundary-guard.test.ts` for at least one allowed and several denied import directions.
- Prefer path/package based static checks over TypeScript compiler plugin complexity.

Done when:

- forbidden import fixture fails with a clear rule id;
- current repo passes `pnpm guard:boundaries`;
- `pnpm test` still includes boundary guard regression;
- no package ownership doc drift.

### H2. Limit HTTP body size

Decision:

Bound inbound request body accumulation at the service edge.

Target surface:

- `apps/agent-service/src/runtime.ts`
- `readBody()` / `handleHttpRequest()`
- optional config field if needed: `PMS_AGENT_MAX_BODY_BYTES`

Constraints:

- Default limit should be small and explicit, e.g. `256 KiB`.
- Over-limit body must not reach `createAgentService.handle()`.
- Response must not leak stack traces or partial request content.
- Normal `/health` and valid `/v1/feishu-turn` behavior must remain unchanged.

Done when:

- oversized POST receives deterministic refusal / `413` style response;
- normal turn still passes existing tests;
- runtime docs mention the limit if configurable.

### H3. Constrain PMS tool public content

Decision:

The Pi-visible tool `content` should be a minimal public summary. Runtime-complete PMS evidence remains available through `details.value` only.

Current risk:

- `packages/unified-agent/src/tool-registration.ts` serializes `publicToolResult(result)` into tool content.
- For `allow`, current public content may include full `value`.
- Existing response synthesis avoids user-visible leakage, but model-visible context should still be minimized.

Target behavior:

```text
toolResult.content -> outcome, auditId, evidenceRef, source.method, summary
toolResult.details -> full GatedToolResult with PmsEvidence value
```

Constraints:

- Do not break `synthesizeToolResult()`, which reads `toolResult.details`.
- Do not remove evidence refs needed for final replies.
- Apply PMS-specific minimization without hiding non-PMS proposal result shape unnecessarily unless tests require it.

Done when:

- test proves tool content does not include raw PMS room IDs / raw payload secrets;
- test proves `details.value` still contains complete evidence for runtime orchestration;
- existing evidence-backed reply tests still pass.

### H4. Make runtime event logging opt-in or document it explicitly

Decision:

Remove ambiguity around runtime turn event stdout logging.

Preferred target:

```text
PMS_AGENT_LOG_TURN_EVENTS=true -> enable redacted event logging
unset / false -> disabled
```

Acceptable alternative:

- keep current default only if README clearly states redacted operational events are emitted by default and names fields that must never appear.

Constraints:

- Event payload must stay redacted: no user text, no raw PMS payload, no evidenceRef, no pendingActionId.
- Do not remove the `eventSink` test surface.
- Do not introduce external logging framework.

Done when:

- runtime config test locks default behavior;
- redaction test remains green;
- README env table matches code if behavior is user-visible.

### H5. Extract from `session.ts` only when touching it for a concrete owner block

Decision:

Do not perform a broad cleanup refactor. Extract only when a future implementation naturally touches one bounded concept.

Allowed extraction candidates:

| Candidate file | Move only if touched by current slice |
| --- | --- |
| `bounded-read-workflow.ts` | bounded `gated_pms_read -> gated_pms_workflow` orchestration |
| `pms-evidence-synthesis.ts` | PMS evidence reply / approval-card synthesis |
| `turn-events.ts` | redacted turn event construction/emission |

Constraints:

- No new framework or orchestration layer.
- No behavior change without a named test.
- No parallel compatibility path.
- Preserve LLM-first ordering.

Done when:

- extracted file has one dominant concept;
- tests prove before/after behavior for that touched concept;
- `session.ts` becomes smaller without losing traceability.

## 5. Validation Gate For Each Phase

Minimum gate unless phase explicitly documents why not applicable:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

Additional phase-specific proof:

| Phase | Extra proof |
| --- | --- |
| `H1` | negative forbidden-import fixture |
| `H2` | oversized body rejection test |
| `H3` | PMS tool content redaction + details preservation test |
| `H4` | runtime config default test |
| `H5` | behavior-equivalence test for extracted owner block |

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Boundary guard becomes a generic linter | Keep it rule-table based and tied to `docs/ARCHITECTURE_CONSTRAINTS.md` |
| Body limit breaks adapter payloads | Choose conservative limit; add normal Feishu turn regression |
| Tool content minimization breaks LLM synthesis | Keep summary/evidenceRef in content and full evidence in details |
| Event logging change surprises local operators | Document env behavior in README if changed |
| `session.ts` extraction becomes broad refactor | Defer H5 until a concrete touched owner block exists |

## 7. Suggested Next Plan Pack

If converting this roadmap into an active plan pack, use a small H1-H4 pack and leave H5 as opportunistic residual:

```text
Plan ID suggestion: pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07
Stages:
  H1 import-boundary-guard
  H2 http-body-size-limit
  H3 pms-tool-public-content-minimization
  H4 runtime-event-logging-default
Residual:
  H5 session-ts-owner-block-extraction-on-next-touch
```

Stop boundary:

```text
If any phase requires changing three or more architecture planes at once, stop and replan.
```
