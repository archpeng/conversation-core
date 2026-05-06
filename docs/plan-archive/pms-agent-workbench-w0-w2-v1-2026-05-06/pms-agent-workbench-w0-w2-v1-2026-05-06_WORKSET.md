# PMS Agent Workbench W0-W2 Workset

Plan ID: `pms-agent-workbench-w0-w2-v1-2026-05-06`

## Stage Order

- [x] `W0` workspace-contract-docs
- [x] `W1` workspace-core-store
- [x] `W2` workspace-tools-safety-gated
- [x] `PACK_COMPLETE` workbench-foundation-closeout

## Active Stage

### `PACK_COMPLETE`

- Owner: `autopilot-closeout`
- State: `DONE`
- Priority: `terminal`

目标：

- Close this W0-W2 pack only after accepted review proves all workspace foundation boundaries are implemented and no non-deferred W0-W2 work remains.

必须交付：

1. Closeout summary citing W0-W2 deliverables and validation evidence.
2. Residual handoff for W3+ work: Context Builder, Skill Proposal Flow hardening, Eval Runner, Approval/Promote, Session Memory files, Daily Sweep, production DB/object storage.
3. Hot/cold plan hygiene update.

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

执行证据：

1. `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_CLOSEOUT.md` written with W0-W2 evidence and residual handoff.
2. `README`, `PLAN`, `STATUS`, and `WORKSET` prepared for hot/cold plan hygiene and archive.

## Completed Stage Evidence

### `W2`

1. `packages/workspace-tools/package.json`, `packages/workspace-tools/tsconfig.json`, and `packages/workspace-tools/src/index.ts` added.
2. `tsconfig.json` now references `packages/workspace-tools`; `pnpm-lock.yaml` records the new workspace package and dependencies.
3. Safety Gateway now has workspace capabilities/constraints for read, proposal write/edit, active skill list, and skill proposal create without adding raw executor capabilities.
4. Workspace tool requests carry tenantId, actor, tenant workspace path, operation, reason, source episode refs, and risk level metadata.
5. Workspace tools call Safety Gateway before core/filesystem work and record successful write/edit/create events through a minimal workspace audit sink.
6. `tests/workspace-tools.test.ts` added with 6 tests for customer deny/no side effect, admin proposal write, reason requirement, active write denial, traversal/`.env`/sensitive extension/oversize/symlink rejection, edit uniqueness, complete skill proposal creation, active skill listing, and workspace advisory-not-PMS-truth behavior.
7. W2 review added proof/hardening for Safety Gateway-sensitive extension denial and non-active proposal status prevalidation.
8. `pnpm vitest run tests/workspace-tools.test.ts tests/safety-gateway.test.ts` passed.
9. `pnpm build` passed.
10. `pnpm test` passed: 15 test files, 101 tests, boundary guard, eval 8/8.
11. `pnpm guard:boundaries` passed.
12. `pnpm exec tsc -b packages/evals && node packages/evals/dist/index.js` passed: eval 8/8.
13. `git diff --check` passed.

### `W1`

1. `packages/workspace-core/package.json`, `packages/workspace-core/tsconfig.json`, and `packages/workspace-core/src/index.ts` added.
2. `tsconfig.json` now references `packages/workspace-core` for root build.
3. `tests/workspace-core.test.ts` added with tests for initialization, safe read/write, active/audit write denial, cross-tenant/traversal/absolute path denial, blocked `.env`/key paths, oversize rejection, symlink escape, resolver export, and proposal completeness.
4. W1 review added proof for target symlink write escape and parent symlink mkdir escape, then hardened write path preparation before `writeFile`.
5. `pnpm vitest run tests/workspace-core.test.ts` passed.
6. `pnpm build` passed.
7. `pnpm test` passed: 14 test files, 95 tests, boundary guard, eval 8/8.
8. `pnpm guard:boundaries` passed.
9. `git diff --check` passed.

### `W0`

1. `docs/WORKSPACE.md` created with tenant root, zones, path constraints, actor/operation matrix, proposal completeness, W1/W2 package expectations, and seven hard boundaries.
2. `docs/MEMORY_BOUNDARY.md` created with authority labels, current PMS fact ban, advisory workspace/session/skill memory rules, and memory interpretation of the seven hard boundaries.
3. `pnpm build` passed.
4. `pnpm test` passed: 13 test files, 90 tests, boundary guard, eval 8/8.
5. `pnpm guard:boundaries` passed.
6. Static scan reviewed forbidden memory database/current-fact terms; only `current room state` and `current price` appear as explicit examples of memory content that must not become truth.
7. `git diff --check` passed.
8. W0 review accepted the docs and advanced active stage to W1.

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

## Machine Queue

- active_step: `PACK_COMPLETE`
- latest_completed_step: `W2`
- intended_handoff: `autopilot-closeout`
- latest_closeout_summary: W2 review accepted; active parser truth advanced to PACK_COMPLETE.
- latest_verification:
  - `Read routed execution-reality-audit skill and anchored README/PLAN/STATUS/WORKSET plus W2 code/tests/Safety Gateway changes before verdict.`
  - `Confirmed workspace-tools package exports gated read, proposal write/edit, active skill list, and skill proposal create, all routed through Safety Gateway before workspace-core/filesystem side effects.`
  - `Review added proof/hardening: Safety Gateway denies sensitive .key paths before core, unsupported extensions still fail before write, and active status.json is rejected before skill proposal writes.`
  - `Validation passed: pnpm vitest run tests/workspace-tools.test.ts tests/safety-gateway.test.ts; pnpm build; pnpm test (15 files, 101 tests, guard, eval 8/8); pnpm guard:boundaries; pnpm exec tsc -b packages/evals && node packages/evals/dist/index.js; git diff --check.`
  - `Static scan of workspace-tools/tests/safety-gateway found no new Context Builder/promote/publish/raw executor/PMS-truth path; matches only were pre-existing sandbox_bash capability definitions.`
  - `plan_sync after review writeback shows STATUS/WORKSET W0-W2 done=3 pending=1 and README/STATUS/WORKSET now set active slice PACK_COMPLETE with intended handoff autopilot-closeout.`
  - `packages/workspace-tools/src/index.ts`
  - `tests/workspace-tools.test.ts`
  - `packages/safety-gateway/src/policy-engine.ts`
  - `packages/safety-gateway/src/capability-registry.ts`
  - `packages/safety-gateway/src/constraints.ts`
  - `packages/gated-tools/src/run-gated-tool.ts`
  - `docs/plan/README.md`
  - `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_PLAN.md`
  - `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_STATUS.md`
  - `docs/plan/pms-agent-workbench-w0-w2-v1-2026-05-06_WORKSET.md`