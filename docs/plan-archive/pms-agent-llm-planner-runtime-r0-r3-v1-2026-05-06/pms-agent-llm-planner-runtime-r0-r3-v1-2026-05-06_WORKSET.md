# PMS Agent LLM Planner Runtime R0-R3 Workset

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`

## Stage Order

- [x] `R0` gpt55-and-tool-plan-output-contract
- [x] `R1` live-parse-execute-tool-plan-integration
- [x] `R2` shrink-deterministic-loop-scaffold
- [x] `R3` planner-primary-eval-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Active Stage

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
## Completed Stage Evidence

- R3 reviewed and accepted: planner-primary eval pressure covers valid LLM read plans, raw/non-visible tool rejection before audit/executor, approval-required confirm/no mutation, unevidenced PMS fact text rejection, and deterministic keyword bypass protection.
- R3 review validation passed: `pnpm build`; `node packages/evals/dist/index.js`; `pnpm guard:boundaries`; `git diff --check`; `pnpm test` including `pnpm eval` with `ok=true passed=19 total=19 auditEvents=16`.
- Parser truth advanced to `PACK_COMPLETE` / `autopilot-closeout`; repo-local closeout remains required before terminal state.
- R3 execute implementation completed: planner-primary eval pressure now covers valid LLM read plans, raw/non-visible tool rejection before audit/executor, approval-required confirm/no mutation, unevidenced PMS fact text rejection, and deterministic keyword bypass protection.
- R3 eval validation passed: `node packages/evals/dist/index.js` reported `ok=true passed=19 total=19 auditEvents=16` after `pnpm build`.
- R3 full validation passed: `pnpm build`; `pnpm test`; `pnpm guard:boundaries`; `node packages/evals/dist/index.js`; `git diff --check`.
- Same-slice review remains required before advancing to `PACK_COMPLETE`.
- R2 reviewed and accepted: `runLegacySafetyScaffoldFallback(...)` is the only deterministic loop invocation branch after planner observation/no structured plan, valid structured LLM plans return before fallback, invalid/raw structured plans fail before fallback, and safety/evidence gates remain intact.
- R2 review validation passed: `pnpm build`; `pnpm vitest run tests/unified-agent.test.ts tests/customer-pms-loop.test.ts tests/tool-plan.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
- R2 execute implementation completed: `session.ts` now routes deterministic customer/admin loops through the named `runLegacySafetyScaffoldFallback(...)` branch only after the LLM is prompted and returns no structured `ToolPlanAction` JSON.
- R2 tests added in `tests/unified-agent.test.ts` proving fallback waits for prompt observation and that deterministic booking keywords cannot bypass a valid LLM `gated_pms_read` plan.
- R2 validation passed: `pnpm build`; `pnpm vitest run tests/unified-agent.test.ts tests/customer-pms-loop.test.ts tests/tool-plan.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
- R1 reviewed and accepted: live `runAgentTurn(...)` now parses strict LLM tool-plan JSON before deterministic loops, validates visible gated tools through `parseToolPlan(...)`, executes accepted calls through registered gated tools via `executeToolPlan(...)`, remembers PMS evidence refs, and rejects invalid/raw plans before fallback.
- R1 review validation passed: `pnpm vitest run tests/unified-agent.test.ts tests/tool-plan.test.ts`; `pnpm build`; `pnpm guard:boundaries`; `git diff --check`; `pnpm test`.
- R0 accepted in review: GPT-5.5 model override docs/config, visible `model_not_resolved` failure path, profile-visible prompt manifest, raw-tool exclusion, and JSON-only `ToolPlanAction` contract are evidence-backed.

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