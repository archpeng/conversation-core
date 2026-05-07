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

- active_step: `H1`
- mode: `ready_for_execution`

## Planned Stages

- [ ] `H1` import-boundary-guard
- [ ] `H2` http-body-size-limit
- [ ] `H3` pms-tool-public-content-minimization
- [ ] `H4` runtime-event-logging-default
- [ ] `PACK_COMPLETE` closeout-and-archive

## Immediate Focus

### `H1`

- Owner: `execute-plan`
- State: `READY`
- Priority: `highest`

目标：

- Add executable import-direction checks to `scripts/boundary-guard.mjs` so package plane rules are enforced by tests/CI instead of memory.

必须交付：

1. `scripts/boundary-guard.mjs` import-boundary rule table for architecture-forbidden directions.
2. Boundary tests covering denied and allowed directions.
3. Passing boundary guard on the current repo.

done_when:

1. Forbidden imports such as `safety-gateway -> pms-platform-client`, `pms-platform-client -> unified-agent`, and `adapter-contracts -> agent-service` fail with clear rule IDs.
2. Existing legacy module and old `replies[]` guard tests still pass.
3. `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass at minimum.

stop_boundary:

1. Stop if enforcing the rule requires a new lint framework or TypeScript plugin.
2. Stop if current code violates a documented architecture rule and cannot be fixed within H1 without runtime behavior changes.
3. Stop if the slice starts touching business runtime logic.

必须避免：

1. No generic linter framework.
2. No production runtime behavior changes.
3. No weakening legacy exclusion checks.

## Machine State

- active_step: `H1`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- source_roadmap: `docs/roadmap/ai-native-code-quality-hardening-roadmap.md`
- hot_parser_surface: `docs/plan/README.md`
- cold_archive_root: `docs/plan-archive/`

## Autopilot Transition Contract

- `execute/completed` dispatches same-slice `review`; do not advance `active_step` during execute.
- `review/completed` accepts the slice and performs deterministic docs/plan writeback to the next active stage.
- `review/continue` keeps `active_step` unchanged for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stop; `done` routes to closeout only when the whole objective is complete.
- After accepted review, `README`, `STATUS`, and `WORKSET` must agree on the new active slice and intended handoff before another execute phase runs.

## Recently Completed

- Previous active pack `pms-agent-platform-workflow-q1-q4-v1-2026-05-07` reached `PACK_COMPLETE` and was moved to cold archive for this successor pack.
- Roadmap `docs/roadmap/ai-native-code-quality-hardening-roadmap.md` was created as the source for H1-H4.

## Next Step

- `H1`

## Blockers

- None for planning.
- Working tree contains pre-existing uncommitted source/test changes; final commit must inspect and intentionally include or exclude them.

## Gate State

- Planning validation required before handoff:
  - `plan_sync docs/plan`
  - `git diff --check`
  - `pnpm guard:boundaries`

## Latest Evidence

- Pre-roadmap baseline from code-quality review: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` passed.
- Roadmap creation validation: `git diff --check -- docs/roadmap/ai-native-code-quality-hardening-roadmap.md` passed; `pnpm guard:boundaries` passed.

## Notes

- If this pack runs under extension autopilot, each phase ends with exactly one `autopilot_report`.
- Active-slice phases use `stepId` equal to `active_step`.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Use `done_when` / `stop_boundary` above instead of “ask whether to continue” as the normal continuation rule.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Transition FSM above is part of machine-compatible truth, not optional prose.
