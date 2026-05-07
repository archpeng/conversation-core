# PMS Agent Platform Workflow Q1-Q4 Plan

Plan ID: `pms-agent-platform-workflow-q1-q4-v1-2026-05-07`

## Goal

Harden `pms-agent-v2` so `gated_pms_workflow` is a true `pms-platform` typed route orchestration, not a synthetic workflow shortcut, while preventing `quantity > 1` requests from being misrepresented as a single-room reservation approval.

## Scope

- Wire runtime workflow execution to the proven platform route sequence:
  - `availability/search`
  - `reservation-drafts/create`
  - `reservation-drafts/update` when selected candidate or slot updates are needed
  - `reservation-drafts/quote`
  - `reservation-drafts/prepare-confirm`
  - `pending-actions/status` as readback only
- Preserve the law that `roomId` and selected candidate data come only from preceding `pms-platform` availability evidence.
- Ensure runtime returns only platform-backed `PmsEvidence<ReservationConfirmPreparation | PendingActionStatusFact>` for workflow outcomes.
- Add a safe `quantity > 1` boundary for the current platform contract, because `ReservationDraftSlots` currently supports one `roomId` / `selectedCandidateRef`, not multi-room atomic reservation.
- Clean or rename synthetic workflow evidence in tests/evals so runtime truth is not confused with fake fixtures.

## Non-Goals

- Do not implement multi-room/group reservation truth inside `pms-agent-v2`.
- Do not change `pms-platform` unless a typed route gap is proven and explicitly replanned in that repo.
- Do not add Feishu delivery/callback ownership to `pms-agent-v2`.
- Do not expose platform endpoint paths, auth, raw refs, or internal route sequencing to the LLM prompt.
- Do not add natural-language confirm/cancel mutation paths.

## Architecture Laws

1. LLM observes and chooses a visible gated tool plan; runtime validates; Safety Gateway gates; platform evidence decides facts.
2. PMS facts, room availability, room IDs, draft refs, quote refs, and pending-action status are authoritative only from `pms-platform`.
3. `pms-agent-v2` may orchestrate typed route calls but must not become the PMS workflow truth owner.
4. `pms-platform` remains free of Pi/LLM, Feishu transport, and customer-chat dependencies.
5. `adapter-feishu` owns card delivery/callback transport; `pms-agent-v2` only returns typed `AgentResult`.

## Current Evidence

- `pms-platform` availability search supports `count` and can return multiple candidates.
- Current `pms-platform` reservation draft slots expose one `roomId` and one `selectedCandidateRef`; they do not expose `roomIds[]`, `selectedCandidates[]`, or group reservation semantics.
- Current runtime already calls platform draft/quote/prepare-confirm, but it does not yet perform update/status readback as a fixed full sequence.
- Runtime synthetic workflow evidence is not present in `apps/**`; synthetic PMS evidence remains in tests/evals and must be named as fake/local stub evidence.

## Multi-Room Decision

Short-term behavior for this pack:

- If a workflow plan requests `quantity > 1`, do not create a single-room approval card.
- Return a grounded refusal/clarification stating that the current platform approval flow supports one room per reservation draft, and ask whether to prepare one room now or wait for multi-room support.
- This avoids claiming "two rooms booked/prepared" when the platform contract can only represent one selected room.

Successor options outside this pack:

- Medium-term: prepare multiple independent single-room drafts and cards, explicitly non-atomic and user-visible as separate approvals.
- Long-term preferred: add a `pms-platform` multi-room/group reservation draft contract with `selectedCandidates[]`, `quantity`, per-room evidence refs, and one group pending-action ref.

## Deliverables

1. TDD for full workflow route sequence in `tests/agent-service-runtime.test.ts`.
2. `createRuntimeExecutors().pmsWorkflow` fixed to perform create/update/quote/prepare-confirm/status readback through `createPmsPlatformClient(...)`.
3. Runtime candidate selection refuses `quantity > 1` under current single-room platform contract.
4. `pms-platform-client` schemas lean toward platform refs: `draftRef`, `quoteRef`, `pendingActionRef`, `cardPayloadRef`, with raw `draftId`/`pendingActionId` treated as legacy-compatible parse aliases only where tests still require them.
5. Tests/evals rename helper evidence to `fakePmsEvidence` or `localStubEvidence` where the evidence is not platform-backed runtime truth.
6. `docs/pms-platform-endpoint-map.md` corrected so confirm/cancel are described as future adapter callback-only surfaces, not natural-language agent client methods.

## Verification

- `pnpm exec vitest run tests/agent-service-runtime.test.ts tests/pms-platform-client.test.ts tests/unified-agent.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm guard:boundaries`
- `pnpm eval`
- `git diff --check`
- Optional local HTTP smoke after implementation: `adapter-feishu -> pms-agent-v2 -> pms-platform`.

## Risks

- Adding `pending-actions/status` after `prepare-confirm` must remain readback only and must not consume or mutate the pending action.
- Tightening refs may require a successor adapter contract update before Feishu card click succeeds; do not hide that as a workflow success claim.
- Multi-room support requires platform-owned semantics; implementing it only in the agent would create false PMS truth.

## Stage Definitions

### `Q1` — platform-workflow-sequence-tdd

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

Goal:

- Add failing tests that describe the full single-room route sequence and the `quantity > 1` safety boundary.

Deliverables:

1. Runtime test expects create -> update when needed -> quote -> prepare-confirm -> pending-actions/status.
2. Test proves `roomId` / selected candidate comes from prior availability evidence, not LLM params.
3. Test proves `quantity > 1` does not create a misleading single-room approval card.

done_when:

1. Tests fail for the current implementation for the intended reasons.
2. Test fixtures use platform envelope shapes, not synthetic flat workflow objects.

stop_boundary:

1. Stop if the tests require inventing platform multi-room semantics.
2. Stop if the workflow test bypasses Safety Gateway or typed gated tools.

### `Q2` — runtime-platform-sequence-implementation

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `critical`

Goal:

- Implement the full platform sequence in runtime without synthetic workflow evidence.

Deliverables:

1. `apps/agent-service/src/runtime.ts` orchestrates draft create, optional update, quote, prepare-confirm, and pending-action status readback.
2. Executor returns platform evidence from client methods only.
3. `PMS_PLATFORM_BASE_URL` and `PMS_PLATFORM_AUTH_TOKEN` remain the only route/auth configuration surfaces.

done_when:

1. Runtime tests pass.
2. `rg -n "createPmsEvidence" apps packages` shows runtime does not create synthetic PMS workflow evidence outside the platform client evidence wrapper.

stop_boundary:

1. Stop if satisfying runtime behavior requires a platform route that does not exist.
2. Stop if runtime starts generating room facts, draft refs, quote refs, or pending-action status locally.

### `Q3` — single-room-contract-and-multi-room-guard

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `high`

Goal:

- Make current single-room reservation semantics explicit and prevent `quantity > 1` from becoming a false approval-card claim.

Deliverables:

1. `bounded_read_then_workflow` selects one room only when `quantity` is absent or equals `1`.
2. `quantity > 1` returns a safe refusal/clarification tied to current platform contract limits.
3. Plan/eval coverage proves a two-room request does not produce a single pending-action card.
4. A successor note names the required `pms-platform` multi-room/group reservation contract.

done_when:

1. Tests and eval prove two-room requests are blocked or clarified instead of producing a single-room card.
2. User-facing message does not expose raw platform refs or internal route names.

stop_boundary:

1. Stop if implementation creates multiple drafts without explicit user-facing non-atomic semantics.
2. Stop if it claims two rooms are prepared through a one-room draft.

### `Q4` — cleanup-docs-and-boundary-proof

- Owner: `execute-plan`
- State: `QUEUED`
- Priority: `medium`

Goal:

- Remove ambiguous synthetic-evidence language and update endpoint documentation.

Deliverables:

1. Test/eval helper names distinguish fake/local stub evidence from runtime PMS facts.
2. `docs/pms-platform-endpoint-map.md` reflects actual client methods and marks confirm/cancel as adapter callback-only / future, not natural-language agent tools.
3. Boundary scans confirm no Pi/LLM/Feishu imports enter `pms-platform`, and no platform auth/endpoint detail enters LLM-visible manifest.

done_when:

1. Full verification passes.
2. Local smoke evidence is recorded if the running services are available.

stop_boundary:

1. Stop if docs imply natural-language confirm/cancel is supported.
2. Stop if cleanup weakens test coverage or hides synthetic fixtures.

## Exit Criteria

1. Q1-Q4 accepted and reflected in STATUS/WORKSET.
2. `pms-agent-v2` runtime single-room workflow is fully platform-backed through typed routes.
3. `quantity > 1` no longer returns a misleading single-room approval card.
4. Synthetic PMS workflow evidence is limited to clearly named test/eval/local stubs.
5. Final validation passes and any required `pms-platform` multi-room successor plan is explicitly recorded.
