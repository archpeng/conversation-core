# PMS Agent Code Readability R0-R3 Closeout

Pack ID: `pms-agent-code-readability-r0-r3-v1-2026-05-08`
Closed: 2026-05-08
Predecessor: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`

## Summary

Split 4 oversized source files into owner-bound modules, tightened 11 type assertions to `Record<string, unknown>`, and eliminated all `as Partial<T>` casts — without changing runtime behavior, test assertions, or eval outcomes.

## Deliverables

### R0 — split-session-ts

- Extracted `room-selection.ts` (184 lines): room candidate selection, room type resolution, reply crafting
- Extracted `pi-io.ts` (68 lines): Pi session I/O and text parsing
- session.ts reduced from 681 → 452 lines
- `selectRoomCandidates` parameterized to accept `piSession` + `context` to avoid circular imports from unified-agent

### R1 — extract-executor-factories

- Extracted `executors.ts` (169 lines): `createRuntimeExecutors` + 5 private helpers
- runtime.ts reduced from 427 → 275 lines
- `RuntimeExecutorConfig` type defined in executors.ts to avoid circular import from runtime.ts
- Re-export from runtime.ts preserves existing test imports

### R2 — tighten-type-guards

- 11 `as Partial<T>` assertions across 4 files replaced with `Record<string, unknown>`
- 3 `isPmsEvidence` type guards tightened (session.ts, customer-loop.ts, tool-registration.ts) — added intermediate `source` variable for safe nested access
- `isReservationConfirmPreparation` and `isAvailabilityEvidence` type guards tightened
- `emitToolResultEvent`: `details.outcome ?? "unknown"` replaced with explicit `typeof` check for string narrowing

### R3 — split-evals-index

- Extracted `eval-cases.ts` (557 lines): 18 eval case functions + shared constants + helpers
- evals/index.ts reduced from 679 → 148 lines: types, runner, CLI entry point

## Gate

- `pnpm build`: tsc -b clean
- `pnpm test`: 20 files, 172 tests
- `pnpm guard:boundaries`: passing
- `pnpm eval`: ok=true, 19/19

## Design Decisions

1. `selectRoomCandidates` takes `PiAgentSession` and `ContextBundle` instead of full `UnifiedAgentSession` to avoid circular dependency
2. `RuntimeExecutorConfig` is a minimal inline type in executors.ts — structurally compatible with `AgentServiceRuntimeConfig` — avoiding circular import from runtime.ts
3. All `as Partial<T>` replaced with `Record<string, unknown>` — the honest type for "unvalidated object"
4. `isPmsEvidence` uses intermediate `source` variable instead of `evidence.source.method` without `?.` to satisfy TypeScript narrowing with `Record<string, unknown>`

## Residuals

- 3 double-cast bridges in runtime.ts (`as SafetyDecision as GatedDecision`) remain at Pi SDK boundary — these are structural by-design, not Partial assertions
- `tool-registration.ts` (231 lines) could be a future split target
- `customer-loop.ts` (171 lines) owns deterministic fallback — bounded scope, not oversized
