# PMS Agent LLM Capability C0-C5 Workset

Plan ID: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`

## Stage Order

- [x] `C0` typed-intent-slot-contract
- [x] `C1` llm-gated-tool-planning
- [x] `C2` structured-session-state
- [x] `C3` context-builder-advisory-injection
- [x] `C4` evidence-grounded-response-synthesis
- [x] `C5` eval-capability-pressure
- [x] `PACK_COMPLETE` closeout-and-archive

## Active Stage

### `PACK_COMPLETE`

- Owner: `autopilot-closeout`
- State: `PACK_COMPLETE`
- Priority: `terminal`

目标：

- Close the C0-C5 pack only after accepted reviews prove all slices complete and no non-deferred C-pack work remains.

必须交付：

1. Closeout artifact summarizing C0-C5 deliverables, Bitter Lesson compliance, validation evidence, and residuals.
2. Hot/cold plan hygiene: completed pack archived under `docs/plan-archive/`; `docs/plan/README.md` reset to no active pack.
3. Residual handoff for admin proposal runtime migration, full proposal Eval Runner, Approval/Promote/Archive, Daily Sweep, and production storage.

done_when:

1. C0-C5 are accepted by review and marked done.
2. Final validation passes: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, `plan_sync`, and `git diff --check`.
3. Closeout artifact records evidence and residual handoff.
4. Hot parser surface contains only allowed active/no-active parser files after archive.

stop_boundary:

1. If any C0-C5 slice remains active, queued, failed, or needs review, hand back to that slice.
2. If final implementation violates Bitter Lesson-compatible principles by replacing LLM planning with broad hand-written workflows, replan before closeout.
3. If Safety Gateway is no longer the unique execution boundary, closeout is forbidden.

必须避免：

1. Do not claim production readiness or full lifecycle completion.
2. Do not archive before parser truth and closeout evidence are aligned.
3. Do not hide residuals created by C-pack scope cuts.
## Completed Stage Evidence

- C5 accepted by review:
  - Extended `packages/evals/src/index.ts` eval categories with `intent-clarification`, `context-advisory`, `tool-planning`, and `response-synthesis` pressure.
  - Added focused clarification eval proving typed intent missing-slot frames drive one specific clarification.
  - Added structured slot follow-up eval proving follow-up quality comes from stored non-factual slots and still performs a fresh PMS reread with cited evidence.
  - Added context advisory eval proving workspace/model advisory refs cannot satisfy PMS evidence validation; review added proof that advisory context does not introduce PMS payload-shaped truth such as `priceCents`.
  - Added prompt-injection eval proving injected uncited PMS facts are blocked by response synthesis validation rather than prompt-only policy.
  - Added visible tool-plan eval proving raw tools and non-visible gated tools are rejected, approval-required confirm does not call the executor, and allowed PMS read reaches executor only after Safety Gateway allow/audit.
  - Existing eval CLI remains the only pack-level eval runner; no full proposal Eval Runner persistence or production eval storage was added.
  - Validation passed during review: `pnpm build`; `node packages/evals/dist/index.js` produced `ok=true passed=13 total=13`; `pnpm test` passed 20 files / 126 tests and ran guard plus eval; `pnpm guard:boundaries`; `git diff --check`.
  - Parser truth advanced to `PACK_COMPLETE` for repo-local closeout.

- C4 accepted by review:
  - Added `packages/unified-agent/src/response-synthesis.ts` with `ResponseSynthesisDraft`, `synthesizeAgentResult`, `synthesizeTextReply`, PMS fact detection, evidence-ref validation, unsafe-output rejection, and high-risk mutation claim rejection.
  - Response synthesis separates `text_reply`, `clarification`, `refusal`, `approval_card`, and `proposal_created` drafts into adapter-safe `AgentResult` outputs.
  - Current PMS fact-bearing text requires current `pms-platform` evidence refs from supplied `pmsEvidence`; advisory/session/workspace/model prior context cannot satisfy the evidence requirement.
  - Approval-required or mutation-complete claims become safe refusal unless represented as an `approval_card`.
  - Updated `packages/unified-agent/src/session.ts` so assistant fallback text is synthesized through the C4 validation boundary instead of returned directly.
  - Exported C4 response synthesis APIs from `packages/unified-agent/src/index.ts`.
  - Added `tests/response-synthesis.test.ts` covering cited PMS fact text, uncited/advisory-cited PMS fact rejection, forged pms_evidence context rejection, approval-card vs mutation-complete text, unsafe output rejection including tenant-style secrets, and no old replies compatibility.
  - Added `tests/unified-agent.test.ts` proof that assistant PMS fact text is validated rather than relying on prompt-only policy, and allowed only with supplied current pms-platform evidence.
  - Review fixed one local evidence-authority gap: arbitrary context bundle items can no longer satisfy current PMS fact refs; only supplied `pmsEvidence` refs count.
  - Validation passed: `pnpm build`; `pnpm vitest run tests/response-synthesis.test.ts tests/unified-agent.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
  - `pnpm test` also ran `pnpm eval`; eval passed 8/8.

- C3 accepted by review:
  - Added `packages/unified-agent/src/context-bundle.ts` with `ContextBundleItem`, authority labels, source summaries, evidence refs, `canAnswerCurrentPmsFact`, `buildContextBundle`, `contextBundlePrompt`, and `workspaceAdvisoryFromToolValue`.
  - Context items distinguish `mandatory_policy`, `session_continuity`, `workspace_advisory`, `pms_evidence`, `user_claim`, and `model_prior` authority.
  - Workspace/session/user/model context is always advisory (`canAnswerCurrentPmsFact: false`); PMS evidence items are the only current-fact authority (`canAnswerCurrentPmsFact: true`).
  - Updated `packages/unified-agent/src/session.ts` to inject compact authority-labeled context next to existing continuity refs in the LLM prompt.
  - Review found and closed one integration gap: `RunAgentTurnOptions` did not pass `workspaceAdvisory`, `pmsEvidence`, or `modelPriorSummary` into prompt injection.
  - Review fixed `packages/unified-agent/src/session.ts` to carry those options into `buildContextBundle` and added `tests/unified-agent.test.ts` proof that supplied authority-labeled context is injected.
  - Exported C3 context builder APIs from `packages/unified-agent/src/index.ts`.
  - Added `tests/context-bundle.test.ts` covering bounded context, authority separation, advisory-not-fact behavior, PMS evidence distinguishability, workspace-safe tool value normalization, and compact prompt injection without raw refs/rule dumps.
  - Validation passed: `pnpm build`; `pnpm vitest run tests/context-bundle.test.ts tests/unified-agent.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
  - `pnpm test` also ran `pnpm eval`; eval passed 8/8.

- C2 accepted by review:
  - Extended `packages/unified-agent/src/continuity.ts` with redacted structured session state for current intent, slot memory, missing slots, evidence refs, pending action refs, draft refs, card refs, and safety flags.
  - Added `mergeIntentFrameIntoSessionState`, `sessionSlotValue`, and `sessionRequiresPmsEvidence` so validated C0 intent frames can update non-factual continuity without becoming PMS fact authority.
  - Exported C2 continuity helpers from `packages/unified-agent/src/index.ts`.
  - Updated `packages/unified-agent/src/customer-loop.ts` to let follow-up availability checks reuse stored non-factual `stay_date`/`room_type` slots while still reading current PMS facts through `gated_pms_read`.
  - Added `tests/session-state.test.ts` covering slot carryover, forbidden durable fields, PMS evidence requirement flags, natural-language confirmation as approval-boundary state, and review-added filtering for PMS-fact-looking slot values.
  - Review tightened C2 proof by adding `safeSessionSlotValue(...)` filtering and a regression test rejecting room_type slot values containing price/count claims.
  - Validation passed during review: `pnpm build`; `pnpm vitest run tests/session-state.test.ts tests/unified-agent.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
  - `pnpm test` also ran `pnpm eval`; eval passed 8/8.

- C1 accepted by review:
  - Added `packages/unified-agent/src/tool-plan.ts` visible gated tool manifest, typed tool-plan schema, plan validator, and gated execution wrapper.
  - Exported C1 contract from `packages/unified-agent/src/index.ts`.
  - Added `tests/tool-plan.test.ts` covering visible manifests for `customer_pms` and `admin_customization`, call/clarify/refuse/approval plan validation, non-visible/raw tool rejection, customer workspace/bash denial, Safety Gateway allow ordering, deny/approval no-side-effect behavior, and natural-language confirm no direct mutation.
  - Review reran validation: `pnpm build`; `pnpm vitest run tests/tool-plan.test.ts`; `pnpm test`; `pnpm guard:boundaries`; `git diff --check`.
  - `pnpm test` also ran `pnpm eval`; eval passed 8/8.
  - Residual for later slices: C1 is contract/validation layer; live LLM planner wiring remains future integration before C-pack closeout.

- C0 accepted by review:
  - Added `packages/unified-agent/src/intent-frame.ts` typed intent/slot contract, validator, and focused missing-slot clarification helper.
  - Exported the C0 contract from `packages/unified-agent/src/index.ts`.
  - Added `tests/intent-frame.test.ts` runtime-facing contract tests for valid frames, invalid frames, structural missing-slot clarification, and no PMS/Safety/raw-tool authority.
  - Review tightened C0 proof by requiring `missingSlots` to match slot status and adding an inconsistent-frame rejection test.
  - Validation passed: `pnpm build`; `pnpm vitest run tests/intent-frame.test.ts`; `pnpm guard:boundaries`; `git diff --check`.
  - Residual for C1/C2: existing customer-loop regex heuristics remain pre-existing until LLM planning/state integration replaces or wraps them.

## Slice Ownership

### `C0`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `tests/unified-agent*.test.ts` or a new targeted test file under `tests/`
- Optional narrow doc note only if needed for SSOT discoverability

Forbidden owner drift:

- `packages/safety-gateway/src/**` unless C0 discovers a missing type import only; C0 must not change policy.
- `packages/pms-platform-client/src/**`; C0 must not call PMS.
- `packages/workspace-core/src/**`; C0 must not change filesystem rules.

### `C1`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/gated-tools/src/**` only for typed manifest/wrapper shape if existing types are insufficient
- `tests/unified-agent*.test.ts`, `tests/gated-tools.test.ts`, or targeted planning tests

### `C2`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `apps/agent-service/src/**` only if service session cache wiring must carry new structured state
- targeted session continuity tests

### `C3`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/workspace-tools/src/**` only through existing read/list APIs; avoid low-level changes unless review proves a narrow missing read surface
- context authority-label tests

### `C4`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/adapter-contracts/src/**` only if a contract gap is proven; avoid changing `AgentResult` shape unless necessary
- response/evidence tests

### `C5`

Expected owner surfaces:

- `packages/evals/**`
- `tests/**`
- `scripts/boundary-guard.mjs` only if a named new boundary needs static proof

### `PACK_COMPLETE`

Expected owner surfaces:

- `docs/plan/*`
- `docs/plan-archive/pms-agent-llm-capability-c0-c5-v1-2026-05-06/`

## Expected Verification

For C0:

```bash
pnpm build
pnpm vitest run <targeted C0 tests>
pnpm guard:boundaries
git diff --check
```

For C1:

```bash
pnpm build
pnpm vitest run <targeted C1 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C2:

```bash
pnpm build
pnpm vitest run <targeted C2 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C3:

```bash
pnpm build
pnpm vitest run <targeted C3 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C4:

```bash
pnpm build
pnpm vitest run <targeted C4 tests>
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

For C5:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

For PACK_COMPLETE:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
plan_sync docs/plan
git diff --check
```

## Autopilot Transition Contract

- If active slice owner/state is `execute-plan` / `READY`, dispatch `execute` for the current active slice.
- `execute/completed` dispatches same-stage `review`; do not advance the active slice during execute.
- `review/completed` is the accepted-stage writeback gate that updates README/STATUS/WORKSET to the next deterministic stage.
- `review/continue` keeps the same active stage for another execute cycle.
- `needs_replan` routes to `replan` and keeps parser truth honest.
- `blocked` or `failed` stop execution and preserve current active stage for repair.
- `done` is reserved for objective closeout only when active stage is `PACK_COMPLETE` and every non-deferred stage is done.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and no non-deferred C0-C5 stage remains.

## Detailed Execution Queue

### `C0` workset — typed-intent-slot-contract

执行步骤：

1. Read current unified-agent runtime files and tests to identify existing deterministic loop surfaces and current AgentResult path.
2. Define a small intent frame contract with fields for intent label, slot map, missing slots, ambiguity/confidence, source language, and evidence requirement hints if needed.
3. Define validator/parser for unknown model output; invalid output must fail safe.
4. Add focused clarification derivation from `missingSlots` without broad workflow branching.
5. Add tests for valid frame, invalid frame, missing-slot structure, and no PMS fact authority.
6. Run C0 validation and update STATUS/WORKSET only through accepted review.

预期：

- C0 creates an interface for LLM understanding, not a keyword router or booking workflow engine.

测试预期：

- Schema validation rejects malformed model output.
- Missing slots can drive one focused clarification.
- No C0 code calls PMS, Safety Gateway policy, or raw tools.

### `C1` workset — llm-gated-tool-planning

执行步骤：

1. Read existing profile/tool visibility and `runGatedTool` tests.
2. Define visible gated manifest per profile.
3. Define typed tool plan shape for call/clarify/refuse/approval boundary.
4. Validate planned tool names against profile-visible manifest.
5. Ensure executor calls remain behind Safety Gateway.
6. Add tests for non-visible tool rejection, raw executor rejection, customer workspace/bash denial, and natural-language confirm no mutation.

预期：

- LLM gets a safe action space, not raw tools.

测试预期：

- LLM-proposed disallowed actions fail before executor.
- Allowed calls still require Safety Gateway allow.

### `C2` workset — structured-session-state

执行步骤：

1. Read existing session cache/state surfaces.
2. Add bounded typed session state for slots and opaque refs.
3. Add merge/update rules from intent frame to session state.
4. Ensure redaction excludes raw text, raw PMS payloads, raw Feishu IDs, PII, and current PMS facts.
5. Add follow-up tests proving slot carryover and evidence re-read/citation requirement.

预期：

- Follow-up ability improves through state, not memory truth.

测试预期：

- Follow-up can fill missing slots.
- Current PMS facts still require PMS evidence.

### `C3` workset — context-builder-advisory-injection

执行步骤：

1. Read workspace-tools active-skill/list/read surfaces.
2. Define context bundle with authority labels.
3. Retrieve only bounded relevant advisory context.
4. Inject context into runtime prompt/tool planning as labeled observations.
5. Add tests proving advisory cannot answer current PMS facts.

预期：

- LLM has better context, but context authority remains explicit.

测试预期：

- Workspace/advisory context is `canAnswerCurrentPmsFact: false`.
- PMS evidence remains the only current fact authority.

### `C4` workset — evidence-grounded-response-synthesis

执行步骤：

1. Read existing AgentResult synthesis paths.
2. Separate response drafting from evidence validation.
3. Add validation that PMS fact-bearing text requires `pms-platform` evidence refs.
4. Preserve approval-card/proposal/refusal output boundaries.
5. Add tests for uncited PMS fact failure and high-risk mutation claim rejection.

预期：

- LLM can synthesize better answers while evidence law remains deterministic.

测试预期：

- PMS facts without evidence fail or become clarification/refusal/tool-read path.
- AgentResult remains adapter-safe.

### `C5` workset — eval-capability-pressure

执行步骤：

1. Add eval cases for follow-up, clarification, prompt injection, memory-not-truth, natural-language confirm, context advisory, and tool planning.
2. Ensure evals fail for broad hardcoded keyword workflows where possible.
3. Ensure `pnpm eval` remains the pack-level regression gate.
4. Run full validation.

预期：

- Eval becomes selection pressure for future LLM/tool/context/schema iteration.

测试预期：

- Safety/evidence/follow-up regressions fail loudly.

### `PACK_COMPLETE` workset — closeout-and-archive

执行步骤：

1. Confirm accepted reviews for C0-C5 are reflected in README/STATUS/WORKSET.
2. Run final validation.
3. Write closeout artifact with Bitter Lesson compliance and residual handoff.
4. Archive completed pack and reset hot parser surface.

预期：

- C-pack closes only after implementation and eval pressure prove the LLM capability release boundary.

测试预期：

- `plan_sync` sees terminal/no-active truth after archive.

## Machine Queue

- active_step: `PACK_COMPLETE`
- latest_completed_step: `PACK_COMPLETE`
- intended_handoff: `none`
- latest_closeout_summary: C0-C5 LLM capability pack closed and archived; hot parser surface reset to no active pack.
- latest_verification:
  - `C0-C5 are accepted by review and marked done in STATUS/WORKSET before archive.`
  - `Final validation passed: pnpm build; pnpm test passed 20 files / 126 tests and ran guard plus eval; pnpm guard:boundaries; node packages/evals/dist/index.js ok=true passed=13 total=13; git diff --check; pre-archive plan_sync showed STATUS/WORKSET done=6 pending=1.`
  - `Closeout artifact records C0-C5 evidence, Bitter Lesson compliance, validation evidence, residual handoff, and plan hygiene.`
  - `Hot parser surface will contain only docs/plan/README.md after archive; completed pack files move under docs/plan-archive/pms-agent-llm-capability-c0-c5-v1-2026-05-06/.`