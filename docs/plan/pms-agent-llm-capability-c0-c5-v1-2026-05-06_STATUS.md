# PMS Agent LLM Capability C0-C5 Status

Plan ID: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current State

- state: `ACTIVE`
- owner: `plan-creator`
- route: `PLAN -> EXEC -> REVIEW -> WRITEBACK -> NEXT_STAGE -> CLOSEOUT`
- workstream: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
- mode: `single-root-autopilot-compatible`
- design law: `Bitter Lesson-compatible agent architecture with safety-critical deterministic guardrails`

## Current Step

- active_step: `C0`
- mode: `ready_for_execute`

## Planned Stages

- [ ] `C0` typed-intent-slot-contract
- [ ] `C1` llm-gated-tool-planning
- [ ] `C2` structured-session-state
- [ ] `C3` context-builder-advisory-injection
- [ ] `C4` evidence-grounded-response-synthesis
- [ ] `C5` eval-capability-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Current Master Plan

- Current wave: `llm-capability-release`
- Current wave stage: `C0`
- Current wave stage state: `ACTIVE`
- Best next wave step to execute now: `C0 typed-intent-slot-contract`
- Objective boundary: release LLM ability through typed contracts, gated planning, structured state, authority-labeled context, evidence-grounded response, and eval pressure. Do not implement approval/promote/archive, production storage, daily sweep, raw tool exposure, or full admin proposal migration in this pack.

## Bitter Lesson Design Principles

1. Contract is interface, not intelligence: typed schemas define model outputs; they do not encode all business decisions.
2. LLM chooses among gated actions: model selects from visible gated manifest; runtime validates; Safety Gateway decides.
3. Context is retrieved and authority-labeled: advisory notes do not become facts.
4. PMS evidence is environment observation: current PMS facts come from `pms-platform`, not prompt/memory.
5. Eval creates selection pressure: eval results drive prompt/tool/context/schema iteration.

## Immediate Focus

### `C0`

- Owner: `unified-agent-contract`
- State: `ACTIVE`
- Priority: `critical`

目标：

- Define the minimal typed intent / slot extraction contract that lets LLM understanding become runtime-verifiable without encoding a full business workflow tree.

必须交付：

1. Typed intent frame / slot state / missing-slot / ambiguity/confidence contract under the dominant owner surface, expected to be `packages/unified-agent` unless current code proves a narrower contract location.
2. Runtime parser/validator entrypoint for model-produced intent frames.
3. Tests proving valid frames pass, invalid frames fail, and contract shape does not become keyword-rule intelligence.
4. Documentation or inline contract note that C0 is an interface, not the business brain.

done_when:

1. Intent/slot contract exists and is imported by runtime-facing tests.
2. Tests prove missing slots are represented structurally and one focused clarification can be derived without hardcoding full workflows.
3. Static review finds no broad keyword router or deterministic business decision tree introduced as C0 intelligence.
4. `pnpm build`, targeted tests, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If implementation needs broad regex/keyword routing to pass, stop and replan C0.
2. If the contract starts deciding Safety Gateway policy or PMS fact truth, stop and replan.
3. If C0 requires raw tool exposure or direct PMS calls, stop immediately.

必须避免：

1. Do not encode all booking workflows into schema enums/if-else logic.
2. Do not treat user claims or session memory as PMS facts.
3. Do not add generic NLU framework abstractions unless a failing test proves the need.

## Machine State

- active_step: `C0`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- latest_plan_summary: Created C0-C5 LLM capability release pack with Bitter Lesson-compatible principles and single-root parser-compatible active truth.
- latest_verification:
  - `plan_sync before creation returned no active plans in docs/plan.`
  - `workspace_scan before creation showed main branch clean with dirty_files=0.`
  - `Read docs/plan/README.md, AGENTS.md, docs/ARCHITECTURE_CONSTRAINTS.md, docs/WORKSPACE.md, and docs/MEMORY_BOUNDARY.md before creating the pack.`
  - `Hot parser surface previously contained only docs/plan/README.md.`

## Autopilot Transition Contract

- `wave_plan/completed` dispatches `execute` for the active stage.
- `execute/completed` dispatches same-stage `review`; do not advance the active slice during execute.
- `review/completed` is the accepted-stage writeback gate that updates README/STATUS/WORKSET to the next deterministic stage.
- `review/continue` keeps the same active stage for another execute cycle.
- `needs_replan` routes to `replan` and keeps parser truth honest.
- `blocked` or `failed` stop execution and preserve current active stage for repair.
- `done` is reserved for objective closeout only when active stage is `PACK_COMPLETE` and every non-deferred stage is done.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and no non-deferred C0-C5 stage remains.

## Recently Completed

- Foundation pack `pms-agent-workbench-w0-w2-v1-2026-05-06` is closed and archived.
- W0-W2 established workspace/memory SSOT, `workspace-core`, `workspace-tools`, and Safety Gateway tenant workspace capability support.

## Next Step

- Execute `C0` with `execute-plan`.

## Blockers

- None for C0 execution.

## Gate State

- C0: `ACTIVE`.
- C1: `QUEUED`.
- C2: `QUEUED`.
- C3: `QUEUED`.
- C4: `QUEUED`.
- C5: `QUEUED`.
- PACK_COMPLETE: `QUEUED`.

## Validation Shape

For active C0:

```bash
pnpm build
pnpm vitest run <targeted C0 tests>
pnpm guard:boundaries
git diff --check
```

Full-pack later gates add:

```bash
pnpm test
pnpm eval
plan_sync docs/plan
```

## Notes

- The pack is intentionally not a full residual cleanup pack.
- It mainly covers Context Builder, structured session/memory boundary, LLM gated planning, evidence response synthesis, and eval pressure.
- Full admin proposal migration, full proposal Eval Runner, Approval/Promote/Archive, Daily Sweep, and production storage remain residual successor work.
