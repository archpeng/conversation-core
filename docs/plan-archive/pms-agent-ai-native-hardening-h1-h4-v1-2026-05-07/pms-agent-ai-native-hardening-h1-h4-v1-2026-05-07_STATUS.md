# PMS Agent AI-Native Hardening H1-H4 Status

Plan ID: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`
Status file state: `IN_PROGRESS`
Last updated: 2026-05-07

## Current State

- state: `IN_PROGRESS`
- owner: `execute-plan`
- route: `PLAN -> EXEC -> REVIEW -> WRITEBACK -> NEXT_STAGE -> CLOSEOUT`
- workstream: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`
- mode: `single-root-autopilot-compatible`
- design law: `executable AI-native guardrails before stronger Agent/runtime surface expansion`

## Current Step

- active_step: `PACK_COMPLETE`
- mode: `ready_for_closeout`

## Planned Stages

- [x] `H1` import-boundary-guard
- [x] `H2` http-body-size-limit
- [x] `H3` pms-tool-public-content-minimization
- [x] `H4` runtime-event-logging-default
- [x] `PACK_COMPLETE` closeout-and-archive

## Immediate Focus

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
## Machine State

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
## Autopilot Transition Contract

- `execute/completed` dispatches `review` for the same active slice and must not advance `active_step` during execute.
- `review/completed` accepts the active slice and performs deterministic docs/plan writeback to the next active stage.
- Accepted H4 review advanced parser truth to active slice `PACK_COMPLETE` with intended handoff `autopilot-closeout`.
- Accepted H3 review advanced parser truth to active slice `H4` with intended handoff `execute-plan`.
- `review/continue` keeps `active_step` unchanged for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stop; `done` routes to closeout only when the whole objective is complete.
- After accepted review, `README`, `STATUS`, and `WORKSET` must agree on the new active slice and intended handoff before another execute phase runs.

## Recently Completed

- `H4` runtime-event-logging-default accepted by review:
  - `apps/agent-service/src/runtime.ts` treats runtime turn-event stdout logging as explicit opt-in: only `PMS_AGENT_LOG_TURN_EVENTS=true` enables `eventSink`; unset and `false` disable logging.
  - `tests/agent-service-runtime.test.ts` locks default/unset, explicit `false`, and explicit `true` behavior.
  - `README.md` documents `PMS_AGENT_LOG_TURN_EVENTS` behavior and redaction constraints.
  - `tests/unified-agent.test.ts` covers redacted planner/tool/result events and approval-card result events without pending-action IDs.
  - Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 166 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.
- `H3` pms-tool-public-content-minimization accepted by review:
  - `packages/unified-agent/src/tool-registration.ts` emits minimized public content for PMS evidence allow results: outcome, audit id, evidence ref, source, and summary only.
  - Full `GatedToolResult` and complete `PmsEvidence` remain available through `toolResult.details.value` for runtime orchestration.
  - `tests/unified-agent.test.ts` proves PMS public content excludes raw payload fields such as room IDs and secret-looking values while `details.value` preserves the original evidence object.
  - Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 164 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.
- `H2` http-body-size-limit accepted by review:
  - `apps/agent-service/src/runtime.ts` adds explicit inbound HTTP body limit config via `PMS_AGENT_MAX_BODY_BYTES`, defaulting to `262144` bytes.
  - Oversized POST bodies return deterministic status `413` refusal without stack traces or body echo, before `service.handle` is called.
  - `tests/agent-service-runtime.test.ts` covers config default/override, oversized rejection before service handling, `/health`, and valid `/v1/feishu-turn` under the limit.
  - `README.md` documents `PMS_AGENT_MAX_BODY_BYTES`.
  - Review validation: `pnpm build` passed; `pnpm test` passed with 20 files / 163 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.
- `H1` import-boundary-guard accepted by review:
  - `scripts/boundary-guard.mjs` adds rule-table import-direction checks for documented forbidden package directions without external lint/parser dependencies.
  - `tests/boundary-guard.test.ts` covers denied imports for `pms-platform-client -> unified-agent`, `safety-gateway -> pms-platform-client`, `safety-gateway -> gated-tools`, `adapter-contracts -> agent-service`, and `workspace-core -> safety-gateway`.
  - `tests/boundary-guard.test.ts` preserves legacy module / old `replies[]` / compat-module coverage and adds allowed `unified-agent -> pms-platform-client` fixture.
  - Review validation: `pnpm test` passed with 20 files / 160 tests; `pnpm guard:boundaries` passed; `pnpm eval` passed via test script with ok=true passed=19 total=19; `git diff --check` passed.
- Previous active pack `pms-agent-platform-workflow-q1-q4-v1-2026-05-07` reached `PACK_COMPLETE` and was moved to cold archive for this successor pack.
- Roadmap `docs/roadmap/ai-native-code-quality-hardening-roadmap.md` was created as the source for H1-H4.

## Next Step

- `PACK_COMPLETE`

## Blockers

- None for closeout handoff.
- Working tree contains intentional H1-H4 implementation/evidence writeback pending commit/archive closeout.

## Gate State

- Closeout gate passed:
  - `plan_sync docs/plan` before archive: STATUS/WORKSET done=4 pending=1 with PACK_COMPLETE active
  - `pnpm build` passed
  - `pnpm test` passed: 20 files, 166 tests; boundary guard passed; eval ok=true passed=19 total=19 auditEvents=17
  - `pnpm guard:boundaries` passed
  - `node packages/evals/dist/index.js` passed: ok=true passed=19 total=19 auditEvents=17
  - `git diff --check` passed
  - closeout artifact written: `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_CLOSEOUT.md`

## Latest Evidence

- H4 review evidence:
  - Re-read `docs/plan/README.md`, active `STATUS`/`WORKSET`, `apps/agent-service/src/runtime.ts`, `tests/agent-service-runtime.test.ts`, `README.md`, `tests/unified-agent.test.ts`, and `packages/unified-agent/src/session.ts` against H4 claims.
  - Review added approval-card event proof that pending-action IDs are not emitted in redacted result events; this closes the H4 pendingActionId redaction clause directly.
  - Confirmed `eventSink` remains a testable port, no logging framework dependency was added, and event payload shape stays count/type/method/key based.
  - `pnpm test -- tests/agent-service-runtime.test.ts tests/unified-agent.test.ts` passed: 20 files, 166 tests; boundary guard passed; eval ok=true passed=19 total=19.
  - Full review gate passed: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `git diff --check`; eval inside test passed ok=true passed=19 total=19.
  - No external observability infrastructure, sensitive event payload field, or production deployment conflict observed.
- H4 execute evidence:
  - `apps/agent-service/src/runtime.ts` now treats runtime turn-event stdout logging as explicit opt-in: only `PMS_AGENT_LOG_TURN_EVENTS=true` enables `eventSink`; unset and `false` disable logging.
  - `tests/agent-service-runtime.test.ts` locks default/unset, explicit `false`, and explicit `true` behavior.
  - `README.md` documents `PMS_AGENT_LOG_TURN_EVENTS` default/false disabled and exact `true` enabled, plus redaction constraints.
  - Existing redacted event proof in `tests/unified-agent.test.ts` remains green: planner/tool/result event payloads exclude user text, raw PMS payload content, and evidence refs.
  - `pnpm test -- tests/agent-service-runtime.test.ts tests/unified-agent.test.ts` passed: 20 files, 165 tests; boundary guard passed; eval ok=true passed=19 total=19.
  - Full gate passed before review handoff: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `git diff --check`; `pnpm test` included eval ok=true passed=19 total=19.
- H3 review evidence:
  - Re-read `docs/plan/README.md`, active `STATUS`/`WORKSET`, `packages/unified-agent/src/tool-registration.ts`, `tests/unified-agent.test.ts`, and `packages/unified-agent/src/session.ts` against H3 claims.
  - Confirmed runtime synthesis reads PMS evidence from `toolResult.details.value`, not minimized public `content`.
  - Confirmed H3 only changes PMS evidence public content; non-PMS proposal tool result shape remains unchanged by fallback branch.
  - `pnpm test -- tests/unified-agent.test.ts` passed: 20 files, 164 tests; boundary guard passed; eval ok=true passed=19 total=19.
  - Full review gate passed: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `git diff --check`; eval inside test passed ok=true passed=19 total=19.
  - No AgentResult schema, PMS evidence schema, generic serialization framework, or proposal tool policy changes observed.
- H3 execute evidence:
  - `packages/unified-agent/src/tool-registration.ts` now emits minimized public content for PMS evidence allow results: outcome, audit id, evidence ref, source, and summary only.
  - Full `GatedToolResult` and complete `PmsEvidence` remain available through `toolResult.details.value` for runtime orchestration.
  - `tests/unified-agent.test.ts` proves PMS public content excludes raw payload fields such as room IDs and secret-looking values while `details.value` preserves the original evidence object.
  - `pnpm test -- tests/unified-agent.test.ts` passed: 20 files, 164 tests; boundary guard passed; eval ok=true passed=19 total=19.
  - `pnpm build` passed.
  - `pnpm test` passed: 20 files, 164 tests; included boundary guard and eval ok=true passed=19 total=19.
  - `pnpm guard:boundaries` passed.
  - `git diff --check` passed.
- H2 review evidence:
  - Re-read `docs/plan/README.md`, active `STATUS`/`WORKSET`, `apps/agent-service/src/runtime.ts`, `tests/agent-service-runtime.test.ts`, and `README.md` env table against H2 claims.
  - Review tightened oversized-body test to assert `service.handle` is not called for oversized bodies before service handling.
  - `pnpm test -- tests/agent-service-runtime.test.ts` passed: 20 files, 163 tests; boundary guard passed; eval ok=true passed=19 total=19.
  - Full review gate passed: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `git diff --check`; eval inside test passed ok=true passed=19 total=19.
  - No adapter DTO, streaming protocol, external framework, request body logging, or stack-trace exposure changes observed.
- H2 execute evidence:
  - `apps/agent-service/src/runtime.ts` adds `maxInboundBodyBytes` runtime config with `PMS_AGENT_MAX_BODY_BYTES` and default `262144` bytes.
  - HTTP body accumulation rejects oversized POST bodies with status `413` and safe refusal `{ type: "refusal", reason: "invalid_request", message: "Request body too large." }` before service handling.
  - `tests/agent-service-runtime.test.ts` covers default/explicit body limit config, oversized POST rejection, `/health`, and valid `/v1/feishu-turn` under the limit.
  - `README.md` documents `PMS_AGENT_MAX_BODY_BYTES`.
  - `pnpm build` passed.
  - `pnpm test` passed: 20 files, 163 tests; included boundary guard and eval ok=true passed=19 total=19.
  - `pnpm guard:boundaries` passed.
  - `git diff --check` passed.
- H1 execute evidence:
  - `scripts/boundary-guard.mjs` adds rule-table import-direction checks for documented forbidden package directions without external lint/parser dependencies.
  - `tests/boundary-guard.test.ts` covers denied imports for `pms-platform-client -> unified-agent`, `safety-gateway -> pms-platform-client`, `safety-gateway -> gated-tools`, `adapter-contracts -> agent-service`, and `workspace-core -> safety-gateway`.
  - `tests/boundary-guard.test.ts` preserves legacy module / old `replies[]` / compat-module coverage and adds allowed `unified-agent -> pms-platform-client` fixture.
  - `pnpm test -- tests/boundary-guard.test.ts` passed via repo test script: 20 files, 160 tests, boundary guard passed, eval ok=true passed=19 total=19.
  - `pnpm guard:boundaries` passed.
  - `git diff --check` passed.
- Pre-roadmap baseline from code-quality review: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` passed.
- Roadmap creation validation: `git diff --check -- docs/roadmap/ai-native-code-quality-hardening-roadmap.md` passed; `pnpm guard:boundaries` passed.

## Notes

- If this pack runs under extension autopilot, each phase ends with exactly one `autopilot_report`.
- Active-slice phases use `stepId` equal to `active_step`.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Use `done_when` / `stop_boundary` above instead of “ask whether to continue” as the normal continuation rule.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Transition FSM above is part of machine-compatible truth, not optional prose.
