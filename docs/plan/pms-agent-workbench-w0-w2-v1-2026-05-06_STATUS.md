# PMS Agent Workbench W0-W2 Status

Plan ID: `pms-agent-workbench-w0-w2-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current State

- state: `IN_PROGRESS`
- owner: `execute-plan`
- route: `PLAN -> EXEC -> REVIEW -> REPLAN -> CLOSEOUT`
- workstream: `pms-agent-workbench-w0-w2-v1-2026-05-06`
- mode: `single-root-autopilot-compatible`

## Current Step

- active_step: `W0`
- mode: `ready_for_execution`

## Planned Stages

- [ ] `W0` workspace-contract-docs
- [ ] `W1` workspace-core-store
- [ ] `W2` workspace-tools-safety-gated
- [ ] `PACK_COMPLETE` workbench-foundation-closeout

## Current Master Plan

- Current wave: `workspace-foundation`
- Current wave stage: `W0`
- Current wave stage state: `READY`
- Best next wave step to execute now: `W0`
- Objective boundary: only W0-W2. Do not start Context Builder, approval/promote/archive, daily sweep, production DB/object storage, or memory graph work in this pack.

### `W0` workspace-contract-docs

- Goal: write `docs/WORKSPACE.md` and `docs/MEMORY_BOUNDARY.md` as the implementation SSOT.
- Validation: docs include all seven hard boundaries; `pnpm build`; `pnpm test`; `pnpm guard:boundaries`; targeted static scans; `git diff --check`.
- Accepted-review next step: `W1`.

### `W1` workspace-core-store

- Goal: implement tenant filesystem workspace core with safe path handling, initialization, allowed reads/writes, and proposal completeness checks.
- Validation: `workspace-core` tests for init/path/security/proposal completeness; full build/test/guard; `git diff --check`.
- Accepted-review next step: `W2`.

### `W2` workspace-tools-safety-gated

- Goal: expose workspace operations as Safety-gated tools and prove profile/path/write/audit boundaries before side effects.
- Validation: `workspace-tools` tests plus full build/test/eval/guard; no direct Agent executor bypass; `git diff --check`.
- Accepted-review next step: `PACK_COMPLETE` only if no W0-W2 residual remains.

### `PACK_COMPLETE` workbench-foundation-closeout

- Goal: close and archive this plan only after W0-W2 accepted reviews prove all hard boundaries.
- Validation: closeout evidence, residual handoff, plan hygiene, `plan_sync`, `git diff --check`.
- Accepted-closeout writeback: archive completed pack under `docs/plan-archive/` and leave hot parser truth terminal/none according to repo convention.

## Immediate Focus

### `W0`

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Define the PMS Agent tenant workspace/workbench contract and memory boundary as repo-local SSOT before implementation.

必须交付：

1. `docs/WORKSPACE.md` with directory layout, file kinds, active/proposal/session/tmp/audit zones, tool permissions, path constraints, lifecycle, and W0-W2 package mapping.
2. `docs/MEMORY_BOUNDARY.md` with authority labels: `pms-platform` evidence as authority, Safety Gateway as mandatory, workspace memory/skills/session as advisory.
3. W0 validation evidence in tests/static scans or documented command output.

验证：

1. `pnpm build`
2. `pnpm test`
3. `pnpm guard:boundaries`
4. Static scan/review proving forbidden memory database terms are non-goals/boundaries, not implementation commitments.
5. `git diff --check`

done_when:

1. `docs/WORKSPACE.md` and `docs/MEMORY_BOUNDARY.md` exist and explicitly define all seven hard boundaries.
2. Docs state that PMS current facts are never stored as workspace truth and must be re-read/cited from `pms-platform` evidence.
3. Docs state active/proposal/session/tmp/audit write/read ownership and W0-W2 package boundaries.
4. Validation commands complete or any skipped verification is justified as not applicable to docs-only changes.

stop_boundary:

1. Stop if documentation requires deciding approval/promote UX, DB/object storage, Context Builder injection, or long-term memory graph semantics.
2. Stop if any doc implies workspace memory can answer current PMS fact questions.
3. Stop if scope expands into implementation before W0 docs are review-accepted.

必须避免：

1. Do not implement packages in W0 unless a tiny test/doc guard is already repo-standard and necessary.
2. Do not add Mem0/Zep/Graphiti or generic memory DB commitments.
3. Do not weaken existing Safety Gateway or PMS evidence laws.

## Machine State

- active_step: `W0`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- latest_closeout_summary: `none`
- latest_verification:
  - `Plan pack creation only; implementation validation pending W0 execute/review.`

## Autopilot Transition Contract

- `execute/completed` dispatches same-slice `review`; do not advance `active_step` during execute.
- `review/completed` accepts the slice and performs deterministic docs/plan writeback to the next active stage.
- `review/continue` keeps `active_step` unchanged for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stop; `done` routes to closeout only when the whole objective is complete and active_step is `PACK_COMPLETE`.
- After accepted review, `README`, `STATUS`, and `WORKSET` must agree on the new active slice and intended handoff before another execute phase runs.

## Recently Completed

- MVP pack `pms-agent-v2-ai-native-mvp-v1-2026-05-06` is closed and archived.
- Current W0-W2 plan pack was created from the tenant workspace/workbench design and current repo reality.

## Next Step

- `W0`

## Blockers

- None for W0.

## Gate State

- W0: `READY`
- W1: `queued`, blocked on W0 accepted review.
- W2: `queued`, blocked on W1 accepted review.
- PACK_COMPLETE: `queued`, blocked on W0-W2 accepted reviews.

## Latest Evidence

1. Current repo has no active plan before this pack; `docs/plan/README.md` previously stated active parser pack `none`.
2. Current MVP code already has Safety Gateway, gated tools, redacted session continuity, proposal workspace proof, and PMS evidence boundary.
3. Current repo does not yet have `docs/WORKSPACE.md`, `docs/MEMORY_BOUNDARY.md`, `packages/workspace-core`, or `packages/workspace-tools`.

## Notes

- If this pack runs under extension autopilot, each phase ends with exactly one `autopilot_report`.
- Active-slice phases use `stepId` equal to `active_step`.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Use `done_when` / `stop_boundary` above instead of “ask whether to continue” as the normal continuation rule.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Transition FSM above is part of machine-compatible truth, not optional prose.
