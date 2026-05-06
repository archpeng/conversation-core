# PMS Agent LLM Planner Runtime R0-R3 Workset

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`

## Stage Order

- [ ] `R0` gpt55-and-tool-plan-output-contract
- [ ] `R1` live-parse-execute-tool-plan-integration
- [ ] `R2` shrink-deterministic-loop-scaffold
- [ ] `R3` planner-primary-eval-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Active Stage

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

## Completed Stage Evidence

- No R0-R3 stage has been executed yet.

## Slice Ownership

### `R0`

Expected owner surfaces:

- `.env` only for local intended model override if this repo intentionally tracks it.
- `README.md` runtime env docs.
- `apps/agent-service/src/runtime.ts` only if model-resolution visibility needs code support.
- `packages/unified-agent/src/session.ts` or a new planner-prompt helper for visible manifest + JSON contract.
- `tests/unified-agent.test.ts` or targeted planner prompt tests.

Forbidden owner drift:

- Do not modify Safety Gateway policy for R0.
- Do not call PMS directly from prompt-building code.
- Do not expose raw tools to LLM.

### `R1`

Expected owner surfaces:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/tool-plan.ts` only for narrowly missing helpers.
- `packages/unified-agent/src/response-synthesis.ts` only for evidence-result synthesis gaps.
- `tests/tool-plan.test.ts`, `tests/unified-agent.test.ts`, or new targeted runtime tests.

Forbidden owner drift:

- Do not bypass registered gated Pi tools.
- Do not weaken `AgentResult` or add old `replies[]` compatibility.
- Do not change PMS Platform contracts unless current client evidence shape is insufficient and proven.

### `R2`

Expected owner surfaces:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/customer-loop.ts`
- `packages/unified-agent/src/proposal-loop.ts`
- Targeted tests proving loop fallback/shrink semantics.

Forbidden owner drift:

- Do not delete approval/evidence guardrails.
- Do not make deterministic loops primary again under a new name.
- Do not hide invalid LLM plans behind successful deterministic workflow claims.

### `R3`

Expected owner surfaces:

- `packages/evals/src/index.ts`
- tests only as needed to support eval fixtures.

Forbidden owner drift:

- Do not use production PMS credentials or live mutation.
- Do not make evals pass by relaxing safety/evidence assertions.
- Do not count old deterministic happy paths as planner-primary proof.

## Work Packages

### `R0` workset — gpt55-and-tool-plan-output-contract

执行步骤：

1. Inspect current `.env`, README runtime docs, and `createRuntimePiSessionFactory(...)` model-resolution behavior.
2. Configure intended model to `openai/gpt-5.5` through the narrowest existing surface.
3. Add or document a runtime-visible failure path if `ModelRegistry.find("openai", "gpt-5.5")` is unresolved.
4. Add prompt helper that injects `buildVisibleGatedToolManifest(profile, tools)` into the LLM prompt.
5. Add explicit JSON-only `ToolPlanAction` output contract to the prompt.
6. Add targeted tests proving customer/admin prompt manifests are profile-visible only, raw tools are absent, and JSON plan instructions are present.
7. Run R0 validation.

预期：

- LLM receives a safe action space and a structured plan contract before any runtime plan execution changes.

测试预期：

- Prompt tests fail if raw tools appear or if JSON tool-plan instructions disappear.

### `R1` workset — live-parse-execute-tool-plan-integration

执行步骤：

1. Extract assistant output as a strict tool-plan JSON candidate.
2. Build visible manifest for the active profile.
3. Run `parseToolPlan(...)` before deterministic loop scaffold.
4. For valid plans, run `executeToolPlan(...)` against registered tools.
5. Convert non-call plan results directly into safe `AgentResult`.
6. For successful PMS evidence tool calls, remember refs and synthesize evidence-grounded text/card as appropriate.
7. Add tests for valid PMS read, approval-required confirm, invalid raw/non-visible tool, and no executor on denied/approval-required decisions.
8. Run full validation.

预期：

- The live path becomes `assistant plan -> parseToolPlan -> executeToolPlan -> remember refs -> synthesize response`.

测试预期：

- Runtime tests fail if LLM plan is ignored while deterministic loop succeeds.

### `R2` workset — shrink-deterministic-loop-scaffold

执行步骤：

1. Rename or wrap deterministic loop invocation to make fallback/scaffold semantics explicit.
2. Ensure valid LLM tool plans never enter deterministic PMS action selection.
3. Ensure invalid/non-actionable plans produce safe refusal/clarification/minimal compatibility without pretending planner success.
4. Preserve natural-language confirm approval boundary.
5. Preserve PMS evidence requirement.
6. Add regression tests proving keyword text cannot bypass LLM plan observation.
7. Run full validation.

预期：

- Deterministic loops are no longer the hidden business brain.

测试预期：

- Tests fail if `customer-loop.ts` executes before LLM plan parsing for normal turns.

### `R3` workset — planner-primary-eval-pressure

执行步骤：

1. Add eval fixture/session that emits valid `gated_pms_read` plan and proves evidence-grounded result.
2. Add raw `bash` plan eval and assert pre-executor rejection.
3. Add customer non-visible admin/proposal tool plan eval and assert rejection.
4. Add natural-confirm plan eval and assert approval-required/no mutation.
5. Add PMS fact text eval and assert evidence refs are required.
6. Add deterministic-keyword bypass eval and assert LLM prompt/plan path was observed before any PMS action.
7. Run full validation including `pnpm eval`.

预期：

- Eval becomes selection pressure for planner-primary runtime behavior.

测试预期：

- `pnpm eval` fails if runtime regresses to deterministic keyword-first routing.

### `PACK_COMPLETE` workset — closeout-and-archive

执行步骤：

1. Confirm accepted reviews for R0-R3 are reflected in README/STATUS/WORKSET.
2. Run final validation.
3. Write closeout artifact with Bitter Lesson compliance and residual handoff.
4. Archive completed pack and reset hot parser surface.

预期：

- Planner-runtime pack closes only after GPT-5.5 configuration, planner-primary runtime, loop shrink, and eval pressure are accepted.

测试预期：

- `plan_sync` sees terminal/no-active truth after archive.

## Machine Queue

- active_step: `R0`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- latest_closeout_summary: Planner-runtime pack created; R0 ready for execution.
- latest_verification:
  - `Read package-owned plan-creator skill, autopilot control-plane reference/templates, AGENTS.md, docs/ARCHITECTURE_CONSTRAINTS.md, docs/plan/README.md, package.json, session.ts, tool-plan.ts, agent-service runtime.ts, and current model env/docs.`
  - `Confirmed no active docs/plan pack existed before creation; previous C0-C5 pack is archived and closed.`
  - `Detected current .env model override PMS_AGENT_PI_MODEL_PROVIDER=openai and PMS_AGENT_PI_MODEL_ID=deepseek-v4-flash; R0 must change intended runtime model to gpt-5.5 with model-resolution proof.`
  - `Created single-root autopilot-compatible PLAN/STATUS/WORKSET/README for R0-R3 planner-primary runtime migration.`
