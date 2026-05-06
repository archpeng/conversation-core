# PMS Agent V2 MVP Plan Control Plane

## Status

- Active parser pack: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`
- Current active slice: `P2`
- Current active state: `READY`
- Next runnable phase: `execute-plan`
- Latest completed slice: `P1A`
- Cold archive root: `docs/plan-archive/`

## Active Pack Files

- `docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_WORKSET.md`

## Control-Plane Mode

- Mode: `single-root-autopilot-compatible`
- Repo-local execution root: `/home/peng/dt-git/github/pms-agent-v2`
- Hot parser surface: `docs/plan/README.md` plus the active `PLAN/STATUS/WORKSET` triplet above.
- Cold archive: `docs/plan-archive/` for superseded evidence, closeout ledgers, and non-active history if created later.
- Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`.
- Migration note: this active pack moved from `conversation-core/docs/plan/` into this repo on 2026-05-06; future execution should start from `pms-agent-v2`.

## Parser Scope Contract

`docs/plan/` is the hot autopilot scheduling surface. Keep it small. Read archived pack files only when the user asks for history/evidence or when a new plan explicitly cites them.

## Non-Negotiable Execution Laws

1. No legacy `ai-conversation` compatibility in `pms-agent-v2`.
2. No `ai-pms` fallback, no `pi-agent-core` hot path, no V1/V2 dual route.
3. Agent sees only gated tools; every executor goes through Safety Gateway first.
4. PMS facts come only from current `pms-platform` evidence envelopes.
5. Natural-language PMS mutation is forbidden; high-risk actions are proposal / approval first.
6. MVP uses the smallest sufficient code; do not add frameworks, plugins, routers, abstractions, or config unless a planned validation requires them.
7. Review phase must delete all slice-created redundant code, compatibility code, stale comments, unused types, and dead paths before accepting the slice.

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` means implementation evidence is ready for same-slice `review`; it does not advance the active slice by itself.
- `review/completed` is the accepted-slice writeback point: mark the reviewed slice done, set the next Stage Order item as `Current Active Slice`, and set `Intended Handoff` from that next stage owner.
- `review/continue` keeps the same active slice and dispatches another bounded `execute` cycle.
- `needs_replan` dispatches `replan`; `blocked`/`failed` stop.
- `done` is reserved for full objective completion or `PACK_COMPLETE` closeout.
- `PACK_COMPLETE` with `Intended Handoff` `autopilot-closeout` is the only terminal parser state.
- Closeout is forbidden while `Current Active Slice` is any non-`PACK_COMPLETE` stage.

## Active Objective

Create and validate the new AI-native PMS Agent MVP with a minimal monorepo, strong `pi-coding-agent` runtime, Safety Gateway, gated tools, PMS evidence grounding, Feishu adapter contract alignment, proposal workspace, sandbox execution, audit, and evals.
