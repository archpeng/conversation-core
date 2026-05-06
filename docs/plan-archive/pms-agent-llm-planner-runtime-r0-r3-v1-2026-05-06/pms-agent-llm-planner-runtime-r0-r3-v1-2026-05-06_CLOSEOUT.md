# PMS Agent LLM Planner Runtime R0-R3 Closeout

Plan ID: `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06`
Closeout state: `PACK_COMPLETE`
Closed on: 2026-05-07

## Verdict

The R0-R3 LLM planner runtime release pack is closed. R0, R1, R2, and R3 were implemented, reviewed, accepted, and reflected in parser truth before closeout.

This closeout is a local runtime and eval-pressure claim. It is not a production Feishu stability claim, not a live PMS mutation proof, not a production latency/SLO claim, and not a full admin proposal runtime migration.

## Completed scope

### R0 — gpt55-and-tool-plan-output-contract

Accepted artifacts:

- `.env` local runtime override
- `README.md`
- `apps/agent-service/src/runtime.ts`
- `packages/unified-agent/src/session.ts`
- `tests/agent-service-runtime.test.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- The intended live runtime override is `PMS_AGENT_PI_MODEL_PROVIDER=openai` and `PMS_AGENT_PI_MODEL_ID=gpt-5.5`.
- Runtime model resolution fails visibly with `model_not_resolved` if the configured provider/model pair cannot be resolved, instead of silently falling back.
- The turn prompt injects the profile-visible gated tool manifest and a JSON-only `ToolPlanAction` output contract.
- Raw tools such as `bash`, `read`, `write`, `edit`, `http`, and `http_request` are excluded from the LLM-visible manifest.
- Runtime validation and Safety Gateway remain authoritative; prompt text is not treated as policy enforcement.

### R1 — live-parse-execute-tool-plan-integration

Accepted artifacts:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/tool-plan.ts`
- `packages/unified-agent/src/response-synthesis.ts`
- `tests/unified-agent.test.ts`
- `tests/tool-plan.test.ts`

Accepted result:

- `runAgentTurn(...)` prompts Pi/LLM, strictly parses assistant JSON as a `ToolPlanAction`, validates it against `buildVisibleGatedToolManifest(...)`, and executes accepted `call_tool` plans through registered Pi gated tools.
- PMS evidence tool results are synthesized through `synthesizeTextReply(...)`, returned with evidence refs, and remembered in redacted session continuity.
- Approval-required `gated_pms_confirm` plans do not call mutation executors.
- Raw, invalid, or non-visible tool plans fail before executors and before deterministic fallback can hide the planner failure.

### R2 — shrink-deterministic-loop-scaffold

Accepted artifacts:

- `packages/unified-agent/src/session.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- Deterministic customer/admin loops are invoked only through the named `runLegacySafetyScaffoldFallback(...)` branch.
- The fallback branch runs only after Pi/LLM observation and only when the assistant produces no structured `ToolPlanAction` JSON.
- Valid structured LLM plans return before deterministic fallback.
- Invalid structured plans return safe refusals before fallback or executors.
- Natural-language confirm, PMS evidence, and profile boundary safety outcomes remain intact.

### R3 — planner-primary-eval-pressure

Accepted artifacts:

- `packages/evals/src/index.ts`
- `docs/plan/README.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_WORKSET.md`

Accepted result:

- `pnpm eval` now includes planner-primary pressure cases:
  - `llm-plan-pms-read-grounded`
  - `llm-plan-raw-tool-rejected`
  - `llm-plan-non-visible-tool-rejected`
  - `llm-plan-natural-confirm-no-mutation`
  - `llm-fact-text-requires-evidence`
  - `llm-plan-before-keyword-fallback`
- Evals prove valid LLM `gated_pms_read` plans return current PMS evidence-grounded results.
- Raw `bash` plans and customer attempts to use non-visible admin/proposal tools reject before Safety Gateway audit or executor side effects.
- LLM confirm plans preserve approval-required/no-mutation behavior.
- LLM text that claims PMS facts without current `pms-platform` evidence is refused.
- Booking-keyword text cannot bypass LLM prompt/plan observation when a valid LLM plan exists.

## Bitter Lesson compliance

1. Contract is interface, not intelligence — the typed `ToolPlanAction` contract constrains model output without encoding the business brain as regex routing.
2. LLM chooses among gated actions — the model selects only from the visible gated manifest; runtime validates; Safety Gateway decides.
3. Context is authority-labeled — existing context/evidence surfaces remain separated from advisory session/workspace/model context.
4. PMS evidence is environment observation — current PMS fact responses still require current `pms-platform` evidence refs.
5. Eval creates selection pressure — R3 extends `pnpm eval` so planner-primary regressions fail loudly.
6. Deterministic code owns safety/evidence validation, not business intelligence — Safety Gateway, profile-visible validation, approval boundaries, and response synthesis remain deterministic guardrails.

## Safety boundary evidence

- Raw built-in tools remain absent from the LLM-visible manifest.
- Customer profile cannot use admin/proposal tools.
- Safety Gateway remains the unique execution authority for accepted gated tool calls.
- Approval-required PMS confirm plans do not call mutation executors.
- Deterministic PMS/workflow loops are fallback scaffolding only, not the primary action selector for valid structured LLM plans.
- PMS facts are synthesized only with current `pms-platform` evidence refs.

## Final evidence

Closeout validation commands:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
node packages/evals/dist/index.js
git diff --check
plan_sync docs/plan
```

Observed closeout result:

```text
pnpm build: passed
pnpm test: passed; 20 test files / 136 tests; boundary guard passed; pnpm eval passed 19/19
pnpm guard:boundaries: passed
node packages/evals/dist/index.js: passed; ok=true passed=19 total=19 auditEvents=16
git diff --check: passed
pre-archive plan_sync docs/plan: STATUS/WORKSET done=4 pending=1 with PACK_COMPLETE ready
```

## Residual handoff

Successor work must use a new plan pack. This R0-R3 pack deliberately leaves these residuals outside scope:

1. Production Feishu/GPT-5.5 live runtime stability and latency/SLO hardening.
2. Production credential/live PMS mutation validation.
3. Full admin proposal runtime migration to future `workspace_*` tools.
4. Full proposal Eval Runner with persisted `evals/{runId}/` outputs.
5. Approval/Promote/Archive lifecycle and publication rules.
6. Daily Sweep, long-term memory/lesson mining, production DB/object storage, and deployment observability.
7. Further replacement of remaining deterministic compatibility scaffolding, if future ownership and validation require it.

No same-pack R0-R3 implementation or review residual remains open.

## Plan hygiene result

Hot parser surface after closeout:

```text
docs/plan/README.md
```

Cold archive surface:

```text
docs/plan-archive/pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06/
```

Archived parser files:

- `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_PLAN.md`
- `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_STATUS.md`
- `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_WORKSET.md`
- `pms-agent-llm-planner-runtime-r0-r3-v1-2026-05-06_CLOSEOUT.md`

## Re-promotion condition

Do not resume this pack as active work. Any successor effort must create a new plan pack that cites this archive as historical evidence and explicitly names scope, validation, replacement ownership, and residual handling.
