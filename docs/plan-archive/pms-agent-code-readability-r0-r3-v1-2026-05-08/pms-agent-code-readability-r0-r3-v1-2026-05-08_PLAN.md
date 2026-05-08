# PMS Agent Code Readability R0-R3 Plan

Plan ID: `pms-agent-code-readability-r0-r3-v1-2026-05-08`
Status: `READY`
Source: AI-readability audit of repository source files
Mode: `single-root-autopilot-compatible`

## Goal

Reduce AI-readability friction by splitting oversized files, extracting owner-bound functions, tightening type assertions, and restoring clean module boundaries — without changing runtime behavior.

## Scope

In scope:

1. **R0** — split `packages/unified-agent/src/session.ts` (681 lines) by owner boundary: extract room-selection, response-synthesis, and pi-io helpers into dedicated modules
2. **R1** — extract `createRuntimeExecutors` and per-executor factories from `apps/agent-service/src/runtime.ts` into `apps/agent-service/src/executors.ts`
3. **R2** — complete type guard chains to eliminate `as Partial<T>` assertions and `as X as Y` double casts where safe
4. **R3** — split `packages/evals/src/index.ts` (679 lines) into runner + case definitions

Out of scope:

- Changing runtime behavior or API contracts
- Introducing new frameworks, abstractions, or design patterns
- Adding production features or changing business logic
- Modifying test assertions (only imports may change)
- workspace-core (already clean — internal functions are private)
- Generic lint/format tooling

## Constraints

- Preserve five-plane split: Agent, Capability/Policy, Fact Source, Executor, Audit/Eval
- Every existing test must pass unchanged after each slice
- `pnpm build` must pass after each slice
- No file renaming that breaks git blame (prefer new-file + re-export)
- Split by owner boundary, not by line count

## Verification

Default gate after every slice:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
```

## Blockers / Risks

| Risk | Response |
| --- | --- |
| session.ts split causes circular imports | Resolve by keeping shared types in session.ts, extracting only pure-logic modules |
| Type guard completion reveals missing runtime validation | Add validation only when it mirrors existing `isXxx` pattern; do not widen scope |
| Executor extraction breaks test mocks | Keep exported function signatures identical; only move code location |
| Evals split breaks eval runner contracts | Keep `runMvpEvals` and `runEvalCli` signatures identical |

## Slice Definitions

### `R0` — split-session-ts

- Owner: `execute-plan`
- State: `READY`
- Priority: `highest`

目标:

Extract three owner-bound modules from session.ts:

1. `room-selection.ts` — `selectRoomCandidates`, `resolveRoomTypeFromEvidence`, `validatedResolvedRooms`, `roomTypeResolutionPrompt`, `parseRoomTypeResolution`, `roomTypeOptions`, `redactRoomIds`, `requestedRoomTypeText`, `requestedWorkflowQuantity`, `roomSelection`, `nonEmptyText`, `omitParam`
2. `response-synthesis.ts` — merge into existing `packages/unified-agent/src/response-synthesis.ts`: `synthesizeToolResult`, `synthesizeEvidenceTextReply`, `fallbackEvidenceTextReply`, `synthesizePrepareConfirmApproval`, `isReservationConfirmPreparation`, `approvalCard`, `noAvailableRoomsReply`, `insufficientCandidateReply`, `roomTypeClarificationReply`, `evidenceReplyPrompt`, `turnContext`
3. `pi-io.ts` — `promptAssistantText`, `collectAssistantText`, `latestAssistantMessage`, `extractVisibleText`, `extractContentPartText`

Session.ts retains: type exports, `createUnifiedAgentSession`, `runAgentTurn`, `runAssistantToolPlan`, `executeBoundedReadThenWorkflowPlan`, `runPostLlmSafetyScaffoldFallback`, `parseAssistantToolPlanJson`, `toolPlanRefusalReason`, `toolPlanEvent`, `emitToolResultEvent`, `emitFinalResultEvent`, `emitEvent`, `fallbackNaturalReply`, `turnPrompt`, `isPmsEvidence`, `isAvailabilityEvidence`

Touched files:
- `packages/unified-agent/src/session.ts` (slimmed, re-exports from new modules)
- `packages/unified-agent/src/room-selection.ts` (new)
- `packages/unified-agent/src/pi-io.ts` (new)
- `packages/unified-agent/src/response-synthesis.ts` (extended)
- `packages/unified-agent/src/index.ts` (new exports from room-selection, pi-io)

done_when:
1. session.ts < 350 lines
2. New modules each have a single owner boundary
3. `pnpm build && pnpm test` pass with zero changes to test assertions

stop_boundary:
1. Stop if extracting any function requires a behavior change
2. Stop if a circular import emerges that cannot be resolved by moving types
3. Stop if any test assertion must change

必须避免:
1. Do not change function signatures
2. Do not alter control flow
3. Do not create new abstractions or wrappers

### `R1` — extract-executor-factories

- Owner: `execute-plan`
- State: `queued`
- Priority: `high`

目标:

Move `createRuntimeExecutors` and its private helpers from `runtime.ts` to `apps/agent-service/src/executors.ts`.

Extracted:
- `createRuntimeExecutors` (currently 108 lines)
- `proposalReadExecutor`, `proposalWriteExecutor`
- `safeProposalPath`
- Per-executor factory functions for pmsRead, pmsWorkflow, pmsConfirm

Touched files:
- `apps/agent-service/src/runtime.ts` (import from executors.ts)
- `apps/agent-service/src/executors.ts` (new)
- `tests/agent-service-runtime.test.ts` (import path update if needed)

done_when:
1. `createRuntimeExecutors` lives in executors.ts and is imported by runtime.ts
2. runtime.ts < 330 lines
3. `pnpm build && pnpm test` pass

stop_boundary:
1. Stop if the extraction requires changing the function signature
2. Stop if any test relies on mocking internal executor functions directly

必须避免:
1. Do not restructure executor logic — pure code relocation
2. Do not change public API surface of runtime.ts

### `R2` — tighten-type-guards

- Owner: `execute-plan`
- State: `queued`
- Priority: `medium`

目标:

Eliminate `as Partial<T>` assertions by completing type guard chains where the runtime check already exists.

Priority targets (most impactful first):
1. `session.ts` — `isPmsEvidence`, `isAvailabilityEvidence`, `isReservationConfirmPreparation` already validate shape; downstream casts to `as Partial<...>` should be replaced by calling the guard
2. `runtime.ts` — the double cast `as SafetyDecision as GatedDecision` bridge; if types are compatible, add a conversion function
3. `tool-registration.ts` — `as Partial<PmsEvidence<unknown>>` → use existing `isPmsEvidence`
4. `customer-loop.ts` — same pattern → use existing `isPmsEvidence`

Touched files:
- `packages/unified-agent/src/session.ts`
- `apps/agent-service/src/runtime.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/customer-loop.ts`

done_when:
1. `as Partial<X>` count drops from 14 to ≤ 3 (bridge casts only)
2. All existing type guard functions are re-used where applicable
3. `pnpm build -- --strict && pnpm test` pass

stop_boundary:
1. Stop if removing a cast exposes a genuine type incompatibility that requires schema changes
2. Stop if a type guard needs runtime behavior change

必须避免:
1. Do not widen type definitions to mask real gaps
2. Do not remove runtime validation checks

### `R3` — split-evals-index

- Owner: `execute-plan`
- State: `queued`
- Priority: `medium`

目标:

Split `packages/evals/src/index.ts` into:
1. `eval-cases.ts` — all `evalCase` definitions and their helper functions (`groundedAvailability`, `prepareConfirm`, `naturalConfirm`, etc.)
2. `index.ts` — `runMvpEvals`, `runEvalCli`, `evalCategories`, shared types, and test utilities (`fakePmsEvidence`, `recordingGateway`, `assert`, `service`)

Touched files:
- `packages/evals/src/index.ts` (slimmed, imports from eval-cases)
- `packages/evals/src/eval-cases.ts` (new)

done_when:
1. eval-cases.ts contains all 19 case definitions
2. index.ts < 400 lines
3. `node packages/evals/dist/index.js` produces `ok: true`
4. `pnpm build && pnpm test` pass

stop_boundary:
1. Stop if the split breaks eval runner contract (`runMvpEvals`, `runEvalCli` signatures)

必须避免:
1. Do not change any eval case logic
2. Do not change exported API surface

### `PACK_COMPLETE` — closeout-and-archive

- Owner: `autopilot-closeout`
- State: `queued`
- Priority: `closeout`

done_when:
1. All R0-R3 stages complete with review evidence
2. Full gate passes: `pnpm build && pnpm test && pnpm guard:boundaries`
3. `docs/plan/README.md` reflects PACK_COMPLETE

## Residuals

- schema.ts (460 lines) is large but single-concern — acceptable
- `as unknown as ReturnType<PiCreateAgentSession>` in runtime.ts is a Pi SDK bridge gap that cannot be fixed without SDK changes
- workspace-core/workspace-tools are already clean — no changes needed

## Exit Criteria

- R0-R3 accepted by review
- `pnpm build`, `pnpm test`, `pnpm guard:boundaries` pass
- `docs/plan/README.md`, PLAN, STATUS, and WORKSET agree on `PACK_COMPLETE`
