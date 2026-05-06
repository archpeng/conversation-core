# PMS Agent LLM Planner Runtime R0-R3 Plan

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`

## Goal

Make the live PMS agent runtime use GPT-5.5 and promote the C1 typed LLM tool-plan contract into the primary execution path, while keeping Safety Gateway, PMS evidence, response synthesis, and approval boundaries deterministic.

## Scope

- Configure the project/runtime model override to GPT-5.5 through the existing Pi `ModelRegistry` path.
- Make prompt/runtime ask the LLM for a structured tool plan instead of treating assistant text as the primary live output.
- Integrate `parseToolPlan(...) -> executeToolPlan(...)` into `runAgentTurn(...)` as the live primary action path.
- Shrink `customer-loop.ts` / `proposal-loop.ts` to legacy safety scaffolding only after an LLM plan is invalid or non-actionable.
- Add eval/test pressure proving LLM-planner-first behavior and preventing deterministic keyword bypass.

## Non-Goals

- Do not grant raw filesystem/PMS/bash/http tools to the LLM.
- Do not move Safety Gateway decisions into prompt text or LLM policy.
- Do not trust LLM text as PMS fact authority.
- Do not implement full production PMS mutation, approval/promote/archive, daily sweep, production storage, or full proposal Eval Runner persistence.
- Do not remove deterministic validators, evidence checks, redaction, or Safety Gateway guardrails.

## Deliverables

1. Runtime model override defaults/documentation updated to GPT-5.5.
2. LLM tool-plan prompt contract and parser integration in `packages/unified-agent`.
3. Live tool-plan execution path wired through profile-visible manifest, `parseToolPlan`, `executeToolPlan`, Safety Gateway, evidence capture, and response synthesis.
4. Deterministic loops demoted to post-LLM invalid-plan safety scaffold only.
5. Tests/evals proving LLM planner primary path and preserving safety/evidence laws.
6. Parser-compatible plan/status/workset control plane for continuous execution.

## Constraints

- LLM-first runtime law in `AGENTS.md` and `docs/ARCHITECTURE_CONSTRAINTS.md` is mandatory.
- GPT-5.5 must be configured through existing Pi model override surfaces; if Pi `ModelRegistry` cannot resolve `gpt-5.5`, stop and document the exact model/provider mismatch instead of silently falling back.
- The LLM may only choose from profile-visible gated tools.
- Safety Gateway remains the unique execution authority for side effects.
- PMS facts remain authoritative only from `pms-platform` evidence.
- If this pack runs under extension autopilot, each phase ends with exactly one `autopilot_report` and active-slice `stepId` equals the slice ID.

## Verification

- `pnpm build`
- Targeted vitest for planner prompt/runtime integration.
- Targeted eval run or `node packages/evals/dist/index.js` proving planner-first failure modes.
- `pnpm test`
- `pnpm guard:boundaries`
- `git diff --check`
- Optional runtime probe after R3 review: adapter-feishu -> pms-agent-v2 -> pms-platform with GPT-5.5 real mode, if credentials/model resolution are available.

## Blockers / Risks

- GPT-5.5 naming may not exist in the local Pi `ModelRegistry`; do not invent a model alias without proof.
- Real LLM latency may exceed adapter-feishu timeout; this pack should preserve LLM-first but may need explicit timeout/observability decisions in a successor slice if latency remains.
- Existing deterministic loops contain useful safety scaffolding; shrinking them must not weaken approval/evidence guarantees.

## Autopilot Transition Contract

- Planning phases prepare or repair parser truth; they do not claim implementation completion.
- `execute/completed` dispatches `review` for the same active slice and must not advance `Stage Order` by itself.
- `review/completed` accepts the active slice, writes completion evidence, and advances README/STATUS/WORKSET to the next stage or `PACK_COMPLETE`.
- `review/continue` keeps the same active slice for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stops; `done` is reserved for whole-objective completion and closeout.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and all R0-R3 stages are accepted.

## Slice Definitions

#### `R0` — gpt55-and-tool-plan-output-contract

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Configure the runtime to request GPT-5.5 through Pi model override surfaces and make the LLM prompt produce a structured tool-plan contract rather than unstructured assistant text for actionable turns.

交付物：

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

#### `R1` — live-parse-execute-tool-plan-integration

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `critical`

目标：

- Make the live `runAgentTurn(...)` path parse the LLM's structured plan, validate it against the visible manifest, execute accepted tool calls through gated tools, remember refs, and synthesize a safe `AgentResult`.

交付物：

1. `runAgentTurn(...)` extracts and parses assistant tool-plan JSON before deterministic loop scaffolding.
2. Valid `call_tool` plans execute through `executeToolPlan(...)` and registered gated tools only.
3. Tool results that carry PMS evidence become remembered refs and can support evidence-grounded synthesis.
4. Non-call plans (`ask_clarification`, `refuse`, `require_approval`) map to valid `AgentResult` without side effects.
5. Tests cover successful `gated_pms_read`, approval-required `gated_pms_confirm`, invalid plan rejection, and no raw executor calls.


done_when:

1. `assistant plan -> parseToolPlan -> executeToolPlan -> remember refs -> synthesize response` is the primary live action path.
2. Valid PMS read plans return current `pms-platform` evidence refs through `AgentResult`.
3. Approval-required PMS confirm plans do not call mutation executors.
4. Invalid/non-visible/raw tool plans fail before executor and before deterministic loop fallback can hide the failure.
5. `pnpm build`, targeted runtime tests, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If executing a tool plan bypasses `runGatedTool` or Safety Gateway audit/decision ordering, stop.
2. If LLM text can satisfy PMS facts without supplied PMS evidence refs, stop and route to response synthesis hardening.
3. If plan parsing requires accepting loose prose or unsafe JSON repair that can reinterpret malicious output, stop and replan.

必须避免：

1. Do not execute tools directly from assistant text.
2. Do not let deterministic loops run first for live turns.
3. Do not swallow invalid LLM plans and pretend the planner path succeeded.

#### `R2` — shrink-deterministic-loop-scaffold

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `high`

目标：

- Demote `customer-loop.ts` and `proposal-loop.ts` from primary business closure to explicit legacy safety scaffold used only after typed LLM plans are invalid, unsupported, or non-actionable.

交付物：

1. `runAgentTurn(...)` ordering documents and enforces LLM-plan-first behavior.
2. Deterministic loops are invoked only through a named fallback/scaffold branch after plan failure/non-actionable result, not before or parallel to the planner path.
3. Fallback returns safe refusal/clarification/minimal compatibility only; it does not claim planner success.
4. Tests prove deterministic keyword path cannot bypass LLM prompting and cannot execute PMS tools when a valid LLM plan exists.


done_when:

1. `customer-loop.ts` is no longer the main PMS action selector for valid LLM tool plans.
2. The fallback path is explicit, named, and covered by tests.
3. Existing safety outcomes still hold: natural-language confirm does not mutate PMS, PMS facts require evidence, and profile boundaries remain intact.
4. `pnpm build`, targeted loop-shrink tests, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If shrinking loops weakens approval-card or PMS evidence laws, stop and repair within the owning boundary.
2. If fallback becomes a second primary workflow engine, stop and replan.
3. If legacy compatibility requires old ai-conversation response shapes or `replies[]`, stop.

必须避免：

1. Do not delete safety scaffolding without replacement proof.
2. Do not preserve broad regex intelligence as hidden primary routing.
3. Do not turn LLM into fallback after deterministic routing.

#### `R3` — planner-primary-eval-pressure

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `high`

目标：

- Add eval pressure proving the LLM-planner primary path and preventing regressions back to deterministic keyword routing or unsafe tool selection.

交付物：

1. Eval proving LLM plan chooses `gated_pms_read` for availability and returns PMS evidence-grounded result.
2. Eval proving LLM plan cannot choose raw `bash` or other raw tools.
3. Eval proving customer LLM plan cannot choose non-visible admin/proposal tools.
4. Eval proving LLM natural confirm yields approval-required/refusal/card behavior, not PMS mutation.
5. Eval proving LLM PMS fact response still requires current PMS evidence.
6. Eval proving deterministic keyword path cannot bypass LLM prompt/plan observation.


done_when:

1. `pnpm eval` covers planner-primary failure modes and passes.
2. Evals fail if runtime executes deterministic PMS keyword routing before LLM tool-plan parsing.
3. Unsafe or unevidenced PMS fact responses fail eval.
4. Raw/non-visible tool plans fail before executor.
5. `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` pass.

stop_boundary:

1. If evals merely assert deterministic happy paths without proving planner-primary behavior, stop and rework C5-style pressure.
2. If eval fixtures require production PMS credentials or live mutation, stop.
3. If evals pass by loosening safety/evidence assertions, stop.

必须避免：

1. Do not count old deterministic loop tests as planner-primary proof.
2. Do not claim full production live Feishu proof unless adapter and GPT-5.5 runtime probe actually passed.
3. Do not hide model-resolution or latency issues as eval success.

#### `PACK_COMPLETE` — closeout-and-archive

- Owner: `autopilot-closeout`
- State: `QUEUED`
- Priority: `terminal`

目标：

- Close and archive the R0-R3 planner-runtime pack after accepted reviews prove GPT-5.5 configuration, planner-primary execution, loop shrink, and eval pressure.

交付物：

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

## Exit Criteria

- R0-R3 accepted-review evidence exists.
- Live runtime is LLM-plan-first for normal user turns.
- GPT-5.5 is the intended model configuration, or unresolved model status is explicit and not silently hidden.
- Safety Gateway, PMS evidence, response synthesis, profile-visible tools, and approval-card boundaries remain intact.
- Closeout uses the repo-local closeout prompt surface.
