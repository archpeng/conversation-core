# Static Code Audit Debt - 2026-05-10

## Scope

This debt register records the static audit findings after the PMS hotel profile and room type catalog work. It is intentionally limited to code clarity, AI readability, Bitter Lesson alignment, compatibility residue, redundancy, and fixture duplication.

Verification at the time of audit:

- `pms-agent-v2`: `pnpm build && pnpm test` passed, including 178 tests, boundary guard, and eval 21/21.
- `pms-platform`: `npm run verify` passed, including 105 tests.

No blocking correctness bug was found. The new PMS hotel profile and room type catalog path is enabled through typed PMS-owned reads. The old availability broad fallback and wildcard room-type compatibility path were not found in source.

## Debt Items

### DEBT-AI-001 - Deterministic customer intent rules remain in degraded fallback

Severity: medium

Owner boundary: `pms-agent-v2` customer degraded loop

Evidence:

- `packages/unified-agent/src/customer-loop.ts:30`
- `packages/unified-agent/src/session.ts:91`

Finding:

`customer-loop.ts` still contains deterministic regex intent detection for confirmation, booking, availability, room-type catalog, date cues, and follow-up cues. This is currently bounded because `session.ts` only invokes the scaffold when the LLM failed or returned empty output.

Bitter Lesson risk:

The degraded scaffold is acceptable as a safety fallback, but it must not grow into the primary PMS business brain. Adding more keywords here would move semantic routing away from the LLM and typed tool surface.

Cleanup direction:

Keep this path minimal. Future business behavior should be released through Pi-native typed tools, PMS evidence, and response synthesis. If fallback coverage must expand, require a failing degradation test and document why the LLM-unavailable path needs it.

### DEBT-AI-002 - Output safety and evidence classification are regex-heavy

Severity: medium

Owner boundary: `pms-agent-v2` response synthesis / output validation

Evidence:

- `packages/unified-agent/src/response-synthesis.ts:70`

Finding:

`response-synthesis.ts` uses several regex classifiers to detect current PMS facts, mutation claims, and unsafe output. This is a validation boundary rather than a business router, so the current shape is defensible, but the rule density is rising.

Bitter Lesson risk:

Keyword growth here can create brittle false positives and false negatives. Over time, typed evidence metadata and structured result intent should carry more of this burden than natural-language pattern matching.

Cleanup direction:

Prefer typed `currentPmsFact`, evidence refs, mutation status, and approval metadata over adding new phrases. Add regex only for security-sensitive leakage checks or as a short-lived guard with tests.

### DEBT-AI-003 - `pms-platform` local HTTP handler is too broad

Severity: medium

Owner boundary: `pms-platform` local HTTP boundary

Evidence:

- `/home/peng/dt-git/github/pms-platform/packages/api/src/localSandbox/httpHandler.ts:77`
- `/home/peng/dt-git/github/pms-platform/packages/api/src/localSandbox/httpHandler.ts:218`

Finding:

`httpHandler.ts` is a 463-line catch-all dispatcher. It mixes health, PMS reads, workflows, pending actions, reset/import, and other local sandbox concerns. The new hotel profile and room type catalog routes are implemented inside the same large handler.

Bitter Lesson risk:

Large catch-all dispatchers reduce AI readability and make future changes more likely to copy local route patterns instead of extending owner-bound modules.

Cleanup direction:

Extract route-owner handlers without changing behavior. Candidate slices: health/manifest, read routes, reservation workflow routes, pending-action routes, and sandbox administration routes.

### DEBT-AI-004 - Typed client surfaces and eval catalog are oversized

Severity: medium

Owner boundary: `pms-agent-v2` platform client and eval suite

Evidence:

- `packages/pms-platform-client/src/schemas.ts:1`
- `packages/pms-platform-client/src/client.ts:1`
- `packages/evals/src/eval-cases.ts:1`

Finding:

`schemas.ts` is 581 lines, `client.ts` is 448 lines, and `eval-cases.ts` is 812 lines. The code is still functional and typed, but AI readability is declining. The eval file exceeds the project test discipline threshold that asks files over roughly 500 lines to split by concern.

Bitter Lesson risk:

Oversized typed surfaces invite local duplication and make future agents more likely to patch by proximity instead of using clear owner modules.

Cleanup direction:

Split by domain without redesigning behavior. Candidate slices: hotel profile/catalog schema and client methods, availability schema and client methods, reservation workflow schema and client methods, and eval cases grouped by grounding, tool planning, workflow, and catalog behavior.

### DEBT-AI-005 - Old single-tool synthesis path appears unused

Severity: low

Owner boundary: `pms-agent-v2` session evidence synthesis

Evidence:

- `packages/unified-agent/src/session-evidence.ts:17`
- `packages/unified-agent/src/session-evidence.ts:128`

Finding:

`synthesizeToolResult` appears to be exported but unused. `isAvailabilityEvidence` also appears unused. They look like residue from an older single-tool synthesis path after `session.ts` moved to sequence-based Pi-native tool result handling.

Bitter Lesson risk:

Dead compatibility code makes the active runtime harder to read and increases the chance of future patches using the wrong path.

Cleanup direction:

Confirm with `rg` before editing, then delete unused exports and associated imports/tests if no external package consumes them.

### DEBT-AI-006 - Small repeated executor fallback helpers and noisy test stubs

Severity: low

Owner boundary: `pms-agent-v2` gated tool registration and tests

Evidence:

- `packages/unified-agent/src/tool-registration.ts:190`
- `packages/unified-agent/src/pms-capability-tools.ts:311`
- `packages/unified-agent/src/pms-workflow-tools.ts:270`

Finding:

`notConfiguredExecutor` is duplicated across three modules. Tests also contain many `as never` executor stubs. This does not affect production behavior, but it adds noise and makes test intent harder to scan.

Bitter Lesson risk:

Small duplication is not the main risk, but repeated local helpers and broad casts train future edits to copy scaffolding instead of using a clear typed helper.

Cleanup direction:

Move the helper to one local owner module or use a small typed test factory for executor maps. Keep production behavior unchanged.

### DEBT-AI-007 - Sample hotel room-type mapping is duplicated across platform fixtures

Severity: low

Owner boundary: `pms-platform` sample hotel fixture/provisioning

Evidence:

- `/home/peng/dt-git/github/pms-platform/packages/api/src/localServerMain.ts:117`
- `/home/peng/dt-git/github/pms-platform/packages/provisioning/src/profile.ts:3`

Finding:

The A/B/C/D/E sample hotel room-number to room-type mapping is encoded in both the local server seed path and provisioning profile fixture. This is sample/provisioning fixture data, not live business inference, but it is still duplicated hand-coded truth.

Bitter Lesson risk:

Duplicated fixture truth can drift and create confusing catalog/eval mismatches, especially when agents use sample hotel behavior as evidence while testing.

Cleanup direction:

Consolidate the sample hotel mapping into one fixture owner and import it from both seed/provisioning paths, or generate both from a single declarative fixture.

