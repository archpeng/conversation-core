# PMS Agent V2 Workspace Workbench Plan Control Plane

## Active Pack

- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_WORKSET.md`

## Current Active Slice

- `W0`

## Intended Handoff

- `execute-plan`

## Status

- Active parser pack: `pms-agent-workbench-w0-w2-v1-2026-05-06`
- Current active slice: `W0`
- Current active state: `READY`
- Next runnable phase: `execute`
- Latest closed pack: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`
- Latest closed state: `PACK_COMPLETE`
- Cold archive root: `docs/plan-archive/`

## Active Pack Files

- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_WORKSET.md`

## Parser Scope Contract

`docs/plan/` is the hot autopilot scheduling surface. Keep it small: this README plus the single active PLAN/STATUS/WORKSET triplet. Historical evidence and closed packs stay under `docs/plan-archive/`.

## Objective Boundary

This active pack implements only the first workspace/workbench foundation phase:

1. `W0`: write the workspace contract docs.
2. `W1`: implement `packages/workspace-core`.
3. `W2`: implement `packages/workspace-tools` and connect them to Safety Gateway.

Do not implement Context Builder, approved-skill injection, approval/promote/archive, daily sweep, Mem0/Zep/Graphiti, production DB/object storage, or broad tenant admin UI in this pack.

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` means implementation evidence is ready for same-slice `review`; it does not advance the active slice by itself.
- `review/completed` is the accepted-slice writeback point: mark the reviewed slice done, set the next stage as `Current Active Slice`, and set `Intended Handoff` from that next stage owner.
- `review/continue` keeps the same active slice and dispatches another bounded `execute` cycle.
- `needs_replan` dispatches `replan`; `blocked`/`failed` stop; `done` is reserved for full objective or `PACK_COMPLETE` closeout.
- `PACK_COMPLETE` with `Intended Handoff` `autopilot-closeout` is the only terminal parser state.
- Closeout is forbidden while `Current Active Slice` is any non-`PACK_COMPLETE` stage.

## Latest Closed Pack

Closed pack archive:

- `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_PLAN.md`
- `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_STATUS.md`
- `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_WORKSET.md`
- `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_CLOSEOUT.md`

Closed pack residuals remain post-MVP only: production deployment/secret runbook, live Feishu/PMS smoke with approved credentials, and durable production audit storage/retention.

## Control-Plane Mode

- Mode: `single-root-autopilot-compatible`
- Repo-local execution root: `/home/peng/dt-git/github/pms-agent-v2`
- Hot parser surface: `docs/plan/README.md`
- Cold archive: `docs/plan-archive/`
- Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`
- Source design seed: user-provided PMS Agent tenant workspace/workbench design, scoped down to W0-W2.
