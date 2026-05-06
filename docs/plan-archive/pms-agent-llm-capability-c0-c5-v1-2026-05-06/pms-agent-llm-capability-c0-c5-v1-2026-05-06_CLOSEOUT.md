# PMS Agent LLM Capability C0-C5 Closeout

Plan ID: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
Closeout state: `PACK_COMPLETE`
Closed on: 2026-05-06

## Verdict

The C0-C5 LLM capability release pack is closed. C0, C1, C2, C3, C4, and C5 were implemented, reviewed, accepted, and reflected in parser truth before closeout.

This closeout is a local agent-capability and safety-boundary claim. It is not a production readiness claim, not a full admin proposal runtime migration, not a production DB/object-storage claim, and not a full persisted proposal Eval Runner claim.

## Completed scope

### C0 — typed-intent-slot-contract

Accepted artifacts:

- `packages/unified-agent/src/intent-frame.ts`
- `tests/intent-frame.test.ts`
- `packages/unified-agent/src/index.ts`

Accepted result:

- Added a typed LLM intent-frame contract with `availability`, `prepare_confirm`, `natural_confirm`, and `unknown` intents.
- Added slot state for `stay_date`, `room_type`, and `pending_action`, including focused missing-slot clarification.
- Review hardened the contract so `missingSlots` must match slot status and inconsistent frames fail with `inconsistent_missing_slots`.
- The intent-frame module remains an interface boundary only: it does not call PMS, Safety Gateway, or raw tools.

### C1 — llm-gated-tool-planning

Accepted artifacts:

- `packages/unified-agent/src/tool-plan.ts`
- `tests/tool-plan.test.ts`
- `packages/unified-agent/src/index.ts`

Accepted result:

- Added visible gated tool manifests and a typed LLM tool-plan contract covering `call_tool`, `ask_clarification`, `refuse`, and `require_approval`.
- Plans are validated against profile-visible gated Pi tools.
- Raw executors such as `read`, `write`, `edit`, `bash`, `http`, `http_request`, `gated_http`, and `sandbox_bash` are rejected as not visible to the LLM plan.
- Execution goes through registered gated Pi tools; Safety Gateway decisions and audit happen before executors.
- Denied or approval-required decisions do not execute side-effecting executors, including natural-language confirm attempts.

### C2 — structured-session-state

Accepted artifacts:

- `packages/unified-agent/src/continuity.ts`
- `packages/unified-agent/src/customer-loop.ts`
- `packages/unified-agent/src/index.ts`
- `tests/session-state.test.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- Extended redacted session continuity with current intent, slot memory, missing slots, evidence refs, pending action refs, draft refs, card refs, and safety flags.
- Added helpers to merge validated intent frames into session state and read non-factual slot hints.
- Current PMS facts remain evidence-bound; session state is not PMS fact authority.
- Review hardened slot memory with `safeSessionSlotValue(...)` so PMS-fact-looking values, prices/counts, evidence refs, and raw Feishu/open token-like values are not promoted into durable continuity.
- Customer follow-up routing can reuse stored non-factual `stay_date` and `room_type` hints while still rereading PMS evidence for current facts.

### C3 — context-builder-advisory-injection

Accepted artifacts:

- `packages/unified-agent/src/context-bundle.ts`
- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/index.ts`
- `tests/context-bundle.test.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- Added authority-labeled context items with `mandatory_policy`, `pms_evidence`, `workspace_advisory`, `session_continuity`, `user_claim`, and `model_prior` authority.
- Context items carry source, summary, evidence refs, and `canAnswerCurrentPmsFact`.
- Workspace/session/user/model prior context remains advisory only; PMS evidence is the only authority allowed to answer current PMS facts.
- Existing workspace-safe tool outputs can be normalized into advisory context without direct filesystem retrieval.
- Review fixed session integration so supplied `workspaceAdvisory`, `pmsEvidence`, and `modelPriorSummary` are actually injected into turn prompts.

### C4 — evidence-grounded-response-synthesis

Accepted artifacts:

- `packages/unified-agent/src/response-synthesis.ts`
- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/index.ts`
- `tests/response-synthesis.test.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- Added a response synthesis boundary for `text_reply`, `clarification`, `refusal`, `approval_card`, and `proposal_created` drafts.
- Synthesized outputs remain adapter-safe `AgentResult` values; old `replies` compatibility was not added.
- Current PMS fact-bearing text requires supplied current `pms-platform` evidence refs.
- Advisory/session/workspace/model context cannot satisfy current PMS fact requirements, even if a forged context item claims `authority: "pms_evidence"`.
- High-risk PMS mutation-complete claims are rejected unless represented as an approval-card flow.
- Unsafe output detection blocks hidden prompts, bearer/token-looking content, tool traces, stack traces, and secret-looking refs.
- Assistant fallback text now routes through synthesis instead of being returned directly.

### C5 — eval-capability-pressure

Accepted artifacts:

- `packages/evals/src/index.ts`
- `docs/plan/README.md`
- `docs/plan/pms-agent-llm-capability-c0-c5-v1-2026-05-06_STATUS.md`
- `docs/plan/pms-agent-llm-capability-c0-c5-v1-2026-05-06_WORKSET.md`

Accepted result:

- Existing `pnpm eval` is now the pack-level regression pressure surface for C0-C4 behavior.
- Added eval pressure for focused clarification from typed intent frames.
- Added structured slot follow-up proof: follow-up quality uses stored non-factual slots and still performs a fresh PMS reread with cited evidence.
- Added advisory-not-truth proof: workspace/model advisory refs cannot satisfy PMS evidence validation and do not introduce PMS payload-shaped truth such as `priceCents`.
- Added prompt-injection evidence-boundary proof: injected uncited PMS facts are blocked by response synthesis validation, not prompt-only policy.
- Added visible gated tool-plan proof: raw tools and non-visible gated tools are rejected; approval-required confirm does not call the executor; allowed PMS read reaches executor only after Safety Gateway allow/audit.
- Existing evals continue to cover grounded availability, prepare-confirm audit chain, natural-language confirm no mutation, sandbox denials, admin proposal isolation, prompt injection profile boundary, and profile-visible tool boundaries.

## Bitter Lesson compliance

1. Contract is interface, not intelligence — C0 typed frames and C1 tool plans constrain LLM outputs without encoding a hand-written business brain.
2. LLM chooses among gated actions — C1 exposes only profile-visible gated tools and validates plans before execution.
3. Context is retrieved and authority-labeled — C3 separates PMS evidence from workspace/session/user/model advisory context.
4. PMS evidence is environment observation — C2/C3/C4 preserve the law that current PMS facts require PMS evidence, not memory, workspace notes, persona text, or model guesses.
5. Eval creates selection pressure — C5 extends `pnpm eval` so regressions in clarification, follow-up, evidence grounding, advisory context, prompt injection, natural-language confirmation, and tool planning fail loudly.

## Safety boundary evidence

- Safety Gateway remains the execution boundary for gated tools.
- Natural-language confirmation still does not mutate PMS; approval-card flow is required.
- Raw tools are not visible in LLM tool plans.
- Customer profile does not gain proposal tools.
- Admin proposal work remains proposal-isolated and does not claim production publication.
- Current PMS facts are synthesized only with current `pms-platform` evidence refs.

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
pnpm test: passed; 20 test files / 126 tests; boundary guard passed; eval passed 13/13
pnpm guard:boundaries: passed
node packages/evals/dist/index.js: passed; ok=true passed=13 total=13 auditEvents=13
git diff --check: passed
pre-archive plan_sync docs/plan: STATUS/WORKSET done=6 pending=1 with PACK_COMPLETE ready
```

## Residual handoff

Successor work must use a new plan pack. This C0-C5 pack deliberately leaves these residuals outside scope:

1. Full admin proposal runtime migration to `workspace_*` tools and removal/replacement of old proposal tool paths.
2. Full proposal Eval Runner with persisted `evals/{runId}/` outputs.
3. Approval/Promote/Archive lifecycle, including reviewer decisions, active promotion, archive/supersede, and publication rules.
4. Daily Sweep and long-term memory/lesson mining under explicit policy.
5. Production DB/object storage and migration from local filesystem artifacts.
6. Production credential/live PMS mutation validation.
7. Replacement of remaining deterministic customer-loop regex heuristics with deeper live LLM planner integration, if a future pack decides that ownership and replacement path.
8. Broader prompt/tool/context optimization driven by the new C5 eval pressure.

No same-pack C0-C5 implementation or review residual remains open.

## Plan hygiene result

Hot parser surface after closeout:

```text
docs/plan/README.md
```

Cold archive surface:

```text
docs/plan-archive/pms-agent-llm-capability-c0-c5-v1-2026-05-06/
```

Archived parser files:

- `pms-agent-llm-capability-c0-c5-v1-2026-05-06_PLAN.md`
- `pms-agent-llm-capability-c0-c5-v1-2026-05-06_STATUS.md`
- `pms-agent-llm-capability-c0-c5-v1-2026-05-06_WORKSET.md`
- `pms-agent-llm-capability-c0-c5-v1-2026-05-06_CLOSEOUT.md`

## Re-promotion condition

Do not resume this pack as active work. Any successor effort must create a new plan pack that cites this archive as historical evidence and explicitly names scope, validation, replacement ownership, and residual handling.
