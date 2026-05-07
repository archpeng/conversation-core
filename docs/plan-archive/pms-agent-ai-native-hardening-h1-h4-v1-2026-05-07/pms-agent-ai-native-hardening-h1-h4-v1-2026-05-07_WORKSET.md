# PMS Agent AI-Native Hardening H1-H4 Workset

Plan ID: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`

## Stage Order

- [x] `H1` import-boundary-guard
- [x] `H2` http-body-size-limit
- [x] `H3` pms-tool-public-content-minimization
- [x] `H4` runtime-event-logging-default
- [x] `PACK_COMPLETE` closeout-and-archive

## Active Stage

### `PACK_COMPLETE`

- Owner: `autopilot-closeout`
- State: `queued`
- Priority: `closeout`

目标：

- Close the hardening pack only after H1-H4 are accepted by review and docs/plan writeback is complete.

必须交付：

1. STATUS/WORKSET show H1-H4 complete.
2. README current active slice is `PACK_COMPLETE`.
3. Final validation evidence is recorded.
4. Closed pack is ready to archive under `docs/plan-archive/`.

done_when:

1. All non-deferred stages are complete.
2. Full default gate has passed after H4.
3. Residual `H5` remains documented as opportunistic future work, not an active blocker.

stop_boundary:

1. Stop if any H1-H4 stage lacks accepted review evidence.
2. Stop if docs/plan files disagree on active slice.
3. Stop if uncommitted code changes are not intentionally included or explicitly excluded.

必须避免：

1. Do not claim closeout from an active non-terminal slice.
2. Do not archive active parser truth prematurely.
3. Do not include unrelated working-tree changes without inspection.
## Completed Stage Evidence

### `PACK_COMPLETE`

- Closeout artifact written: `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_CLOSEOUT.md`.
- Final validation passed: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `node packages/evals/dist/index.js`, and `git diff --check`.
- `pnpm test` passed with 20 files / 166 tests and eval ok=true passed=19 total=19 auditEvents=17.
- `plan_sync docs/plan` before archive showed STATUS/WORKSET done=4 pending=1 with PACK_COMPLETE ready for closeout.

### `H4`

- `apps/agent-service/src/runtime.ts` treats runtime turn-event stdout logging as explicit opt-in: only `PMS_AGENT_LOG_TURN_EVENTS=true` enables `eventSink`; unset and `false` disable logging.
- `tests/agent-service-runtime.test.ts` locks default/unset, explicit `false`, and explicit `true` behavior.
- `README.md` documents `PMS_AGENT_LOG_TURN_EVENTS` behavior and redaction constraints.
- `tests/unified-agent.test.ts` covers redacted planner/tool/result events and approval-card result events without pending-action IDs.
- Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 166 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.

### `H3`

- `packages/unified-agent/src/tool-registration.ts` emits minimized public content for PMS evidence allow results: outcome, audit id, evidence ref, source, and summary only.
- Full `GatedToolResult` and complete `PmsEvidence` remain available through `toolResult.details.value` for runtime orchestration.
- `tests/unified-agent.test.ts` proves PMS public content excludes raw payload fields such as room IDs and secret-looking values while `details.value` preserves the original evidence object.
- Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 164 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.

### `H2`

- `apps/agent-service/src/runtime.ts` adds explicit inbound HTTP body limit config via `PMS_AGENT_MAX_BODY_BYTES`, defaulting to `262144` bytes.
- Oversized POST bodies return deterministic status `413` refusal without stack traces or body echo, before `service.handle` is called.
- `tests/agent-service-runtime.test.ts` covers config default/override, oversized rejection before service handling, `/health`, and valid `/v1/feishu-turn` under the limit.
- `README.md` documents `PMS_AGENT_MAX_BODY_BYTES`.
- Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 163 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.

### `H1`

- `scripts/boundary-guard.mjs` adds rule-table import-direction checks for documented forbidden package directions without external lint/parser dependencies.
- `tests/boundary-guard.test.ts` covers denied imports for `pms-platform-client -> unified-agent`, `safety-gateway -> pms-platform-client`, `safety-gateway -> gated-tools`, `adapter-contracts -> agent-service`, and `workspace-core -> safety-gateway`.
- Legacy module, old `replies[]`, and compat-module guard behavior remains covered.
- Allowed documented `unified-agent -> pms-platform-client` cross-link fixture is covered.
- Review validation: `pnpm test` passed with 20 files / 160 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.

## Slice Ownership

### `H1`

- `scripts/boundary-guard.mjs`
- `tests/boundary-guard.test.ts`
- Optional: smallest matching docs wording if rule IDs need explanation

### `H2`

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts` or nearest service-boundary test
- Optional: `README.md` env table if configurable limit is added

### `H3`

- `packages/unified-agent/src/tool-registration.ts`
- `tests/unified-agent.test.ts` or nearest tool-registration test

### `H4`

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts`
- `README.md`

### `PACK_COMPLETE`

- `docs/plan/README.md`
- `docs/plan/*_STATUS.md`
- `docs/plan/*_WORKSET.md`
- final closeout/archive files under `docs/plan-archive/`

## Expected Verification

Default full gate before pack closeout:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

H1 minimum execution gate:

```bash
pnpm test
pnpm guard:boundaries
git diff --check
```

Planning handoff gate:

```bash
plan_sync docs/plan
git diff --check
pnpm guard:boundaries
```

## Per-Stage Verification Notes

| Stage | Required focused proof |
| --- | --- |
| `H1` | negative forbidden-import fixture and current repo passing guard |
| `H2` | oversized body rejection and normal turn unaffected |
| `H3` | PMS tool content hides raw payload while `details.value` preserves complete evidence |
| `H4` | logging default and explicit env behavior tested; README matches code |
| `PACK_COMPLETE` | full default gate plus parser truth set to terminal state |

## Autopilot Transition Contract

- `execute/completed` proves implementation evidence and dispatches same-slice `review`.
- Do not mark or advance the active slice from execute alone unless the whole objective reports `done` and parser truth is already terminal.
- `review/completed` is the accepted writeback gate that marks the reviewed slice complete and loads the next `Stage Order` item as `Active Stage`.
- H4 accepted review loaded `PACK_COMPLETE` as the current `Active Stage`; next phase is repo-local closeout prompt surface.
- `review/continue` keeps this `Active Stage`; `needs_replan` routes to `replan`; hard stops leave this stage active for repair.
- The next execute phase may run only after README/STATUS/WORKSET parse with the same active slice and intended handoff.
- Closeout is premature unless README and WORKSET name active slice `PACK_COMPLETE`, owner `autopilot-closeout`, state `DONE`, and all H1-H4 stages are complete or explicitly deferred.

## Execution Notes

- Under extension autopilot, the active stage ID is the `stepId` for active-slice reports.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Do not make “ask whether to continue” the default stop rule; use the active stage `done_when` / `stop_boundary`.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Keep transition contract explicit whenever the workset is repaired or superseded.
- Before any full commit, inspect pre-existing uncommitted source/test changes and stage only intentional changes.

## Machine Queue

- active_step: `PACK_COMPLETE`
- latest_completed_step: `H4`
- intended_handoff: `autopilot-closeout`
- latest_closeout_summary: H4 accepted; parser truth advanced to PACK_COMPLETE closeout.
- latest_verification:
  - `Re-read active plan truth, runtime config, README env table, event tests, and unified-agent event emitter against H4 claims`
  - `Review added tests/unified-agent.test.ts approval-card event proof excluding pending_secret_event, evidenceRef, and user text`
  - `pnpm test -- tests/agent-service-runtime.test.ts tests/unified-agent.test.ts passed: 20 files, 166 tests; boundary guard passed; eval ok=true passed=19/19`
  - `Full review gate passed: pnpm build; pnpm test; pnpm guard:boundaries; git diff --check`
  - `plan_sync docs/plan shows STATUS/WORKSET done=4 pending=1 after H4 acceptance writeback`
  - `apps/agent-service/src/runtime.ts`
  - `tests/agent-service-runtime.test.ts`
  - `tests/unified-agent.test.ts`
  - `README.md`
  - `docs/plan/README.md`
  - `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_STATUS.md`
  - `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_WORKSET.md`