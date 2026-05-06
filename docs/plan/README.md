# PMS Agent V2 Plan Control Plane

## Active Pack

- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_WORKSET.md`

## Current Active Slice

- `R0`

## Intended Handoff

- `execute-plan`

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` means implementation evidence is ready for same-slice `review`; it does not advance the active slice by itself.
- `review/completed` is the accepted-slice writeback point: mark the reviewed slice done, set the next stage as `Current Active Slice`, and set `Intended Handoff` from that next stage owner.
- `review/continue` keeps the same active slice and dispatches another bounded `execute` cycle.
- `needs_replan` dispatches `replan`; `blocked`/`failed` stop; `done` is reserved for full objective or `PACK_COMPLETE` closeout.
- `PACK_COMPLETE` with `Intended Handoff` `autopilot-closeout` is the only terminal parser state.
- `currentWave/maxWaves`, human wave numbering, and closeout prose are not completion proof; closeout is forbidden while `Current Active Slice` is any non-`PACK_COMPLETE` stage.

## Status

- Active parser pack: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
- Current active slice: `R0`
- Current active state: `READY`
- Next runnable phase: `execute`
- Latest closed pack: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
- Latest closed state: `PACK_COMPLETE`
- Cold archive root: `docs/plan-archive/`

## Active Pack Files

- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_WORKSET.md`

## Active Pack Summary

Goal:

- Make the live PMS agent runtime use GPT-5.5 and promote the C1 typed LLM tool-plan contract into the primary execution path while preserving deterministic Safety Gateway, PMS evidence, approval-card, and response-synthesis guardrails.

Active slice:

- `R0` gpt55-and-tool-plan-output-contract

Bitter Lesson-compatible design laws:

1. Contract is interface, not intelligence.
2. LLM chooses among gated actions.
3. Context is authority-labeled.
4. PMS evidence is environment observation.
5. Eval creates selection pressure.
6. Deterministic code owns safety/evidence validation, not business intelligence.

Continuous ladder:

```text
R0 -> R1 -> R2 -> R3 -> PACK_COMPLETE
```

## Latest Closed Pack

Closed pack archive:

- `docs/plan-archive/pms-agent-llm-capability-c0-c5-v1-2026-05-06/`

Closed pack result:

- C0 typed intent/slot frame contract accepted.
- C1 visible gated tool-planning contract accepted.
- C2 redacted structured session state accepted.
- C3 authority-labeled context builder accepted.
- C4 evidence-grounded response synthesis accepted.
- C5 eval capability pressure accepted.

Residuals now targeted by this active R-pack:

- Deeper live LLM planner integration replacing remaining deterministic customer-loop heuristics where future ownership is clear.

Residuals still not claimed by this active R-pack:

- Full admin proposal runtime migration to `workspace_*` tools
- Full proposal Eval Runner with persisted `evals/{runId}/` outputs
- Approval/Promote/Archive
- Daily Sweep
- production DB/object storage
- production credential/live PMS mutation validation

## Parser Scope Contract

`docs/plan/` is the hot autopilot scheduling surface. Keep it small: this README plus at most one active PLAN/STATUS/WORKSET triplet. Historical evidence and closed packs stay under `docs/plan-archive/`.

## Control-Plane Mode

- Mode: `single-root-autopilot-compatible`
- Repo-local execution root: `/home/peng/dt-git/github/pms-agent-v2`
- Hot parser surface: `docs/plan/README.md`
- Cold archive: `docs/plan-archive/`
- Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`
