# PMS Agent V2 AI-Native MVP STATUS

Plan ID: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current Step

- active_step: `P2`

## Planned Stages

- [x] `P0` bootstrap-clean-monorepo
- [x] `P1` adapter-contracts-only
- [x] `P1A` upstream-downstream-alignment
- [ ] `P2` safety-gateway-kernel
- [ ] `P3` gated-tool-runner
- [ ] `P4` pms-client-evidence
- [ ] `P5` unified-agent-runtime
- [ ] `P6` agent-service-api
- [ ] `P7` customer-pms-loop
- [ ] `P8` admin-proposal-loop
- [ ] `P9` sandbox-exec-and-file-hardening
- [ ] `P10` audit-and-eval-hardening
- [ ] `P11` end-to-end-integration-smoke
- [ ] `P12` final-reality-audit-and-pack-closeout-prep
- [ ] `PACK_COMPLETE` closeout

## Immediate Focus

### `P2`

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Build Safety Gateway before connecting the strong Agent.

必须交付：

1. `capability-registry.ts` with MVP capabilities.
2. `risk.ts` with risk taxonomy.
3. `constraints.ts` with workspace/PMS/bash/http constraints.
4. `decision.ts` with `SafetyDecision` and `ToolRequest`.
5. `policy-engine.ts` with profile-aware decisions.
6. `audit-log.ts` JSONL interface with redacted summaries.

done_when:

1. Safety decisions are capability/risk/constraint based, not tool-name-only prohibition lists.
2. Every decision can produce an audit event.
3. No executor package is needed to test the policy kernel.

stop_boundary:

1. Stop if implementing Safety requires real tool execution.
2. Stop if policy cannot express proposal/approval-first PMS mutation.
3. Stop if the design needs pi internals before P5.

必须避免：

1. Do not add executor implementations.
2. Do not call `pi-coding-agent` runtime.
3. Do not implement PMS client behavior here.

## Machine State

- active_step: `P2`
- latest_completed_step: `P1A`
- intended_handoff: `execute-plan`
- latest_closeout_summary: P1A review accepted; legacy-wrapper proof was added and the plan advanced to P2.
- latest_verification:
  - `Read package-owned execution-reality-audit skill before review work`
  - `Anchored docs/plan truth: P1 was active and REVIEW_READY`
  - `Reviewed adapter-contracts source and contract tests against P1 deliverables, done_when, avoid list, and stop_boundary`
  - `Added focused tests proving absent tenantId, sessionId, messageId, and message are rejected`
  - `pms-agent-v2: pnpm build passed`
  - `pms-agent-v2: pnpm test passed with 3 files / 20 tests plus boundary guard`
  - `pms-agent-v2 and conversation-core: git diff --check passed`
  - `Review cleanup scan found no TODO/FIXME/placeholders, internal Agent/Safety/pi fields, legacy runtime imports, body.replies exposure, compatibility adapter, or channel abstraction in P1 surfaces`
  - `adapter-feishu: npm run check:boundaries passed`
  - `adapter-feishu: npm run build passed`
  - `adapter-feishu: npm test passed with 34 files / 156 tests`
  - `pms-agent-v2: pnpm build passed`
  - `pms-agent-v2: pnpm test passed with 3 files / 20 tests plus boundary guard`
  - `adapter-feishu, pms-agent-v2, and conversation-core: git diff --check passed`
  - `P1A implementation added PMS Agent turn forwarding, AgentResult delivery mapping, approval-card callback routing, bounded PMS_AGENT_* config, and PMS endpoint map docs`
  - `P1A review added proof that old replies[] and wrapped result response shapes are not treated as PMS Agent output`
  - `P1A review confirmed pms-platform typed routes exist for the documented endpoint map`
  - `P1A review reran adapter-feishu boundary/build/test, pms-agent-v2 build/test/boundary guard, cleanup scans, and git diff --check`
  - `/home/peng/dt-git/github/pms-agent-v2/packages/adapter-contracts/src/feishu-turn.ts`
  - `/home/peng/dt-git/github/pms-agent-v2/packages/adapter-contracts/src/agent-result.ts`
  - `/home/peng/dt-git/github/pms-agent-v2/packages/adapter-contracts/src/approval-card.ts`
  - `/home/peng/dt-git/github/pms-agent-v2/packages/adapter-contracts/src/field-checks.ts`
  - `/home/peng/dt-git/github/pms-agent-v2/tests/adapter-contracts.test.ts`
  - `/home/peng/dt-git/github/pms-agent-v2/docs/plan/README.md`
  - `/home/peng/dt-git/github/pms-agent-v2/docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_PLAN.md`
  - `/home/peng/dt-git/github/pms-agent-v2/docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_STATUS.md`
  - `/home/peng/dt-git/github/pms-agent-v2/docs/plan/pms-agent-v2-ai-native-mvp-v1-2026-05-06_WORKSET.md`

## Current Evidence

1. Roadmap SSOT exists at `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`.
2. Upstream/downstream readiness was manually audited before this pack:
   - `adapter-feishu` has Feishu ingress/delivery and typed-card callback infrastructure, but needs new `FeishuTurnInput -> AgentResult` alignment.
   - `pms-platform` already has typed read, reservation draft, prepare-confirm, pending-action status/confirm/cancel endpoints.
3. `adapter-feishu npm test` previously passed: 31 files / 150 tests.
4. `pms-platform npm test` previously passed: 11 files / 97 tests.
5. P0 execution created `/home/peng/dt-git/github/pms-agent-v2` as a clean sibling repo with minimal pnpm/TypeScript/Vitest scaffold, planned app/package workspaces, root docs, and boundary guard.
6. P0 validation passed in `pms-agent-v2`: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check`.
7. Boundary guard test proved seeded banned runtime surfaces are rejected while current runtime surfaces pass.
8. P0 review accepted the scaffold after rerunning `pnpm build`, `pnpm test` with 2 files / 8 tests, `pnpm guard:boundaries`, and `git diff --check` in both touched repos.
9. P1 execution implemented `packages/adapter-contracts/src/feishu-turn.ts`, `agent-result.ts`, `approval-card.ts`, and an internal `field-checks.ts` primitive validator helper.
10. P1 contract tests validate valid `FeishuTurnInput`, every `AgentResult` variant, `pms_pending_action` approval card refs, invalid actor/missing IDs/empty message, and old response-shape rejection.
11. P1 validation passed in `pms-agent-v2`: `pnpm build`, `pnpm test` with 3 files / 19 tests, boundary guard, and `git diff --check`.
12. P1 review added missing-field proof for absent tenant/session/message/messageId inputs.
13. P1 review reran `pnpm build`, `pnpm test` with 3 files / 20 tests, boundary guard, contract scope scans, and `git diff --check` in touched repos; P1 accepted.
14. P1A execution added `adapter-feishu/src/pmsAgent/*` for `InboundTurn -> FeishuTurnInput`, direct `/v1/feishu-turn` forwarding with `PMS_AGENT_TURN_URL` / `PMS_AGENT_AUTH_TOKEN`, and `AgentResult -> ProviderNotification` delivery for text/refusal/proposal/approval cards.
15. P1A execution wired PMS approval-card clicks through adapter-owned pending-action callback forwarding to current `pms-platform` pending-action routes without moving callback ownership.
16. P1A execution documented the `pms-agent-v2` PMS endpoint map at `docs/pms-platform-endpoint-map.md`.
17. P1A validation passed: `adapter-feishu npm run check:boundaries`, `npm run build`, `npm test` with 34 files / 156 tests; `pms-agent-v2 pnpm build`, `pnpm test` with 3 files / 20 tests plus boundary guard; `git diff --check` in touched repos.
18. P1A review tightened `adapter-feishu` PMS Agent response parsing to direct validated `AgentResult` only and added proof that old `replies[]` and wrapped result shapes do not produce PMS Agent output.
19. P1A review reran `adapter-feishu npm run check:boundaries`, `npm run build`, `npm test` with 34 files / 157 tests, `pms-agent-v2 pnpm build`, `pnpm test`, `pnpm guard:boundaries`, cleanup scans, and `git diff --check`; P1A accepted and active step advanced to P2.

## Global Review Cleanup Law

Every review must verify and remove slice-created:

1. compatibility code;
2. old-contract shims;
3. dead branches and unused exports;
4. redundant abstractions;
5. stale comments and demo-only logs;
6. placeholder files not required by tests or docs.

A slice cannot be marked done while such residue remains in its scope.

## Autopilot Transition Contract

- `execute/completed` dispatches same-slice `review`; it does not advance the active step.
- `review/completed` with accepted evidence updates README/STATUS/WORKSET to the next Stage Order item.
- `review/continue` keeps the same active step and dispatches another bounded execute cycle.
- `needs_replan` dispatches `replan`; `blocked` or `failed` stops.
- `PACK_COMPLETE` is the only terminal closeout state.

## Residuals

- P0 accepted with no same-slice implementation residuals.
- Potential planning residual: exact `pi-coding-agent` API must be verified from current Pi docs/examples during `P5`, not guessed from this plan.
