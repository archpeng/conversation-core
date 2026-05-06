# PMS Agent Workbench W0-W2 Plan

Plan ID: `pms-agent-workbench-w0-w2-v1-2026-05-06`
Status: `ACTIVE`
Mode: `single-root-autopilot-compatible`
Source roadmap: `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`
Source design seed: tenant PMS Agent workspace/workbench design, scoped to W0-W2 only.

## Goal

Create the first production-shaped workspace/workbench foundation for `pms-agent-v2` without building a generic memory database.

The pack must turn the current MVP proposal-workspace proof into a bounded, tenant-scoped workspace contract and tool surface:

```text
W0 docs contract
  -> W1 workspace-core store/path/schema package
  -> W2 Safety-gated workspace tools package
```

The key law remains unchanged: PMS truth comes from `pms-platform` evidence, not workspace memory, session notes, skill text, or Agent transcript.

## Scope

In scope:

1. Document the tenant workspace/workbench contract.
2. Document the memory boundary between PMS authority, workspace advisory memory, mandatory safety policy, and session continuity.
3. Add `packages/workspace-core` for tenant workspace structure, schemas, path resolution, safe file operations, proposal completeness checks, and active/proposal/session/tmp directory boundaries.
4. Add `packages/workspace-tools` for gated workspace tool adapters that call Safety Gateway before reading/writing.
5. Extend or reuse Safety Gateway capability/policy definitions only as needed for workspace tools.
6. Add tests proving the seven first-phase hard boundaries.
7. Preserve existing MVP laws: no legacy `ai-conversation` runtime compatibility, no old `replies[]`, no direct Agent executor path, no PMS fact from memory.

## Non-Goals

Out of scope for this pack:

1. Context Builder prompt injection of active skills or tenant memory.
2. Skill approval, promote, archive, supersede, or active-skill publication flow.
3. Daily sweep, long-term lesson mining, cross-tenant learning, Mem0/Zep/Graphiti, or memory graph.
4. Production DB/object-storage implementation.
5. Admin UI or Feishu approval-card UX for workspace approval.
6. Live Feishu/PMS smoke with real credentials.
7. Broad file manager, generic plugin system, generic HTTP broker, or arbitrary bash expansion.

## Deliverables

1. `docs/WORKSPACE.md` describing tenant workspace layout, active/proposal/session/tmp/audit boundaries, file kinds, lifecycle, and MVP path constraints.
2. `docs/MEMORY_BOUNDARY.md` describing PMS truth vs workspace advisory memory vs safety policy vs session continuity.
3. `packages/workspace-core` with TypeScript source, package manifest, tsconfig, exports, and tests.
4. `packages/workspace-tools` with TypeScript source, package manifest, tsconfig, exports, and tests.
5. Safety Gateway updates for workspace-specific capabilities/constraints, if the current proposal/sandbox policy is insufficient.
6. Eval/test coverage for the required first-phase hard boundaries.
7. Root workspace config updates only where required to build/test the new packages.

## Constraints

- Keep this pack replacement-clean and narrow; do not add compatibility paths for old runtime surfaces.
- Agent-facing workspace writes must remain proposal-only in this pack.
- Active workspace areas are read-only to normal Agent turns and writable only by future promote/approval flows, which are out of scope here.
- Every workspace tool execution must go through Safety Gateway before side effects.
- Write operations must require an explicit reason and proposal completeness metadata where applicable.
- Do not store current PMS state as memory or workspace truth.
- Do not build persistence abstractions beyond local filesystem plus JSON/Markdown artifacts needed by W0-W2 tests.
- If this pack runs under extension autopilot, each active-slice phase ends with exactly one `autopilot_report` and `stepId` equal to the active slice ID.
- `execute/completed` routes to same-slice review; accepted `review/completed` is the docs/plan writeback point for the next slice.

## Verification

Minimum verification for this pack:

1. `pnpm build`
2. `pnpm test`
3. `pnpm guard:boundaries`
4. `pnpm eval`
5. Targeted tests for `workspace-core` and `workspace-tools`.
6. Static/source checks proving no new legacy compatibility and no workspace memory as PMS truth.
7. `plan_sync` against `docs/plan` after pack creation and after accepted slice writeback.
8. `git diff --check` before review/closeout.

## Required First-Phase Hard Boundaries

The implementation and tests for W0-W2 must prove:

1. Tenant workspace initialization structure is correct.
2. `customer_pms` / customer actor cannot write workspace content.
3. Admin can write proposal content only.
4. Active areas cannot be directly written by Agent workspace tools.
5. Path traversal, symlink escape, `.env`, secret/private-key-like paths, blocked extensions, and oversized files are rejected before executor write/read.
6. A proposal intended as a skill proposal must include risk, eval, and status artifacts before it can be considered complete.
7. PMS truth still comes only from `pms-platform` evidence; workspace memory, skill text, and session notes are advisory only.

## Blockers / Risks

1. Existing `packages/gated-tools` already has proposal file tools; W2 must avoid duplicating or weakening that boundary. Prefer replacing/augmenting with workspace-specific naming only when tests justify it.
2. Path security can be subtle; W1 must normalize paths, reject absolute/user-controlled escapes, and handle symlinks through filesystem checks in tests.
3. If Safety Gateway capability naming conflicts with existing `proposal_write`/`sandbox_*`, stop and replan the minimal capability migration instead of adding parallel bypasses.
4. If proposal completeness becomes product workflow design rather than structural validation, keep W1 to structural checks and defer workflow semantics.

## Autopilot Transition Contract

- Planning phases prepare or repair parser truth; they do not claim implementation completion.
- `execute/completed` dispatches `review` for the same active slice and must not advance `Stage Order` by itself.
- `review/completed` accepts the active slice, writes completion evidence, and advances README/STATUS/WORKSET to the next stage or `PACK_COMPLETE`.
- `review/continue` keeps the same active slice for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stops; `done` is reserved for whole-objective completion and closeout.
- Closeout is forbidden unless README and WORKSET parse as active slice `PACK_COMPLETE`, owner `autopilot-closeout`, state `READY` or `DONE`, and no non-deferred W0-W2 stages remain.

## Slice Definitions

#### `W0` — workspace-contract-docs

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Define the PMS Agent tenant workspace/workbench contract and memory boundary as repo-local SSOT before implementation.

交付物：

1. `docs/WORKSPACE.md` with directory layout, file kinds, active/proposal/session/tmp/audit zones, tool permissions, path constraints, lifecycle, and W0-W2 package mapping.
2. `docs/MEMORY_BOUNDARY.md` with authority labels: `pms-platform` evidence as authority, Safety Gateway as mandatory, workspace memory/skills/session as advisory.
3. Tests or static assertions if existing doc/boundary guard style supports them; otherwise explicit validation commands and static scans.
4. Updated docs references only where necessary, without broad roadmap rewrite.

验证：

1. `pnpm build`
2. `pnpm test`
3. `pnpm guard:boundaries`
4. `rg -n "Graphiti|Mem0|Zep|memory graph|current room state|current price|current inventory" docs/WORKSPACE.md docs/MEMORY_BOUNDARY.md` reviewed so forbidden concepts are framed as non-goals/boundaries, not implementation commitments.
5. `git diff --check`

review_cleanup:

1. Remove speculative production DB, UI, approval/promote, daily sweep, or Context Builder implementation detail if it drifts beyond W0-W2.
2. Keep docs dense and executable; avoid marketing prose.

置信检查：

1. A future W1 implementer can derive exact path/schema/store requirements from the docs.
2. A future W2 implementer can derive exact workspace tool permission requirements from the docs.


done_when:

1. `docs/WORKSPACE.md` and `docs/MEMORY_BOUNDARY.md` exist and explicitly define all seven hard boundaries.
2. Docs state that PMS current facts are never stored as workspace truth and must be re-read/cited from `pms-platform` evidence.
3. Docs state active/proposal/session/tmp/audit write/read ownership and W0-W2 package boundaries.
4. Validation commands complete or any skipped verification is justified as not applicable to docs-only changes.

stop_boundary:

1. Stop if documentation requires deciding approval/promote UX, DB/object storage, Context Builder injection, or long-term memory graph semantics.
2. Stop if any doc implies workspace memory can answer current PMS fact questions.
3. Stop if scope expands into implementation before W0 docs are review-accepted.

必须避免：

1. Do not implement packages in W0 unless a tiny test/doc guard is already repo-standard and necessary.
2. Do not add Mem0/Zep/Graphiti or generic memory DB commitments.
3. Do not weaken existing Safety Gateway or PMS evidence laws.

#### `W1` — workspace-core-store

- Owner: `execute-plan`
- State: `queued`
- Priority: `critical`

目标：

- Implement the local filesystem tenant workspace core with safe paths, schemas, initialization, structural proposal validation, and no Safety Gateway bypass.

交付物：

1. `packages/workspace-core/package.json`, `tsconfig.json`, and source exports.
2. Workspace types such as tenant scope, file kind, write mode, workspace zone, proposal manifest/status, and proposal completeness result.
3. `createTenantWorkspace()` creating the minimal tenant directory structure and starter files from W0 docs.
4. `resolveTenantPath()` / path guard helpers rejecting cross-tenant paths, traversal, absolute escape, blocked names, blocked extensions, symlink escape, and oversized file inputs.
5. `readWorkspaceFile()` for allowed workspace file reads with file size/type enforcement.
6. `writeProposalFile()` or equivalent proposal-only writer that cannot write active/policy/audit roots.
7. `validateSkillProposalCompleteness()` or equivalent structural check requiring `SKILL.md`, `eval-fixtures.json`, `risk-report.md`, and `status.json` for skill proposals.
8. Unit tests proving tenant initialization and path/security/proposal-completeness boundaries.

验证：

1. `pnpm build`
2. `pnpm test`
3. Targeted `workspace-core` tests for create/read/write/resolve/validate.
4. `pnpm guard:boundaries`
5. `git diff --check`

review_cleanup:

1. Delete unused schema helpers, broad storage abstraction interfaces, DB placeholders, and comments that restate obvious code.
2. Keep filesystem implementation deterministic and test-local.

置信检查：

1. No API in `workspace-core` writes active areas except an explicitly future-reserved promote-only path that is not callable by W1 tests.
2. No API returns current PMS facts from workspace files.


done_when:

1. New package builds and exports only the minimal W1 core surface.
2. Tests prove tenant workspace initialization structure is correct.
3. Tests prove path traversal, cross-tenant path, absolute path, symlink escape, `.env`, blocked sensitive paths/extensions, and active writes are denied.
4. Tests prove proposal completeness requires risk, eval, and status artifacts for skill proposals.
5. Existing MVP tests/evals/guards still pass.

stop_boundary:

1. Stop if implementing secure path resolution requires OS/platform assumptions not covered by deterministic tests.
2. Stop if persistence choices expand beyond local filesystem and JSON/Markdown artifacts.
3. Stop if caller identity/profile policy starts being implemented in core instead of Safety Gateway/tool layer.

必须避免：

1. Do not add Context Builder, prompt injection, active skill loading for Agent runtime, or approval/promote/archive logic.
2. Do not add generic storage adapters or DB index tables.
3. Do not expose raw filesystem paths without tenant scope validation.

#### `W2` — workspace-tools-safety-gated

- Owner: `execute-plan`
- State: `queued`
- Priority: `critical`

目标：

- Expose workspace operations as Safety-gated tools and prove profile/path/write boundaries before any workspace side effect.

交付物：

1. `packages/workspace-tools/package.json`, `tsconfig.json`, and source exports.
2. Gated tool adapters for the W0-W2 surface, such as `workspace_read`, `workspace_write_proposal`, `workspace_edit_proposal`, `workspace_list_active_skills`, and `workspace_create_skill_proposal`, scoped to what W1 core supports.
3. Safety Gateway capability/constraint updates for workspace read/write/edit/create/list if existing proposal capabilities are insufficient.
4. Tool requests carrying tenantId, actor/profile, operation, path/proposalId, reason, source episode refs where applicable, and risk level for writes.
5. Audit events for every allow/deny and for successful writes/edits through existing audit interfaces or minimal new workspace audit event shape.
6. Tests proving customer cannot write, admin can write proposal only, active writes are denied, traversal/symlink/`.env` are denied, proposal completeness is enforced, and PMS truth remains evidence-only.
7. Unified-agent integration update only if needed to use the new workspace tools for admin proposal generation; otherwise leave runtime unchanged and tested.

验证：

1. `pnpm build`
2. `pnpm test`
3. `pnpm eval`
4. `pnpm guard:boundaries`
5. Targeted `workspace-tools` tests around Safety Gateway call-before-executor and deny-no-side-effect.
6. Existing `tests/admin-proposal-loop.test.ts`, `tests/gated-tools.test.ts`, and `tests/safety-gateway.test.ts` still pass or are deliberately migrated without compatibility duplicates.
7. `git diff --check`

review_cleanup:

1. Remove any duplicate old proposal tool path if W2 fully replaces it in touched surfaces; otherwise document why both remain temporarily and ensure no bypass.
2. Delete unused tool wrappers, unused capability IDs, and explanatory comments not needed for public docs.

置信检查：

1. Every workspace side-effect test asserts Safety Gateway decision/audit happens before executor execution.
2. Denied workspace operations never call the filesystem executor.


done_when:

1. Workspace tools package builds and exports gated W2 tools.
2. Tests prove customer cannot write workspace content and admin can write proposal content only.
3. Tests prove active area writes are denied through tools.
4. Tests prove traversal, symlink, `.env`, sensitive paths, invalid extensions, and oversized inputs are rejected before side effects.
5. Tests prove skill proposals cannot be considered complete without risk, eval, and status artifacts.
6. Tests prove PMS truth still requires `pms-platform` evidence and cannot be satisfied from workspace memory/skill/session text.
7. Existing full build/test/eval/guard suite passes.

stop_boundary:

1. Stop if Safety Gateway cannot express workspace operations without broad rewrite; replan capability migration.
2. Stop if workspace tools need approval/promote/archive or Context Builder injection to pass W2 tests.
3. Stop if integrating unified-agent would introduce duplicate tool paths or bypass existing gated runner.

必须避免：

1. Do not directly expose raw read/write/edit/bash to the Agent.
2. Do not implement active promotion or production skill publication.
3. Do not widen admin tools to sandbox bash/network/secrets beyond existing policy.
4. Do not keep compatibility duplicates if W2 replaces an old path in the same touched surface.

#### `PACK_COMPLETE` — workbench-foundation-closeout

- Owner: `autopilot-closeout`
- State: `queued`
- Priority: `terminal`

目标：

- Close this W0-W2 pack only after accepted review proves all workspace foundation boundaries are implemented and no non-deferred W0-W2 work remains.

交付物：

1. Closeout summary citing W0-W2 deliverables and validation evidence.
2. Residual handoff for W3+ work: Context Builder, Skill Proposal Flow hardening, Eval Runner, Approval/Promote, Session Memory files, Daily Sweep, production DB/object storage.
3. Hot/cold plan hygiene update.

验证：

1. `pnpm build`
2. `pnpm test`
3. `pnpm eval`
4. `pnpm guard:boundaries`
5. `plan_sync` shows terminal parser truth only when closeout is intended.
6. `git diff --check`


done_when:

1. W0, W1, and W2 are accepted by review and marked done.
2. No non-deferred stage remains in this pack.
3. Closeout artifact records evidence and residual handoff.

stop_boundary:

1. If any W0-W2 slice remains active, queued, failed, or needs review, hand back to that slice; do not close out.
2. If W2 leaves duplicate workspace/proposal tool paths with unclear ownership, replan instead of closing.

必须避免：

1. Do not use closeout to skip W2 review or boundary cleanup.
2. Do not claim production-ready memory/workbench beyond the local W0-W2 foundation.

## Exit Criteria

The pack is complete only when:

1. W0-W2 accepted reviews are reflected in README/STATUS/WORKSET.
2. The seven required hard boundaries are proven by docs and tests.
3. PMS truth boundary remains unchanged and tested.
4. No active/proposal/session workspace implementation bypasses Safety Gateway.
5. Hot `docs/plan/` is either the active triplet or terminal closeout manifest; closed evidence is archived.
