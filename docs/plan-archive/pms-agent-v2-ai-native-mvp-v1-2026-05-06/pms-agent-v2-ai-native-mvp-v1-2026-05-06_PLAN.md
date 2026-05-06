# PMS Agent V2 AI-Native MVP PLAN

Plan ID: `pms-agent-v2-ai-native-mvp-v1-2026-05-06`
Status: `ACTIVE`
Mode: `single-root-autopilot-compatible`
Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`

## Objective

Create a minimal, clean `pms-agent-v2` monorepo that proves this thesis:

```text
Strong pi-coding-agent Agent Core
+ Safety Gateway
+ gated capabilities
+ PMS evidence grounding
+ proposal/approval-first high-risk actions
+ audit/eval proof
= safe AI-native PMS Agent MVP
```

## Scope

In scope:

1. New monorepo bootstrap and no-legacy guardrails.
2. `FeishuTurnInput -> AgentResult` external contract.
3. Safety Gateway capability/risk/constraint/audit kernel.
4. Gated tool runner and minimal gated tools.
5. Typed `pms-platform` client with evidence envelopes.
6. `pi-coding-agent` unified runtime with minimal redacted session continuity.
7. `agent-service` HTTP API.
8. `adapter-feishu` alignment to the new contract.
9. Customer PMS read and reservation prepare-confirm loop.
10. Admin proposal workspace loop.
11. Sandbox bash/read/write/edit hardening.
12. Audit/eval hardening and end-to-end closeout.

Out of scope:

1. Production replacement of `ai-conversation`.
2. Old `ai-conversation` response compatibility in `pms-agent-v2`.
3. Generic HTTP broker or arbitrary endpoint execution.
4. Generic plugin/extension marketplace.
5. Multi-agent supervisor or complex workflow engine.
6. Long-term memory or cross-tenant learning.
7. Full PMS workflow coverage or production skill publishing.

## Architecture Laws

1. Agent understands and plans; it does not own permission, PMS truth, or final mutation authority.
2. Safety Gateway decides capability allow/deny/approval/rewrite before every executor.
3. PMS Platform owns PMS facts, workflow state, pending action, idempotency, and mutation truth.
4. Proposal workspace carries change artifacts; production registries are not writable in MVP.
5. Audit/Eval prove behavior and catch regressions; they do not replace runtime authorization.
6. Prompt stays short; policy lives in code.
7. Review acceptance requires removal of all redundant, compatibility, dead, unused, and explanatory-comment clutter created by the slice.

## Stage Definitions

#### `P0` - bootstrap-clean-monorepo

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Create the new `pms-agent-v2` repo/workspace skeleton with minimal TypeScript tooling and hard no-legacy guardrails.

交付物:

1. `pms-agent-v2` workspace with `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, minimal build/test scripts, and package folders.
2. Root docs: `README.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SAFETY.md` carrying the no-compatibility laws.
3. Boundary guard script/test proving no `ai-conversation` dependency, no `ai-pms` fallback, no `pi-agent-core` hot path, and no V1/V2 compatibility module.
4. Minimal smoke test proving repo test runner works.

验证:

1. `pnpm install`
2. `pnpm build`
3. `pnpm test`
4. boundary guard script/test passes.

review_cleanup:

1. Delete scaffold comments, placeholder files, unused exports, generated example code, and any compatibility wording that weakens the no-legacy law.

done_when:

1. New repo builds and tests with only minimal scaffold code.
2. No planned package is missing.
3. Guardrails fail on banned legacy strings/imports where appropriate.
4. Root docs explicitly state `pi-coding-agent` first and Safety Gateway only boundary.

stop_boundary:

1. Stop if the target repo location is ambiguous.
2. Stop if tooling requires broad framework choices not needed for build/test.
3. Stop if any bootstrap path introduces old `ai-conversation` runtime compatibility.

必须避免:

1. Do not implement business logic in P0.
2. Do not add plugin systems, generic routers, database layers, or production deployment files.

#### `P1` - adapter-contracts-only

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Define and test the external adapter contract before Agent internals can leak.

交付物:

1. `packages/adapter-contracts/src/feishu-turn.ts` with `FeishuTurnInput` schema/type.
2. `packages/adapter-contracts/src/agent-result.ts` with `AgentResult` schema/type.
3. `packages/adapter-contracts/src/approval-card.ts` with minimal `pms_pending_action` payload-ref contract.
4. Contract tests for valid and invalid inputs/outputs.

验证:

1. Contract package tests pass.
2. Full repo `pnpm test` passes.
3. Static guard rejects old `replies[]` contract in `pms-agent-v2` runtime surfaces.

review_cleanup:

1. Remove unused schema helpers, overly generic validators, old-shape adapters, and explanatory comments that duplicate type names.

done_when:

1. Valid `FeishuTurnInput` and all `AgentResult` variants validate.
2. Invalid actor, missing tenant/session/message fields, and empty message are rejected.
3. Old `ai-conversation` response shape is not accepted by `pms-agent-v2`.

stop_boundary:

1. Stop if adapter contract tries to expose Agent trace, Safety Gateway internals, or pi-coding-agent internals.
2. Stop if implementing compatibility becomes necessary to pass tests; replan the adapter slice instead.

必须避免:

1. Do not add internal runtime fields to the external contract.
2. Do not create generic channel abstractions.

#### `P1A` - upstream-downstream-alignment

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Align `adapter-feishu` and `pms-platform` integration seams without polluting `pms-agent-v2` with legacy compatibility.

交付物:

1. In `adapter-feishu`, a minimal new turn-forwarding path mapping `InboundTurn -> FeishuTurnInput`.
2. In `adapter-feishu`, a minimal `AgentResult -> Feishu delivery` mapper for text, refusal, proposal, and PMS approval card.
3. New env names or bounded config path for `PMS_AGENT_TURN_URL` / auth token, without requiring `pms-agent-v2` to speak old `AI_CONVERSATION` response shape.
4. A documented endpoint map from `pms-agent-v2` client methods to current `pms-platform` routes.

验证:

1. `adapter-feishu` tests for request mapping and AgentResult delivery pass.
2. Existing typed-card callback tests still pass.
3. No `pms-platform` code changes unless a typed endpoint gap is proven.

review_cleanup:

1. Delete temporary old/new dual mappers if the new path replaces them in the touched surface.
2. Remove stale comments mentioning compatibility as a runtime goal.

done_when:

1. Adapter can call `/v1/feishu-turn` with `FeishuTurnInput`.
2. Adapter can deliver all MVP `AgentResult` variants.
3. Existing `adapter-feishu -> pms-platform` typed-card callback remains intact.
4. `pms-agent-v2` still has no old `replies[]` response support.

stop_boundary:

1. Stop if adapter change would require broad provider architecture rewrite.
2. Stop if callback ownership becomes ambiguous between `adapter-feishu` and `pms-agent-v2`.
3. Stop if `pms-platform` lacks a required typed route; document gap instead of adding generic HTTP.

必须避免:

1. Do not make `pms-agent-v2` compatible with old adapter response expectations.
2. Do not move Feishu transport ownership out of `adapter-feishu`.

#### `P2` - safety-gateway-kernel

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Build Safety Gateway before connecting the strong Agent.

交付物:

1. `capability-registry.ts` with MVP capabilities.
2. `risk.ts` with risk taxonomy.
3. `constraints.ts` with workspace/PMS/bash/http constraints.
4. `decision.ts` with `SafetyDecision` and `ToolRequest`.
5. `policy-engine.ts` with profile-aware decisions.
6. `audit-log.ts` JSONL interface with redacted summaries.

验证:

1. Customer `pms_read` allowed.
2. Customer `bash/write/edit/read/http` denied.
3. Admin proposal write allowed only under proposal workspace.
4. `pms_confirm` without pending action denied.
5. `pms_confirm` with pending action returns `require_approval`.
6. `http` denied by default.

review_cleanup:

1. Remove if-else-only forbidden-list shortcuts and centralize decisions in capability/risk/constraints.
2. Remove unused risk classes and premature policy extension points.

done_when:

1. Safety decisions are capability/risk/constraint based, not tool-name-only prohibition lists.
2. Every decision can produce an audit event.
3. No executor package is needed to test the policy kernel.

stop_boundary:

1. Stop if implementing Safety requires real tool execution.
2. Stop if policy cannot express proposal/approval-first PMS mutation.
3. Stop if the design needs pi internals before P5.

必须避免:

1. Do not add executor implementations.
2. Do not call `pi-coding-agent` runtime.
3. Do not implement PMS client behavior here.

#### `P3` - gated-tool-runner

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Expose all MVP capabilities through one gated runner and constrained executors.

交付物:

1. `run-gated-tool.ts` enforcing evaluate -> audit decision -> constrained execution -> audit result.
2. Minimal `gated_pms_read`, `gated_pms_workflow`, `gated_pms_confirm` wrappers.
3. Minimal `gated_read`, `gated_write`, `gated_edit`, `gated_bash`, `gated_http` wrappers.
4. Unit tests proving Safety Gateway is called before every executor.

验证:

1. Tool tests assert evaluation precedes execution.
2. Deny returns no side effect.
3. Approval returns no executor side effect.
4. Every tool result includes `auditId`.
5. `gated_http` default-denies.

review_cleanup:

1. Delete per-tool duplicated policy logic.
2. Delete compatibility wrappers around raw tools.
3. Remove unused executor abstractions not needed by tests.

done_when:

1. No tool can bypass `runGatedTool`.
2. Filesystem/bash/PMS wrappers have no direct broad permissions.
3. Tests prove audit ID on all outcomes.

stop_boundary:

1. Stop if an executor needs raw access before Gateway decision.
2. Stop if a shortcut is proposed "temporarily for tests".

必须避免:

1. Do not implement broad file manager, shell session, or HTTP client.
2. Do not add plugin discovery.

#### `P4` - pms-client-evidence

- Owner: `execute-plan`
- State: `DONE`
- Priority: `critical`

目标:

- Implement typed `pms-platform` client methods and wrap all PMS outputs as evidence.

交付物:

1. `pms-platform-client/src/client.ts` with typed MVP methods.
2. `pms-platform-client/src/evidence.ts` with `PmsEvidence<T>`.
3. `schemas.ts` with minimal request/response validation.
4. Tests with mock/local PMS responses for availability, room, reservation, draft, quote, prepare-confirm, and pending-action status.

验证:

1. `readAvailability` returns evidenceRef and redacted summary.
2. Empty reservation/room results are explicit evidence, not hallucination gaps.
3. `prepareConfirm` returns pending action evidence with `confirmationMode=typedCardOnly` and `mutationStatus=none`.
4. Client does not accept arbitrary endpoint path.

review_cleanup:

1. Delete generic request helper surfaces exposed outside the client if not required.
2. Remove schema duplication and stale comments.

done_when:

1. PMS facts cannot leave the client without an evidence envelope.
2. Client method set is typed and MVP-only.
3. PMS errors are redacted and actionable.

stop_boundary:

1. Stop if a needed PMS route is missing; document platform gap rather than adding generic HTTP.
2. Stop if Agent-facing surfaces expose endpoint paths/schema refs.

必须避免:

1. Do not create a generic PMS client.
2. Do not call confirm/cancel from natural-language Agent tools.

#### `P5` - unified-agent-runtime

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Connect `pi-coding-agent` as the only Agent Core after Safety Gateway and gated tools exist.

交付物:

1. `createUnifiedAgentSession`.
2. `runAgentTurn`.
3. `loadAgentProfile` deterministic profile selection.
4. `buildSystemPrompt` with short policy hints only.
5. `registerGatedTools` exposing profile-specific gated tools.
6. Minimal redacted session state for continuity.

验证:

1. Customer profile cannot see raw read/write/edit/bash/http.
2. Admin profile can call proposal gated tools only through Gateway.
3. Two-turn session continuity works with redacted refs.
4. Session memory cannot satisfy PMS facts without evidence refs.

review_cleanup:

1. Remove prompt-stuffed policy that duplicates Safety Gateway.
2. Delete second runtimes, mode selectors, fallback loops, and unused session abstractions.

done_when:

1. `pi-coding-agent` is the only Agent runtime.
2. Profile selection is deterministic from actor type.
3. Agent sees only gated tools.
4. Minimal session continuity is tested.

stop_boundary:

1. Stop if exact current `pi-coding-agent` API is unclear; read docs/examples before coding.
2. Stop if runtime requires exposing raw tools to satisfy tests.

必须避免:

1. Do not add supervisor agents.
2. Do not let LLM select profile.
3. Do not add long-term memory.

#### `P6` - agent-service-api

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Provide adapter-callable HTTP API over the unified runtime.

交付物:

1. `GET /health` redacted health.
2. `POST /v1/feishu-turn` validating `FeishuTurnInput` and returning `AgentResult`.
3. `POST /v1/eval-turn` for fixture runner.
4. Service tests for validation, profile selection, and result normalization.

验证:

1. Invalid input rejected.
2. Customer/staff route to `customer_pms`.
3. Admin/internal route to `admin_customization`.
4. Health leaks no provider URL/token/raw session/PMS payload.

review_cleanup:

1. Remove temporary route aliases and old `/conversation/feishu-turn` compatibility.
2. Remove debug logging of raw text/IDs.

done_when:

1. Adapter can call `/v1/feishu-turn` in tests.
2. `AgentResult` union is the only external output shape.
3. Health is redacted.

stop_boundary:

1. Stop if route implementation depends on old adapter body shape.
2. Stop if health/logging leaks secrets or raw identifiers.

必须避免:

1. Do not add generic REST framework layers beyond minimal HTTP handler needs.
2. Do not add streaming unless required by tests.

#### `P7` - customer-pms-loop

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Complete customer-facing PMS read, draft/quote, prepare-confirm, and natural-language confirm boundary loops.

交付物:

1. Fixtures for availability with/without rooms, missing date/type/price, multiple candidates, PMS error.
2. Reservation draft/quote/prepare-confirm flow using evidence and pending-action refs.
3. Natural-language confirm handling that never calls PMS confirm.
4. Grounded reply assertions.

验证:

1. No evidence -> no PMS fact in final reply.
2. Evidence -> reply includes evidenceRefs.
3. Prepare-confirm -> `approval_card` with `pms_pending_action` payloadRef.
4. Natural-language "确认" -> no direct mutation.
5. Follow-up turn continuity works but reuses only redacted refs/evidence refs.

review_cleanup:

1. Delete hardcoded room/business truth from prompts or phrase maps.
2. Remove exact wording locks except safety-critical assertions.

done_when:

1. Loops 1-4 from the roadmap pass fixtures.
2. PMS facts remain platform-grounded.
3. No customer raw file/bash/write tools are visible.

stop_boundary:

1. Stop if PMS truth is inferred from memory or LLM prior knowledge.
2. Stop if final confirmation requires Agent-side mutation.

必须避免:

1. Do not implement cancellation/check-in/check-out/maintenance/housekeeping in MVP.
2. Do not add business logic outside PMS Platform evidence.

#### `P8` - admin-proposal-loop

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Prove strong Agent value by generating proposal artifacts only.

交付物:

1. Proposal workspace creation under `/workspaces/{runId}/proposal/**` or configured local root.
2. `SKILL.md` proposal generation.
3. `eval-fixtures.json` generation.
4. `risk-report.md` generation.
5. `proposal_created` AgentResult.

验证:

1. Admin rule request creates all proposal files.
2. Generated `SKILL.md` includes the requested rule.
3. Risk report names PMS safety and non-publication boundary.
4. Write/edit outside proposal workspace denied.
5. Customer cannot use proposal tools.

review_cleanup:

1. Delete production publish stubs and speculative skill registry code.
2. Remove verbose generated comments from proposal scaffolds unless part of user-facing artifact.

done_when:

1. Loop 5 passes with audit IDs.
2. Proposal artifacts are isolated from production.
3. No publish path exists.

stop_boundary:

1. Stop if implementation needs production skill registry write.
2. Stop if admin profile gets unrestricted filesystem access.

必须避免:

1. Do not implement plugin marketplace or skill deployment.
2. Do not create long-lived tenant config mutation path.

#### `P9` - sandbox-exec-and-file-hardening

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Harden read/write/edit/bash as governed capabilities instead of forbidden concepts or naked tools.

交付物:

1. Path constraint tests for read/write/edit.
2. Bash allowlist tests for `pnpm test`, `pnpm build`, `tsc --noEmit`.
3. Bash deny tests for network, secrets, destructive, container, and cluster commands.
4. Timeout/no-network/no-secret documentation in SAFETY.

验证:

1. `pnpm test`, `pnpm build`, `tsc --noEmit` allowed only in sandbox constraints.
2. `curl`, `wget`, `ssh`, `scp`, `rm -rf`, `printenv`, `cat .env`, `docker`, `kubectl` denied.
3. Write/edit only proposal workspace.
4. Read only sandbox-allowed paths.

review_cleanup:

1. Remove broad shell parser features, aliases, command expansion helpers, and unused allowlist config.
2. Remove comments explaining obvious deny cases when tests already document them.

done_when:

1. Loop 6 passes.
2. Bash exists only as sandbox validation capability.
3. File tools cannot touch production/root/env paths.

stop_boundary:

1. Stop if tests require raw shell or broad filesystem access.
2. Stop if command parsing cannot be made deterministic with minimal code.

必须避免:

1. Do not add interactive shell sessions.
2. Do not add network broker in MVP.

#### `P10` - audit-and-eval-hardening

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Make the MVP explainable and regression-resistant.

交付物:

1. JSONL audit writer hardening.
2. Eval fixture runner and boundary assertions.
3. Fixture categories: grounding, prepare-confirm, natural confirm, sandbox, skill proposal, prompt injection, profile boundary, session continuity.
4. `pnpm eval` script.

验证:

1. Every tool call has audit event.
2. Audit contains no raw tokens/env/Feishu IDs/PMS payloads/guest PII.
3. `pnpm eval` fails on direct PMS mutation, sandbox escape, prompt injection, profile escalation, or uncited PMS fact.

review_cleanup:

1. Delete duplicated test fixtures and verbose fixture prose.
2. Remove audit fields not used by validation or operator review.

done_when:

1. High-risk evals pass.
2. Audit chain exists for PMS read/prepare-confirm and admin proposal flows.
3. Eval runs in CI/test script without production dependencies.

stop_boundary:

1. Stop if audit redaction cannot be proven.
2. Stop if eval requires live secrets or external network.

必须避免:

1. Do not defer eval to closeout.
2. Do not use exact wording assertions except safety-critical boundaries.

#### `P11` - end-to-end-integration-smoke

- Owner: `execute-plan`
- State: `DONE`
- Priority: `high`

目标:

- Prove the integrated upstream/middle/downstream MVP path without production rollout.

交付物:

1. Local smoke script or test wiring `adapter-feishu -> pms-agent-v2 -> pms-platform` with mocks/local sandbox.
2. Smoke for text reply, approval card, proposal-created, refusal.
3. Documentation for local run env with redacted examples only.
4. Evidence that sibling repos remain clean or intentional diffs are documented.

验证:

1. `pms-agent-v2 pnpm build/test/eval` pass.
2. `adapter-feishu npm test` passes after contract alignment.
3. `pms-platform npm test` passes if touched; if untouched, existing endpoint contract evidence is linked.
4. Local smoke validates typed-card callback remains adapter-to-platform.

review_cleanup:

1. Delete demo-only routes, temporary fixtures, compatibility aliases, and unused local scripts.
2. Remove all stale comments and broad debug logging.

done_when:

1. Six MVP loops pass together.
2. No legacy compatibility paths remain in `pms-agent-v2`.
3. Integration docs are minimal and reproducible.

stop_boundary:

1. Stop if passing smoke requires weakening Safety Gateway.
2. Stop if adapter/pms-platform ownership boundaries drift.

必须避免:

1. Do not claim production readiness.
2. Do not add rollout/gray deployment machinery.

#### `P12` - final-reality-audit-and-pack-closeout-prep

- Owner: `execution-reality-audit`
- State: `DONE`
- Priority: `high`

目标:

- Review implementation reality against roadmap and remove all slice-created redundancy, compatibility, comments, and dead paths before terminal closeout.

交付物:

1. Reality audit comparing docs, code, tests, and upstream/downstream contracts.
2. Static scan evidence for no legacy compatibility and no bypasses.
3. Cleanup commit/diff removing redundant abstractions, compatibility code, unused exports, stale comments, debug logs, dead fixtures.
4. Residual list for post-MVP work only.
5. Writeback that activates `PACK_COMPLETE` only if all non-deferred stages are done.

验证:

1. Full test/eval suite passes after cleanup.
2. Static scans pass after cleanup.
3. `git diff --check` passes in touched repos.
4. No TODO/comment claims future behavior as current behavior.

review_cleanup:

1. This slice is itself the cleanup/review gate; no redundant code may remain accepted.

done_when:

1. All implementation slices have accepted review evidence.
2. Cleanup removed all slice-created redundancy and compatibility surfaces.
3. STATUS/WORKSET can safely move to `PACK_COMPLETE`.

stop_boundary:

1. Stop if any legacy compatibility path remains.
2. Stop if any tool bypasses Safety Gateway.
3. Stop if any PMS fact can be emitted without evidence.
4. Stop if closeout would be premature.

必须避免:

1. Do not close out with residual bugs hidden as future work.
2. Do not keep comments or compatibility code "just in case".

#### `PACK_COMPLETE` — closeout

- Owner: `autopilot-closeout`
- State: `DONE`
- Priority: `terminal`

目标:

- Archive or close the pack only after `P12` accepted review marks the objective complete.

交付物:

1. Closeout summary.
2. Final evidence and residual handoff.
3. Hot/cold plan hygiene update.

验证:

1. README and archived WORKSET record `PACK_COMPLETE` as completed.
2. No non-deferred stages remain.
3. Closeout evidence cites final tests/evals/static scans.
4. Hot `docs/plan/` contains only `README.md`; closed pack evidence is in `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/`.

done_when:

1. Pack is terminal and no active implementation/review work remains.

stop_boundary:

1. If any non-terminal slice remains active, hand back to that slice; do not close out.

必须避免:

1. Do not use closeout to skip review or cleanup.

## Master Wave Plan

Prerequisites already accepted: `P0`, `P1`, and `P1A` established the clean monorepo, external adapter contract, and sibling integration seams.

### `W1` - safety-evidence-foundation

- Parent stages: `P2`, `P3`, `P4`
- Dominant boundary: policy, gated execution, and PMS evidence before any Agent runtime.
- Execute order: `P2` Safety Gateway kernel -> `P3` gated tool runner -> `P4` typed PMS evidence client.
- Validation shape: package unit tests, `pnpm build`, `pnpm test`, boundary guard, and `git diff --check` after each accepted stage.
- Accepted-review writeback: after `P2` review acceptance, activate `P3`; after `P3`, activate `P4`; after `P4`, activate `P5` and `W2`.
- Current nominated first stage: `P2` because no later runtime/tool slice may safely execute before capability/risk/constraint decisions and audit events exist.

### `W2` - runtime-service-boundary

- Parent stages: `P5`, `P6`
- Dominant boundary: connect `pi-coding-agent` only through gated tools, then expose only the new adapter API.
- Execute order: `P5` unified Agent runtime -> `P6` agent service API.
- Validation shape: current Pi docs/examples read before coding, runtime visibility tests, route normalization tests, `pnpm build`, `pnpm test`, boundary guard, and `git diff --check`.
- Accepted-review writeback: after `P6`, activate `P7` and `W3`.

### `W3` - product-loop-proof

- Parent stages: `P7`, `P8`
- Dominant boundary: prove customer PMS and admin proposal loops without adding production mutation or publish paths.
- Execute order: `P7` customer PMS loop -> `P8` admin proposal loop.
- Validation shape: evidence-grounded fixtures, approval-card pending-action proof, proposal workspace isolation tests, profile boundary tests, `pnpm build`, `pnpm test`, and `git diff --check`.
- Accepted-review writeback: after `P8`, activate `P9` and `W4`.

### `W4` - hardening-eval-integration

- Parent stages: `P9`, `P10`, `P11`
- Dominant boundary: harden file/bash/sandbox, audit/eval, and local end-to-end smoke before closeout audit.
- Execute order: `P9` sandbox/file hardening -> `P10` audit/eval hardening -> `P11` end-to-end integration smoke.
- Validation shape: deterministic deny/allow tests, `pnpm eval` from `P10` onward, local smoke with mocks/sandbox, sibling tests only when touched, and `git diff --check`.
- Accepted-review writeback: after `P11`, activate `P12` and `W5`.

### `W5` - reality-audit-closeout

- Parent stages: `P12`, `PACK_COMPLETE`
- Dominant boundary: evidence-driven reality audit, cleanup, and terminal parser truth only after all implementation stages are accepted.
- Execute order: `P12` final reality audit and cleanup -> `PACK_COMPLETE` repo-local closeout prompt.
- Validation shape: full build/test/eval/static scans, legacy/bypass/uncited-fact scans, plan parser validation, and closeout evidence.
- Accepted-review writeback: `P12` may activate `PACK_COMPLETE` only when no non-deferred stage remains.

## Continuous Wave Ladder

```text
W1(P2 -> P3 -> P4) -> W2(P5 -> P6) -> W3(P7 -> P8) -> W4(P9 -> P10 -> P11) -> W5(P12 -> PACK_COMPLETE)
```

Each stage follows:

```text
wave_plan -> execute -> review -> accepted-writeback -> next stage
```

Review acceptance is the only normal advancement point. Execute completion is not terminal.

## Global Validation Ladder

1. Per-package unit tests after each slice.
2. Boundary/static guard after any contract/tool/runtime change.
3. `pnpm build` and `pnpm test` for `pms-agent-v2` after each implementation slice.
4. `adapter-feishu npm test` after adapter alignment changes.
5. `pms-platform npm test` only if platform is touched; otherwise use existing endpoint contract evidence.
6. `pnpm eval` from P10 onward and after any Safety Gateway / Agent / tool prompt change.
7. `git diff --check` in every touched repo before review acceptance.

## Hard Closeout Guard

Closeout was accepted because:

1. `docs/plan/README.md` named `PACK_COMPLETE` before closeout.
2. `WORKSET` active stage was `PACK_COMPLETE` before closeout and is archived as completed.
3. `STATUS` active step was `PACK_COMPLETE` before closeout and is archived as completed.
4. `P12` accepted review evidence exists.
5. No non-deferred stage remains incomplete.

Final state: pack closed, active parser pack is `none`, and cold evidence lives under `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/`.
