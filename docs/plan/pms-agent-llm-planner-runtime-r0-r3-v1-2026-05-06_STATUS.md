# PMS Agent LLM Planner Runtime R0-R3 Status

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current State

- state: `ACTIVE`
- owner: `plan-creator`
- route: `PLAN -> EXEC -> REVIEW -> WRITEBACK -> NEXT_STAGE -> CLOSEOUT`
- workstream: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
- mode: `single-root-autopilot-compatible`
- design law: `LLM-first planner-primary runtime with deterministic safety/evidence guardrails`

## Current Step

- active_step: `R0`
- mode: `ready_for_execute`
- owner: `execute-plan`
- state: `READY`

## Planned Stages

- [ ] `R0` gpt55-and-tool-plan-output-contract
- [ ] `R1` live-parse-execute-tool-plan-integration
- [ ] `R2` shrink-deterministic-loop-scaffold
- [ ] `R3` planner-primary-eval-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Current Master Plan

- Current wave: `llm-planner-runtime-release`
- Current wave stage: `R0`
- Current wave stage state: `READY`
- Best next wave step to execute now: `R0 gpt55-and-tool-plan-output-contract`
- Objective boundary: make the live PMS agent runtime use GPT-5.5 and promote the C1 typed LLM tool-plan contract into the primary execution path. Keep Safety Gateway, PMS evidence, response synthesis, profile-visible tools, and approval-card boundaries deterministic.

## Bitter Lesson Design Principles

1. Contract is interface, not intelligence: schemas constrain model output without encoding the business brain.
2. LLM chooses among gated actions: model selects from visible gated manifest; runtime validates; Safety Gateway decides.
3. Context is authority-labeled: advisory context improves observation without becoming PMS fact authority.
4. PMS evidence is environment observation: current PMS facts come from `pms-platform`, not memory or LLM guesses.
5. Eval creates selection pressure: planner-primary regressions must fail `pnpm eval`.

## Immediate Focus

### `R0`

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Configure the runtime to request GPT-5.5 through Pi model override surfaces and make the LLM prompt produce a structured tool-plan contract rather than unstructured assistant text for actionable turns.

必须交付：

1. `.env` / runtime documentation updated so `PMS_AGENT_PI_MODEL_PROVIDER=openai` and `PMS_AGENT_PI_MODEL_ID=gpt-5.5` are the intended live model override.
2. Startup/runtime evidence path added or documented so model resolution failure is visible instead of silently falling back.
3. `packages/unified-agent` prompt surface includes the visible gated tool manifest and an explicit JSON-only tool-plan output contract.
4. Tests prove the generated turn prompt contains profile-visible gated tools, excludes raw tools, and asks for a parseable tool plan.

done_when:

1. GPT-5.5 is the configured intended runtime model ID, or a blocking `model_not_resolved` proof is recorded without falling back silently.
2. LLM prompt contract exposes only profile-visible gated tools and demands structured `ToolPlanAction` JSON for actionable turns.
3. Raw tools such as `bash`, `read`, `write`, `edit`, `http`, and `http_request` are absent from the LLM plan manifest.
4. `pnpm build`, targeted prompt tests, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If Pi `ModelRegistry` cannot resolve `openai/gpt-5.5`, stop and report the exact mismatch; do not silently use the old model.
2. If the prompt contract requires exposing raw tools or PMS executors directly, stop and replan.
3. If prompt-only policy would replace runtime validation or Safety Gateway, stop.

必须避免：

1. Do not use deterministic keyword routing as the plan contract.
2. Do not claim GPT-5.5 is active without runtime/model-resolution evidence.
3. Do not broaden visible tools beyond profile policy.

## Machine State

- active_step: `R0`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- latest_closeout_summary: Planner-runtime pack created; R0 ready for execution.
- latest_verification:
  - `Read package-owned plan-creator skill, autopilot control-plane reference/templates, AGENTS.md, docs/ARCHITECTURE_CONSTRAINTS.md, docs/plan/README.md, package.json, session.ts, tool-plan.ts, agent-service runtime.ts, and current model env/docs.`
  - `Confirmed no active docs/plan pack existed before creation; previous C0-C5 pack is archived and closed.`
  - `Detected current .env model override PMS_AGENT_PI_MODEL_PROVIDER=openai and PMS_AGENT_PI_MODEL_ID=deepseek-v4-flash; R0 must change intended runtime model to gpt-5.5 with model-resolution proof.`
  - `Created single-root autopilot-compatible PLAN/STATUS/WORKSET/README for R0-R3 planner-primary runtime migration.`

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` dispatches same-stage `review`; do not advance the active slice during execute.
- `review/completed` is the accepted-stage writeback gate that updates README/STATUS/WORKSET to the next deterministic stage.
- `review/continue` keeps the same active stage for another execute cycle.
- `needs_replan` routes to `replan` and keeps parser truth honest.
- `blocked` or `failed` stop execution and preserve current active stage for repair.
- `done` is reserved for objective closeout only when active stage is `PACK_COMPLETE` and every non-deferred stage is done.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and no non-deferred R0-R3 stage remains.

## Recently Completed

- Closed pack `pms-agent-llm-capability-c0-c5-v1-2026-05-06` released typed intent, gated tool-plan contract, structured session state, authority-labeled context, evidence-grounded response synthesis, and eval pressure.
- LLM-first runtime law has been added to `AGENTS.md` and `docs/ARCHITECTURE_CONSTRAINTS.md`.

## Next Step

- Execute `R0` with `execute-plan`.

## Blockers

- None for planning. R0 must verify whether Pi `ModelRegistry` resolves `openai/gpt-5.5` before claiming runtime model activation.

## Gate State

- R0: `READY`.
- R1: `QUEUED`.
- R2: `QUEUED`.
- R3: `QUEUED`.
- PACK_COMPLETE: `QUEUED`.

## Validation Shape

For active R0:

```bash
pnpm build
pnpm vitest run <targeted planner prompt tests>
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

- This pack intentionally targets the live LLM-planner primary path, not a broad product rewrite.
- Deterministic safety boundaries stay mandatory; deterministic business intelligence must shrink.
- If GPT-5.5 cannot be resolved locally, do not proceed by silently using another model.
