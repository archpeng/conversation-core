# Static Code Audit Debt - 2026-05-10

## Scope

This debt register records the static audit findings after the PMS hotel profile and room type catalog work. It is intentionally limited to code clarity, AI readability, Bitter Lesson alignment, compatibility residue, redundancy, and fixture duplication.

Latest repo-local verification after the AGENTS/readability cleanup:

- `pms-agent-v2`: `pnpm build` passed.
- `pms-agent-v2`: `pnpm test` passed with 28 Vitest files passed / 1 skipped, 190 tests passed / 2 skipped, boundary guard passed, and eval ok=true 21/21 with 22 audit events.

External residual closeout verification on 2026-05-11:

- `pms-platform`: `npm run verify` passed with boundary check, build, and 28 Vitest files / 108 tests.
- `pms-agent-v2`: `pnpm build` passed.
- `pms-agent-v2`: `pnpm test` passed with 28 Vitest files passed / 1 skipped, 190 tests passed / 2 skipped, boundary guard passed, and eval ok=true 21/21 with 22 audit events.

Original verification at the time of audit:

- `pms-agent-v2`: `pnpm build && pnpm test` passed, including 178 tests, boundary guard, and eval 21/21.
- `pms-platform`: `npm run verify` passed, including 105 tests.

No blocking correctness bug was found. The new PMS hotel profile and room type catalog path is enabled through typed PMS-owned reads. The old availability broad fallback and wildcard room-type compatibility path were not found in source.

## Debt Items

### DEBT-AI-001 - Deterministic customer intent rules remain in degraded fallback

Severity: medium

Status: resolved locally / bounded by owner module

Owner boundary: `pms-agent-v2` customer degraded loop

Evidence:

- `packages/unified-agent/src/customer-fallback-policy.ts:1`
- `packages/unified-agent/src/session.ts:91`

Finding:

The deterministic degraded fallback intent rules have been moved out of `customer-loop.ts` into `customer-fallback-policy.ts`. This keeps the regex rules visible as fallback policy only; `session.ts` still invokes the scaffold only when the LLM failed or returned empty output.

Bitter Lesson risk:

The degraded scaffold is acceptable as a safety fallback, but it must not grow into the primary PMS business brain. Adding more keywords here would move semantic routing away from the LLM and typed tool surface.

Cleanup direction:

Keep this path minimal. Future business behavior should still be released through Pi-native typed tools, PMS evidence, and response synthesis. If fallback coverage must expand, require a failing degradation test and document why the LLM-unavailable path needs it.

### DEBT-AI-002 - Output safety and evidence classification are regex-heavy

Severity: medium

Status: resolved locally / bounded by owner module

Owner boundary: `pms-agent-v2` response synthesis / output validation

Evidence:

- `packages/unified-agent/src/response-synthesis-policy.ts:1`
- `packages/unified-agent/src/response-synthesis.ts:6`

Finding:

The regex classifiers have been moved out of `response-synthesis.ts` into `response-synthesis-policy.ts` with a boundary note: they are output safety/evidence validation policy, not business routing. The main synthesis path now reads as contract validation and result assembly.

Bitter Lesson risk:

Keyword growth here can create brittle false positives and false negatives. Over time, typed evidence metadata and structured result intent should carry more of this burden than natural-language pattern matching.

Cleanup direction:

Prefer typed `currentPmsFact`, evidence refs, mutation status, and approval metadata over adding new phrases. Add regex only for security-sensitive leakage checks or as a short-lived guard with tests.

### DEBT-AI-003 - `pms-platform` local HTTP handler is too broad

Severity: medium

Status: resolved externally / archived in `pms-platform`

Owner boundary: `pms-platform` local HTTP boundary

Evidence:

- `/home/peng/dt-git/github/pms-platform/packages/api/src/localSandbox/httpHandler.ts:1`
- `/home/peng/dt-git/github/pms-platform/packages/api/src/localSandbox/httpReadRoutes.ts:1`
- `/home/peng/dt-git/github/pms-platform/packages/api/src/localSandbox/httpWorkflowRoutes.ts:1`
- `/home/peng/dt-git/github/pms-platform/docs/plan-archive/pms-platform-local-http-fixture-debt-d0-d2-v1-2026-05-11/pms-platform-local-http-fixture-debt-d0-d2-v1-2026-05-11_CLOSEOUT.md`

Finding:

`httpHandler.ts` has been reduced from a 463-line catch-all dispatcher to a thin local HTTP auth/error route orchestrator. Route behavior now lives in owner modules for health/manifest, command, read, workflow, operation request, pending action, and sandbox administration.

Bitter Lesson risk:

The original catch-all dispatcher risk is closed. Boundary docs and line-budget checks in `pms-platform` now protect the focused route-owner split.

Cleanup direction:

No further cleanup is needed for this debt item. Future local HTTP route growth should extend the matching owner module instead of growing `httpHandler.ts`.

### DEBT-AI-004 - Typed client surfaces and eval catalog are oversized

Severity: medium

Status: resolved locally

Owner boundary: `pms-agent-v2` platform client and eval suite

Evidence:

- `packages/pms-platform-client/src/schemas.ts:1`
- `packages/pms-platform-client/src/client.ts:1`
- `packages/evals/src/eval-cases.ts:1`
- `packages/evals/src/eval-cases.pms-helpers.ts:1`
- `packages/evals/src/eval-cases.tool-planning.ts:1`

Finding:

The oversized surfaces have been split by owner domain. `schemas.ts` and `client.ts` are compatibility surfaces over domain schema/client modules. `eval-cases.ts` is reduced to 343 lines, with PMS executor fixtures and tool-planning eval cases moved to focused modules.

Bitter Lesson risk:

Oversized typed surfaces invite local duplication and make future agents more likely to patch by proximity instead of using clear owner modules.

Cleanup direction:

Future typed client growth should add or extend the matching domain module instead of growing the compatibility surfaces.

### DEBT-AI-005 - Old single-tool synthesis path appears unused

Severity: low

Status: resolved locally

Owner boundary: `pms-agent-v2` session evidence synthesis

Evidence:

- `packages/unified-agent/src/session-evidence.ts:17`
- `packages/unified-agent/src/session-evidence.ts:128`

Finding:

The unused `synthesizeToolResult` and `isAvailabilityEvidence` exports were confirmed unused and removed from `session-evidence.ts`.

Bitter Lesson risk:

Dead compatibility code makes the active runtime harder to read and increases the chance of future patches using the wrong path.

Cleanup direction:

No further repo-local cleanup is needed unless a future public API compatibility requirement appears.

### DEBT-AI-006 - Small repeated executor fallback helpers and noisy test stubs

Severity: low

Status: resolved locally

Owner boundary: `pms-agent-v2` gated tool registration and tests

Evidence:

- `packages/unified-agent/src/tool-registration.ts:190`
- `packages/unified-agent/src/pms-capability-tools.ts:311`
- `packages/unified-agent/src/pms-workflow-tools.ts:270`

Finding:

`notConfiguredExecutor` is centralized in `packages/unified-agent/src/not-configured-executor.ts`. The noisy test stubs have been replaced with typed helper factories where practical, and source/test scans no longer find `as never`, double-cast, or `as Partial<T>` patterns except for the literal prompt text guard.

Bitter Lesson risk:

Small duplication is not the main risk, but repeated local helpers and broad casts train future edits to copy scaffolding instead of using a clear typed helper.

Cleanup direction:

Keep future test stubs behind the typed helper factories instead of local casts.

### DEBT-AI-007 - Sample hotel room-type mapping is duplicated across platform fixtures

Severity: low

Status: resolved externally / archived in `pms-platform`

Owner boundary: `pms-platform` sample hotel fixture/provisioning

Evidence:

- `/home/peng/dt-git/github/pms-platform/packages/contracts/src/fixtures.ts:1`
- `/home/peng/dt-git/github/pms-platform/packages/api/src/localServerMain.ts:1`
- `/home/peng/dt-git/github/pms-platform/packages/provisioning/src/profile.ts:1`
- `/home/peng/dt-git/github/pms-platform/docs/plan-archive/pms-platform-local-http-fixture-debt-d0-d2-v1-2026-05-11/pms-platform-local-http-fixture-debt-d0-d2-v1-2026-05-11_CLOSEOUT.md`

Finding:

The A/B/C/D/E sample hotel room-number to room-type mapping is now owned in `packages/contracts/src/fixtures.ts`. Local sandbox seed code and provisioning profile fixture code import the same owner instead of duplicating hand-coded truth.

Bitter Lesson risk:

The duplicated fixture-truth drift risk is closed for this mapping. Future sample hotel changes should update the shared fixture owner first.

Cleanup direction:

No further cleanup is needed for this debt item.
