# PMS Agent Workbench W0-W2 Workset

Plan ID: `pms-agent-workbench-w0-w2-v1-2026-05-06`

## Stage Order

- [ ] `W0` workspace-contract-docs
- [ ] `W1` workspace-core-store
- [ ] `W2` workspace-tools-safety-gated
- [ ] `PACK_COMPLETE` workbench-foundation-closeout

## Active Stage

### `W0`

- Owner: `execute-plan`
- State: `READY`
- Priority: `critical`

目标：

- Define the PMS Agent tenant workspace/workbench contract and memory boundary as repo-local SSOT before implementation.

必须交付：

1. `docs/WORKSPACE.md` with directory layout, file kinds, active/proposal/session/tmp/audit zones, tool permissions, path constraints, lifecycle, and W0-W2 package mapping.
2. `docs/MEMORY_BOUNDARY.md` with authority labels: `pms-platform` evidence as authority, Safety Gateway as mandatory, workspace memory/skills/session as advisory.
3. Validation evidence showing the docs preserve the existing Safety Gateway and PMS evidence laws.

执行步骤：

1. Read existing architecture/safety/roadmap anchors before writing docs: `README.md`, `ARCHITECTURE.md`, `SAFETY.md`, and `docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md` only as needed.
2. Write `docs/WORKSPACE.md` as the W0-W2 workspace/workbench contract, not a full future memory platform spec.
3. Write `docs/MEMORY_BOUNDARY.md` to lock authority labels and forbid workspace/session/skill memory from becoming PMS truth.
4. Verify both docs explicitly cover the seven hard boundaries.
5. Run validation commands: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, static scan/review, and `git diff --check`.
6. Review-clean speculative W3+ implementation detail from the docs.

预期：

- Future W1/W2 implementers can implement core and tools without re-deciding workspace layout, path constraints, or memory authority semantics.

测试预期：

- Existing build/test/guard suite remains green.
- Static review confirms PMS facts remain evidence-only.

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

## Slice Ownership

### `W0`

- `docs/WORKSPACE.md`
- `docs/MEMORY_BOUNDARY.md`
- optional narrow doc references in root docs only if required for discoverability

### `W1`

- `packages/workspace-core/package.json`
- `packages/workspace-core/tsconfig.json`
- `packages/workspace-core/src/**`
- `tests/workspace-core.test.ts` or package-local equivalent
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.json` only if required for the new package build

### `W2`

- `packages/workspace-tools/package.json`
- `packages/workspace-tools/tsconfig.json`
- `packages/workspace-tools/src/**`
- `packages/safety-gateway/src/**` only for required workspace capability/constraint updates
- `packages/gated-tools/src/**` only if replacing/aligning old proposal tool paths without bypass
- `packages/unified-agent/src/**` only if admin proposal loop must use the new workspace tools
- `tests/workspace-tools.test.ts` or package-local equivalent
- existing tests touched only for deliberate migration, not compatibility duplication

## Expected Verification

For W0:

- `pnpm build`
- `pnpm test`
- `pnpm guard:boundaries`
- static scan/review of `docs/WORKSPACE.md` and `docs/MEMORY_BOUNDARY.md` for PMS truth boundary and non-goal framing
- `git diff --check`

For W1:

- `pnpm build`
- `pnpm test`
- targeted workspace-core tests for initialization, path normalization, tenant isolation, active write denial, blocked files, symlink escape, file size/type, and proposal completeness
- `pnpm guard:boundaries`
- `git diff --check`

For W2:

- `pnpm build`
- `pnpm test`
- `pnpm eval`
- `pnpm guard:boundaries`
- targeted workspace-tools tests for Safety Gateway call-before-executor, deny-no-side-effect, profile boundaries, active write denial, traversal/symlink/`.env` denial, and proposal completeness
- existing admin proposal/gated tools/safety tests remain green or are intentionally migrated without bypass
- `git diff --check`

## Autopilot Transition Contract

- `execute/completed` proves implementation evidence and dispatches same-slice `review`.
- Do not mark or advance the active slice from execute alone unless the whole objective reports `done` at terminal closeout.
- `review/completed` is the accepted writeback gate that marks the reviewed slice complete and loads the next `Stage Order` item as `Active Stage`.
- `review/continue` keeps this `Active Stage`; `needs_replan` routes to `replan`; hard stops leave this stage active for repair.
- The next execute phase may run only after README/STATUS/WORKSET parse with the same active slice and intended handoff.
- Closeout is forbidden unless `PACK_COMPLETE` is active and W0-W2 are accepted.

## Execution Notes

- Under extension autopilot, the active stage ID is the `stepId` for active-slice reports.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Do not make “ask whether to continue” the default stop rule; use the active stage `done_when` / `stop_boundary`.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Keep transition contract explicit whenever the workset is repaired or superseded.

## Detailed Execution Queue

### `W0` workset — workspace-contract-docs

执行步骤：

1. Confirm the repo still has no active W0-W2 implementation packages.
2. Draft `docs/WORKSPACE.md` with:
   - tenant workspace root contract;
   - active/proposal/session/tmp/audit zone definitions;
   - allowed file kinds and blocked files;
   - profile/operation matrix;
   - proposal completeness requirements;
   - W1/W2 API expectations;
   - explicit non-goals for W3+ work.
3. Draft `docs/MEMORY_BOUNDARY.md` with:
   - authority hierarchy: mandatory Safety Gateway, authoritative PMS evidence, advisory workspace/session/skill memory;
   - current PMS fact ban;
   - allowed session continuity;
   - eval expectations for memory-not-truth.
4. Verify the seven hard boundaries are named exactly enough for tests in W1/W2.
5. Run validation and cleanup.

预期：

- W0 creates a dense SSOT, not a generic product essay.

测试预期：

- Build/test/guard remain green.
- Static review finds no claim that workspace memory can answer current PMS fact questions.

### `W1` workset — workspace-core-store

执行步骤：

1. Add the `workspace-core` package to pnpm/TypeScript build config.
2. Add tests first for tenant workspace initialization and path denial cases.
3. Implement tenant workspace root resolution with explicit tenant scope.
4. Implement allowed directory creation for README/MEMORY/PROFILE, skills active/archived, policies active/proposals, proposals, sessions, memory, evals, audit, tmp.
5. Implement path normalization and filesystem checks, including symlink escape prevention.
6. Implement proposal-only write helpers and deny active/policies/audit direct writes.
7. Implement skill proposal completeness check requiring `SKILL.md`, `eval-fixtures.json`, `risk-report.md`, and `status.json`.
8. Run full validation and cleanup.

预期：

- Core is policy-light and filesystem-safe; profile decisions remain for Safety Gateway/tool layer.

测试预期：

- Initialization snapshot/structure test passes.
- Traversal, cross-tenant, absolute path, symlink, `.env`, blocked sensitive path, blocked extension, oversize, and active-write tests pass.
- Incomplete proposal test fails until all required artifacts exist.

### `W2` workset — workspace-tools-safety-gated

执行步骤：

1. Add the `workspace-tools` package to pnpm/TypeScript build config.
2. Add tests proving all workspace tool side effects call Safety Gateway before executor/core operation.
3. Define the minimal W2 workspace tool request/response types.
4. Implement `workspace_read`, `workspace_write_proposal`, `workspace_edit_proposal`, `workspace_list_active_skills`, and `workspace_create_skill_proposal` only to the W2-supported depth.
5. Extend Safety Gateway capabilities/constraints if existing `proposal_*` capabilities cannot express tenant workspace operations.
6. Ensure write/edit requires reason and records audit result.
7. Add negative tests for customer write, admin active write, traversal/symlink/`.env`, and incomplete proposal.
8. Add or update one eval/test proving workspace memory cannot satisfy a PMS current-fact answer without `pms-platform` evidence.
9. Run full validation and cleanup.

预期：

- Workspace tools become the only allowed workspace side-effect surface; no raw file executor reaches Agent turns.

测试预期：

- Denied operations do not call executor/core write.
- Admin proposal writes succeed only under tenant proposal roots.
- Active writes are denied.
- PMS truth boundary remains evidence-only.

### `PACK_COMPLETE` workset — workbench-foundation-closeout

执行步骤：

1. Confirm W0-W2 accepted reviews are reflected in STATUS/WORKSET.
2. Run final validation: `pnpm build`, `pnpm test`, `pnpm eval`, `pnpm guard:boundaries`, `plan_sync`, `git diff --check`.
3. Write closeout evidence and residual handoff for W3+ work.
4. Move completed pack to `docs/plan-archive/` and shrink hot `docs/plan/` according to repo convention.

预期：

- This pack closes with local workspace foundation only, not production memory platform completion.

测试预期：

- All W0-W2 gates are green and no non-deferred stages remain.
