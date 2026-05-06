# PMS Agent V2 AI-Native MVP STATUS

Plan ID: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`
Status file state: `ACTIVE`
Last updated: 2026-05-06

## Current Step

- active_step: `P0`

## Planned Stages

- [ ] `P0` bootstrap-clean-monorepo
- [ ] `P1` adapter-contracts-only
- [ ] `P1A` upstream-downstream-alignment
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

### `P0`

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Create the new `pms-agent-v2` repo/workspace skeleton with minimal TypeScript tooling and hard no-legacy guardrails.

预期：

1. A clean monorepo exists and can build/test before business code starts.
2. No legacy runtime compatibility can enter unnoticed.
3. Root docs make the architecture laws unavoidable for future slices.

测试预期：

1. `pnpm install` succeeds.
2. `pnpm build` succeeds.
3. `pnpm test` succeeds.
4. Boundary guard proves banned dependencies/strings/routes are absent or fail when intentionally seeded in tests.

review 预期：

1. Remove placeholder comments, unused scaffold files, generated examples, and any compatibility language not required by the docs.
2. Confirm P0 did not implement business logic, Agent logic, or tool execution.

done_when:

1. New repo builds and tests with only minimal scaffold code.
2. No planned package is missing.
3. Guardrails fail on banned legacy strings/imports where appropriate.
4. Root docs explicitly state `pi-coding-agent` first and Safety Gateway only boundary.

stop_boundary:

1. Stop if the target repo location is ambiguous.
2. Stop if tooling requires broad framework choices not needed for build/test.
3. Stop if any bootstrap path introduces old `ai-conversation` runtime compatibility.

## Machine State

- active_step: `P0`
- intended_handoff: `execute-plan`
- pack_mode: `single-root-autopilot-compatible`
- source_roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`
- latest_review_verdict: `none`
- next_writeback_owner: `execution-reality-audit` after execute evidence exists

## Current Evidence

1. Roadmap SSOT exists at `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`.
2. Upstream/downstream readiness was manually audited before this pack:
   - `adapter-feishu` has Feishu ingress/delivery and typed-card callback infrastructure, but needs new `FeishuTurnInput -> AgentResult` alignment.
   - `pms-platform` already has typed read, reservation draft, prepare-confirm, pending-action status/confirm/cancel endpoints.
3. `adapter-feishu npm test` previously passed: 31 files / 150 tests.
4. `pms-platform npm test` previously passed: 11 files / 97 tests.
5. Current control-plane creation is planning-only; no implementation slice has run yet.

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

- No implementation residuals yet.
- Potential planning residual: exact `pi-coding-agent` API must be verified from current Pi docs/examples during `P5`, not guessed from this plan.
