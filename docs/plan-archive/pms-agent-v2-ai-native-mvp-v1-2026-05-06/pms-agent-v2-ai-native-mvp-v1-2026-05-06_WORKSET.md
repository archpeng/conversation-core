# PMS Agent V2 AI-Native MVP WORKSET

Plan ID: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`

## Stage Order

- [x] `P0` bootstrap-clean-monorepo
- [x] `P1` adapter-contracts-only
- [x] `P1A` upstream-downstream-alignment
- [x] `P2` safety-gateway-kernel
- [x] `P3` gated-tool-runner
- [x] `P4` pms-client-evidence
- [x] `P5` unified-agent-runtime
- [x] `P6` agent-service-api
- [x] `P7` customer-pms-loop
- [x] `P8` admin-proposal-loop
- [x] `P9` sandbox-exec-and-file-hardening
- [x] `P10` audit-and-eval-hardening
- [x] `P11` end-to-end-integration-smoke
- [x] `P12` final-reality-audit-and-pack-closeout-prep
- [x] `PACK_COMPLETE` closeout

## Active Stage

### `PACK_COMPLETE`

- Owner: `autopilot-closeout`
- State: `DONE`
- Priority: `terminal`

目标：

- Archive or close the pack only after `P12` accepted review marks the objective complete.

必须交付：

1. Closeout summary.
2. Final evidence and residual handoff.
3. Hot/cold plan hygiene update.

done_when:

1. Pack is terminal and no active implementation/review work remains.

stop_boundary:

1. If any non-terminal slice remains active, hand back to that slice; do not close out.

必须避免：

1. Do not use closeout to skip review or cleanup.
## Current Wave

### `W5` reality-audit-closeout

- Active stage: `PACK_COMPLETE`
- Active stage state: `DONE`
- Next handoff: `none`
- Dominant owner boundary: repo-local closeout after final reality audit.
- Execute ladder: `PACK_COMPLETE`
- Validation ladder: closeout summary, final evidence/residual handoff, parser validation, and plan hygiene.
- Current stage doneWhenMet must prove:
  1. Pack is terminal and no active implementation/review work remains.
- Current stage stopBoundaryHit must cite one of:
  1. If any non-terminal slice remains active, hand back to that slice; do not close out.
- PACK_COMPLETE delivered surfaces:
  1. closeout summary
  2. final evidence and residual handoff
  3. hot/cold plan hygiene update
- PACK_COMPLETE exit criteria met:
  1. README and archived WORKSET record `PACK_COMPLETE` as completed.
  2. No non-deferred stages remain.
  3. Closeout evidence cites final tests/evals/static scans.
- Accepted-closeout writeback: pack closed and archived under `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/`.

## Master Wave Ladder

1. `W1` safety-evidence-foundation: `P2` -> `P3` -> `P4`.
2. `W2` runtime-service-boundary: `P5` -> `P6`.
3. `W3` product-loop-proof: `P7` -> `P8`.
4. `W4` hardening-eval-integration: `P9` -> `P10` -> `P11`.
5. `W5` reality-audit-closeout: `P12` -> `PACK_COMPLETE`.

## Detailed Execution Queue

### `P1` workset — adapter-contracts-only

执行步骤：

1. Implement only `packages/adapter-contracts`.
2. Define `FeishuTurnInput` and `AgentResult` as both TypeScript types and runtime schemas.
3. Add validation helpers with narrow names; do not add generic schema framework wrappers unless needed by tests.
4. Add contract tests for valid/invalid input and all output variants.
5. Add a negative test proving old `replies[]` is not an `AgentResult`.
6. Run `pnpm build` and `pnpm test`.
7. Review-clean unused helper functions, duplicate schemas, comments, and any compatibility adapters.

预期：

- External boundary is fixed before runtime exists.

测试预期：

- Invalid actor/missing tenant/empty message rejected.
- All output variants accepted.
- Old output shape rejected.

### `P1A` workset — upstream-downstream-alignment

执行步骤：

1. In `adapter-feishu`, add tests around `InboundTurn -> FeishuTurnInput` mapping.
2. Add tests around `AgentResult -> delivery` mapping for text/refusal/proposal/approval.
3. Reuse existing typed-card callback path for PMS approval cards; do not move callback ownership.
4. Add bounded config/env names for new agent service URL/auth.
5. Run `adapter-feishu npm test`.
6. In `pms-agent-v2`, document PMS endpoint map and expected evidence wrapping.
7. Do not touch `pms-platform` unless a typed gap is proven.
8. Review-clean old/new dual logic in touched surfaces where replacement is complete.

预期：

- Adapter can call the new contract without forcing `pms-agent-v2` to emit legacy replies.

测试预期：

- Adapter mapping tests pass.
- Existing reservation typed-card callback tests still pass.

### `P2` workset — safety-gateway-kernel

执行步骤：

1. Add failing policy tests in `tests/safety-gateway.test.ts` for the required allow/deny/approval cases before broad implementation.
2. Implement `capability-registry.ts` with only MVP capabilities: PMS read/workflow/confirm, proposal file write/edit/read, sandbox bash/read, and default-denied HTTP.
3. Implement `risk.ts` and `constraints.ts` so decisions can cite risk and workspace/PMS/bash/http constraints instead of raw tool-name bans.
4. Implement `decision.ts` with `ToolRequest`, `SafetyDecision`, decision reasons, `require_approval`, and audit-safe summaries.
5. Implement `policy-engine.ts` with deterministic profile-aware decisions for customer, admin, staff/internal if required by existing adapter roles.
6. Implement `audit-log.ts` as a JSONL event interface and redaction helper only; do not write real files unless tests use in-memory/string serialization.
7. Export the public P2 kernel from `packages/safety-gateway/src/index.ts` and remove the old bootstrap-only placeholder if unused.
8. Run `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check`.
9. Review-clean any if-else-only forbidden-list shortcuts, unused extension points, explanatory comments, or executor-shaped code.

预期：

- Safety exists before Agent runtime and before any executor package can run side effects.

测试预期：

- Customer `pms_read` allowed; customer `bash/write/edit/read/http` denied; admin proposal write allowed only under proposal workspace; `pms_confirm` without pending action denied; `pms_confirm` with pending action returns `require_approval`; HTTP denied by default; every decision has an audit event.

### `P3` workset — gated-tool-runner

执行步骤：

1. Implement one `runGatedTool` path.
2. Add no-side-effect deny/approval handling.
3. Add minimal wrappers for PMS, file, bash, http capabilities.
4. Mock executors in tests to prove evaluation order.
5. Add auditId assertions on allow/deny/approval.
6. Review-clean duplicated per-tool policy and raw executor escape hatches.

预期：

- All tools are governed capabilities.

测试预期：

- Gateway called before executor, denied tool has no side effect, every result has auditId.

### `P4` workset — pms-client-evidence

执行步骤：

1. Implement typed client methods for existing `pms-platform` routes.
2. Add evidence envelope creation and redacted summary.
3. Add request/response validation only where needed.
4. Mock PMS responses for availability/read/prepare-confirm/pending-status.
5. Add negative test for arbitrary endpoint path absence.
6. Review-clean generic HTTP helpers and schema duplication.

预期：

- PMS facts become evidence objects before the Agent sees them.

测试预期：

- All fact-bearing client results include evidenceRef/fetchedAt/source/scope.

### `P5` workset — unified-agent-runtime

执行步骤：

1. Read current Pi docs/examples for exact `pi-coding-agent` APIs before coding.
2. Implement deterministic profile selection.
3. Register profile-specific gated tools only.
4. Implement short system prompt.
5. Implement redacted minimal session continuity.
6. Add tests for visible tools and two-turn continuity.
7. Review-clean prompt policy bloat, fallback runtimes, mode selectors, and unused memory code.

预期：

- Strong Agent is connected only after gated tools and Safety Gateway are ready.

测试预期：

- Customer sees no file/bash tools; admin writes proposal only through Gateway; PMS facts still require evidence.

### `P6` workset — agent-service-api

执行步骤：

1. Implement minimal HTTP host or route layer.
2. Add `/health`, `/v1/feishu-turn`, `/v1/eval-turn`.
3. Validate input and normalize output.
4. Add redaction tests for health/logging.
5. Add route tests for deterministic profile selection.
6. Review-clean old route aliases, raw debug logs, broad framework wrappers.

预期：

- Adapter-callable service exists with only new contract.

测试预期：

- Invalid input rejected; valid turns return `AgentResult` only.

### `P7` workset — customer-pms-loop

执行步骤：

1. Add fixtures for availability and missing slots.
2. Wire `gated_pms_read` to evidence-grounded replies.
3. Wire draft/quote/prepare-confirm minimal path.
4. Implement natural-language confirm boundary behavior.
5. Add session follow-up tests for date/room-type continuity.
6. Review-clean hardcoded PMS truth and exact wording locks.

预期：

- Customer PMS path works safely and continuously.

测试预期：

- Evidence required for facts; pending action required for approval card; no direct mutation.

### `P8` workset — admin-proposal-loop

执行步骤：

1. Implement proposal workspace resolver.
2. Implement `SKILL.md`, `eval-fixtures.json`, `risk-report.md` generation through gated writes.
3. Return `proposal_created`.
4. Add write-outside-proposal negative tests.
5. Review-clean production publish stubs and speculative registry code.

预期：

- Agent demonstrates strong capability by creating reviewable artifacts only.

测试预期：

- Proposal files exist; customer cannot write; no production publish route exists.

### `P9` workset — sandbox-exec-and-file-hardening

执行步骤：

1. Add deterministic path checks.
2. Add bash command allowlist and denial tests.
3. Enforce timeout/no-network/no-secret constraints.
4. Update SAFETY minimally.
5. Review-clean broad shell parsing and unused allowlist configuration.

预期：

- File/bash are governed, not naked or globally forbidden.

测试预期：

- Allowed test/build commands pass in sandbox; denied commands fail before execution.

### `P10` workset — audit-and-eval-hardening

执行步骤：

1. Harden audit redaction and result summaries.
2. Implement eval runner and fixture assertion helpers.
3. Add high-risk fixtures from roadmap.
4. Wire `pnpm eval`.
5. Review-clean duplicated fixtures and unused audit fields.

预期：

- Safety boundaries become regression tests.

测试预期：

- `pnpm eval` fails on direct mutation, sandbox escape, prompt injection, profile escalation, uncited PMS fact.

### `P11` workset — end-to-end-integration-smoke

执行步骤：

1. Add local smoke test/script with mocks or local PMS sandbox.
2. Exercise text reply, approval card, proposal, refusal.
3. Verify adapter contract alignment if adapter was touched.
4. Verify pms-platform tests if platform was touched.
5. Review-clean demo-only routes, aliases, temporary fixtures, and debug logs.

预期：

- Six MVP loops work together.

测试预期：

- Full build/test/eval pass and local integration smoke passes.

### `P12` workset — final-reality-audit-and-pack-closeout-prep

执行步骤：

1. Run execution reality audit over roadmap, plan, code, tests, and sibling contracts.
2. Static scan for legacy compatibility, bypasses, old response shape, raw tools, uncited PMS facts.
3. Remove redundant abstractions, compatibility code, unused exports, stale comments, debug logs, dead fixtures.
4. Re-run full validation.
5. Write accepted evidence and move active parser truth to `PACK_COMPLETE` only if all criteria are met.

预期：

- MVP is clean, minimal, and reviewable.

测试预期：

- Full test/eval/static guard/diff-check pass after cleanup.

## Review Gate Required For Every Stage

Before any stage is marked done, review must answer:

1. Did this stage introduce any compatibility code? If yes, remove it or reject the stage.
2. Did this stage introduce an abstraction not required by validation? If yes, remove it.
3. Did this stage leave placeholder comments, demo logs, TODOs, or stale docs? If yes, remove them.
4. Did this stage bypass Safety Gateway or PMS evidence? If yes, reject and replan.
5. Did this stage touch upstream/downstream ownership boundaries? If yes, verify owner-specific tests.

## Handoff After This Planning Turn

- Next surface: none
- Active stage: `none`
- Expected next phase: none
- Closeout owner: `none`

## Machine Queue

- active_step: `none`
- latest_completed_step: `PACK_COMPLETE`
- intended_handoff: `none`
- latest_closeout_summary: Closed the MVP pack, archived the completed parser triplet, and left `docs/plan/` with no active pack.
- latest_verification:
  - `P12 validation passed: pnpm build; pnpm test with 12 files / 83 tests plus boundary guard and pnpm eval; pnpm exec vitest run tests/integration-smoke.test.ts; pnpm guard:boundaries; git diff --check.`
  - `PACK_COMPLETE closeout wrote docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_CLOSEOUT.md.`
  - `Hot/cold plan hygiene archived the completed PLAN/STATUS/WORKSET triplet under docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/ and left docs/plan/README.md as the only hot parser file.`
  - `Residual handoff is post-MVP only: production deployment/secret runbook, live Feishu/PMS smoke with approved credentials, and durable production audit storage/retention.`