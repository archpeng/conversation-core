# PMS Agent LLM Planner Runtime R0-R3 Status

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current State

- state: `ACTIVE`
- owner: `execute-plan`
- route: `PLAN -> EXEC -> REVIEW -> WRITEBACK -> NEXT_STAGE -> CLOSEOUT`
- workstream: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
- mode: `single-root-autopilot-compatible`
- design law: `LLM-first planner-primary runtime with deterministic safety/evidence guardrails`

## Current Step

- active_step: `PACK_COMPLETE`
- mode: `ready_for_closeout`
- owner: `autopilot-closeout`
- state: `READY`

## Planned Stages

- [x] `R0` gpt55-and-tool-plan-output-contract
- [x] `R1` live-parse-execute-tool-plan-integration
- [x] `R2` shrink-deterministic-loop-scaffold
- [x] `R3` planner-primary-eval-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Current Master Plan

- Current wave: `llm-planner-runtime-release`
- Current wave stage: `PACK_COMPLETE`
- Current wave stage state: `READY`
- Best next wave step to execute now: `PACK_COMPLETE closeout-and-archive`
- Objective boundary: make the live PMS agent runtime use GPT-5.5 and promote the C1 typed LLM tool-plan contract into the primary execution path. Keep Safety Gateway, PMS evidence, response synthesis, profile-visible tools, and approval-card boundaries deterministic.

## Bitter Lesson Design Principles

1. Contract is interface, not intelligence: schemas constrain model output without encoding the business brain.
2. LLM chooses among gated actions: model selects from visible gated manifest; runtime validates; Safety Gateway decides.
3. Context is authority-labeled: advisory context improves observation without becoming PMS fact authority.
4. PMS evidence is environment observation: current PMS facts come from `pms-platform`, not memory or LLM guesses.
5. Eval creates selection pressure: planner-primary regressions must fail `pnpm eval`.

## Immediate Focus

### `PACK_COMPLETE`

- Owner: `autopilot-closeout`
- State: `QUEUED`
- Priority: `terminal`

目标：

- Close and archive the R0-R3 planner-runtime pack after accepted reviews prove GPT-5.5 configuration, planner-primary execution, loop shrink, and eval pressure.

必须交付：

1. Closeout artifact summarizing R0-R3 deliverables, Bitter Lesson compliance, validation evidence, and residuals.
2. Hot/cold plan hygiene: completed pack archived under `docs/plan-archive/`; `docs/plan/README.md` reset to no active pack.
3. Residual handoff for production Feishu/GPT-5.5 latency hardening if not fully proven.

done_when:

1. R0-R3 are accepted by review and marked done.
2. Final validation passes: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, `plan_sync`, and `git diff --check`.
3. Closeout artifact records evidence and residual handoff.
4. Hot parser surface contains only allowed active/no-active parser files after archive.

stop_boundary:

1. If any R0-R3 slice remains active, queued, failed, or needs review, hand back to that slice.
2. If final runtime violates LLM-first by making deterministic loops primary, closeout is forbidden.
3. If Safety Gateway is no longer the unique execution boundary, closeout is forbidden.

必须避免：

1. Do not claim production live Feishu stability if only local eval/runtime tests passed.
2. Do not archive before parser truth and closeout evidence are aligned.
3. Do not hide GPT-5.5 model-resolution or latency residuals.
## Machine State

- active_step: `PACK_COMPLETE`
- latest_completed_step: `R3`
- intended_handoff: `autopilot-closeout`
- latest_closeout_summary: R3 accepted; parser truth advanced to PACK_COMPLETE closeout.
- latest_verification:
  - `Re-read docs/plan README/STATUS/WORKSET: active slice was R3 IMPLEMENTED and claimed planner-primary eval pressure.`
  - `Re-read packages/evals/src/index.ts: evalCases includes llm-plan-pms-read-grounded, llm-plan-raw-tool-rejected, llm-plan-non-visible-tool-rejected, llm-plan-natural-confirm-no-mutation, llm-fact-text-requires-evidence, and llm-plan-before-keyword-fallback.`
  - `R3 evals assert LLM prompt observation, evidenceRefs from pms-platform evidence, raw bash/non-visible proposal rejection before audit/executor, confirm require_approval/no mutation, unevidenced fact-text refusal, and no pms_workflow fallback for a booking keyword when a valid LLM read plan exists.`
  - `Re-read session.ts/tool-plan.ts: runAgentTurn prompts the LLM before fallback; parseToolPlan validates the visible manifest; raw/non-visible plans return refusals; executeToolPlan preserves Safety Gateway require_approval/no-mutation behavior.`
  - `Validation passed: pnpm build && node packages/evals/dist/index.js && pnpm guard:boundaries && git diff --check.`
  - `Validation passed: pnpm test (20 files, 136 tests; boundary guard; pnpm eval ok=true passed=19 total=19 auditEvents=16).`
  - `Writeback completed: docs/plan parser truth advanced to PACK_COMPLETE / autopilot-closeout; plan_sync shows R0-R3 checked done and PACK_COMPLETE pending.`
  - `packages/evals/src/index.ts`
  - `packages/unified-agent/src/session.ts`
  - `packages/unified-agent/src/tool-plan.ts`
  - `docs/plan/README.md`
  - `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_STATUS.md`
  - `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_WORKSET.md`
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

- R3 reviewed and accepted: planner-primary eval pressure covers valid LLM read plans, raw/non-visible tool rejection before audit/executor, approval-required confirm/no mutation, unevidenced PMS fact text rejection, and deterministic keyword bypass protection.
- R2 execute implementation completed: deterministic customer/admin loops are reached through an explicitly named legacy safety scaffold after LLM observation and no structured plan, and targeted tests prove planner-first behavior over keyword fallback.
- R0 reviewed and accepted: GPT-5.5 model override docs/config, visible `model_not_resolved` failure path, profile-visible prompt manifest, raw-tool exclusion, and JSON-only `ToolPlanAction` contract are evidence-backed.
- Closed pack `pms-agent-llm-capability-c0-c5-v1-2026-05-06` released typed intent, gated tool-plan contract, structured session state, authority-labeled context, evidence-grounded response synthesis, and eval pressure.
- LLM-first runtime law has been added to `AGENTS.md` and `docs/ARCHITECTURE_CONSTRAINTS.md`.

## Next Step

- Run `PACK_COMPLETE` through the repo-local closeout prompt surface.

## Blockers

- None for closeout. R0 resolved `openai/gpt-5.5` through the Pi SDK dependency used by `apps/agent-service`.

## Gate State

- R0: `ACCEPTED`.
- R1: `ACCEPTED`.
- R2: `ACCEPTED`.
- R3: `ACCEPTED`.
- PACK_COMPLETE: `READY`.

## Validation Shape

For active R3:

```bash
pnpm test
pnpm eval
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
