# PMS Agent V2 Plan Control Plane

## Active Pack

- `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_PLAN.md`
- `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_STATUS.md`
- `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_WORKSET.md`

## Current Active Slice

- `H1`

## Intended Handoff

- `execute-plan`

## Status

- Active parser pack: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`
- Current active slice: `H1`
- Current active state: `READY`
- Next runnable phase: `execute-plan`
- Latest closed pack: `pms-agent-platform-workflow-q1-q4-v1-2026-05-07`
- Latest closed state: `PACK_COMPLETE`
- Cold archive root: `docs/plan-archive/`
- Source roadmap: `docs/roadmap/ai-native-code-quality-hardening-roadmap.md`

## Latest Closed Pack

Closed pack archive:

- `docs/plan-archive/pms-agent-platform-workflow-q1-q4-v1-2026-05-07/`

Closed pack result:

- `gated_pms_workflow` runtime consumes typed PMS Platform route sequences for single-room and group-draft prepare-confirm workflows.
- PMS availability evidence remains authoritative for room selection; bounded plans cannot submit factual room IDs directly.
- Multi-room prepare-confirm uses `reservation-group-drafts/*` routes and stops before final reservation creation.
- Confirm/cancel remain adapter typed-card callback concerns; natural language does not execute PMS mutations.

Successor roadmap:

- `docs/roadmap/ai-native-code-quality-hardening-roadmap.md`

## Parser Scope Contract

`docs/plan/` is the hot autopilot scheduling surface. Keep it small: this README plus exactly one active PLAN/STATUS/WORKSET triplet. Historical evidence and closed packs stay under `docs/plan-archive/`.

Active execution pack:

- PLAN: `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_PLAN.md`
- STATUS: `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_STATUS.md`
- WORKSET: `docs/plan/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_WORKSET.md`

## Control-Plane Mode

- Mode: `single-root-autopilot-compatible`
- Repo-local execution root: `/home/peng/dt-git/github/pms-agent-v2`
- Hot parser surface: `docs/plan/README.md`
- Cold archive: `docs/plan-archive/`
- Source roadmap: `docs/roadmap/ai-native-code-quality-hardening-roadmap.md`

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` means implementation evidence is ready for same-slice `review`; it does not advance the active slice by itself.
- `review/completed` is the accepted-slice writeback point: mark the reviewed slice done, set the next `Stage Order` item as `Current Active Slice`, and set `Intended Handoff` from that next stage owner.
- `review/continue` keeps the same active slice and dispatches another bounded `execute` cycle.
- `needs_replan` dispatches `replan`; `blocked`/`failed` stop; `done` is reserved for full objective or `PACK_COMPLETE` closeout.
- `PACK_COMPLETE` with `Intended Handoff` `autopilot-closeout` is the only terminal parser state.
- Closeout is forbidden while `Current Active Slice` is any non-`PACK_COMPLETE` stage.
