# PMS Agent V2 Plan Control Plane

## Active Pack

- `pms-agent-llm-capability-c0-c5-v1-2026-05-06`

## Current Active Slice

- `C0`

## Intended Handoff

- `execute-plan`

## Status

- Active parser pack: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
- Current active slice: `C0`
- Current active state: `ACTIVE`
- Next runnable phase: `execute`
- Latest closed pack: `pms-agent-workbench-w0-w2-v1-2026-05-06`
- Latest closed state: `PACK_COMPLETE`
- Cold archive root: `docs/plan-archive/`

## Active Pack Files

- `docs/plan/pms-agent-llm-capability-c0-c5-v1-2026-05-06_PLAN.md`
- `docs/plan/pms-agent-llm-capability-c0-c5-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-llm-capability-c0-c5-v1-2026-05-06_WORKSET.md`

## Active Pack Summary

Goal:

- Release LLM capability through typed intent, gated planning, structured session state, authority-labeled context, evidence-grounded response synthesis, and eval pressure without granting naked tools or weakening Safety Gateway.

Active slice:

- `C0` typed-intent-slot-contract

Bitter Lesson-compatible design laws:

1. Contract is interface, not intelligence.
2. LLM chooses among gated actions.
3. Context is retrieved and authority-labeled.
4. PMS evidence is environment observation.
5. Eval creates selection pressure.

Continuous ladder:

```text
C0 -> C1 -> C2 -> C3 -> C4 -> C5 -> PACK_COMPLETE
```

## Latest Closed Pack

Closed pack archive:

- `docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/pms-agent-workbench-w0-w2-v1-2026-05-06_PLAN.md`
- `docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/pms-agent-workbench-w0-w2-v1-2026-05-06_STATUS.md`
- `docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/pms-agent-workbench-w0-w2-v1-2026-05-06_WORKSET.md`
- `docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/pms-agent-workbench-w0-w2-v1-2026-05-06_CLOSEOUT.md`

Closed pack result:

- W0 workspace/memory boundary docs accepted.
- W1 `packages/workspace-core` accepted.
- W2 `packages/workspace-tools` plus Safety Gateway workspace capability support accepted.
- W0-W2 first-phase hard boundaries proven by docs, tests, build, guard, eval, and review evidence.

Residuals for successor packs not claimed by the active C-pack:

- Full Skill Proposal Flow hardening and admin runtime migration to `workspace_*` tools
- Full proposal Eval Runner with persisted `evals/{runId}/` outputs
- Approval/Promote/Archive
- Daily Sweep
- production DB/object storage

## Parser Scope Contract

`docs/plan/` is the hot autopilot scheduling surface. Keep it small: this README plus at most one active PLAN/STATUS/WORKSET triplet. Historical evidence and closed packs stay under `docs/plan-archive/`.

## Control-Plane Mode

- Mode: `single-root-autopilot-compatible`
- Repo-local execution root: `/home/peng/dt-git/github/pms-agent-v2`
- Hot parser surface: `docs/plan/README.md`
- Cold archive: `docs/plan-archive/`
- Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`
