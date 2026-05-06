# PMS Agent Workbench W0-W2 Closeout

Plan ID: `pms-agent-workbench-w0-w2-v1-2026-05-06`
Closeout state: `PACK_COMPLETE`
Closed on: 2026-05-06

## Verdict

The W0-W2 workspace/workbench foundation pack is closed. W0, W1, and W2 were implemented, reviewed, accepted, and reflected in parser truth before closeout.

This closeout is a local filesystem and Safety-gated foundation claim. It is not a production DB/object-storage, active-skill publication, Context Builder, or production-readiness claim.

## Completed scope

### W0 — workspace-contract-docs

Accepted artifacts:

- `docs/WORKSPACE.md`
- `docs/MEMORY_BOUNDARY.md`

Accepted result:

- Tenant workspace layout, logical path contract, zones, file kinds, blocked path rules, actor/operation matrix, proposal completeness, W1/W2 package expectations, and seven hard boundaries are documented as implementation SSOT.
- PMS truth remains evidence-only: workspace, session, skill, proposal, tmp, eval, and model text are advisory and cannot answer current PMS facts.

### W1 — workspace-core-store

Accepted artifacts:

- `packages/workspace-core/package.json`
- `packages/workspace-core/tsconfig.json`
- `packages/workspace-core/src/index.ts`
- `tests/workspace-core.test.ts`

Accepted result:

- Local filesystem tenant workspace core exists and builds.
- `createTenantWorkspace()`, `resolveTenantPath()`, `readWorkspaceFile()`, `writeProposalFile()`, and `validateSkillProposalCompleteness()` implement the W1 core surface.
- Tests prove tenant initialization, proposal-only writes, active/audit write denial, cross-tenant/traversal/absolute path denial, blocked `.env`/sensitive extensions, oversized input rejection, symlink escape rejection, resolver export, and skill proposal completeness.
- W1 review added target-symlink and parent-symlink write escape proof/hardening.

### W2 — workspace-tools-safety-gated

Accepted artifacts:

- `packages/workspace-tools/package.json`
- `packages/workspace-tools/tsconfig.json`
- `packages/workspace-tools/src/index.ts`
- `tests/workspace-tools.test.ts`
- `packages/safety-gateway/src/capability-registry.ts`
- `packages/safety-gateway/src/constraints.ts`
- `packages/safety-gateway/src/decision.ts`
- `packages/safety-gateway/src/policy-engine.ts`
- `packages/safety-gateway/src/risk.ts`
- `packages/gated-tools/src/run-gated-tool.ts`
- `packages/gated-tools/src/file-tools.ts`

Accepted result:

- Workspace tools package exists and exports gated tenant workspace adapters: `workspaceRead`, `workspaceWriteProposal`, `workspaceEditProposal`, `workspaceListActiveSkills`, and `workspaceCreateSkillProposal`.
- Safety Gateway has workspace-specific capabilities for read, proposal write/edit, active skill list, and skill proposal create.
- Tool requests carry tenantId, actor/profile, tenant workspace path, operation, reason, source episode refs, and risk level metadata.
- Workspace tools call Safety Gateway before workspace-core/filesystem side effects and write success evidence through a minimal workspace audit sink.
- Tests prove customer deny/no side effect, admin proposal-only write, active write denial, traversal/`.env`/sensitive extension/unsupported extension/oversize/symlink rejection, edit uniqueness, complete skill proposal creation, active skill listing, and workspace advisory-not-PMS-truth behavior.
- W2 review added Safety Gateway-sensitive extension denial and non-active proposal status prevalidation.

## Seven hard boundaries evidence

1. Tenant workspace initialization structure is correct — `tests/workspace-core.test.ts` validates skeleton directories and starter files.
2. Customer cannot write workspace — `tests/workspace-tools.test.ts` validates customer write denial and no filesystem side effect.
3. Admin can write proposal only — workspace tools and Safety Gateway constrain admin writes to `/workspaces/{tenantId}/proposals/{proposalId}/...`.
4. Active cannot be directly written — workspace tools/Safety Gateway tests deny active-area writes; active skill listing is read/list-only.
5. Unsafe paths/files are rejected — core and tool tests cover traversal, cross-tenant, absolute/local path, symlink escape, `.env`, sensitive names/extensions, unsupported extensions, and oversized input.
6. Skill proposal needs risk/eval/status — core and tool tests require `SKILL.md`, `eval-fixtures.json`, `risk-report.md`, and non-active `status.json` before structural completeness.
7. PMS truth is evidence-only — `docs/MEMORY_BOUNDARY.md`, `docs/WORKSPACE.md`, and workspace tool tests mark workspace artifacts as `workspace_advisory` and `canAnswerCurrentPmsFact: false`.

## Final evidence

Closeout validation commands:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm exec tsc -b packages/evals && node packages/evals/dist/index.js
git diff --check
```

Expected/observed closeout result:

```text
pnpm build: passed
pnpm test: passed; 15 test files / 101 tests; boundary guard passed; eval passed 8/8
pnpm guard:boundaries: passed
pnpm exec tsc -b packages/evals && node packages/evals/dist/index.js: passed; eval passed 8/8
git diff --check: passed
```

Additional accepted review evidence:

```bash
pnpm vitest run tests/workspace-core.test.ts
pnpm vitest run tests/workspace-tools.test.ts tests/safety-gateway.test.ts
plan_sync docs/plan
static scan of workspace-tools/tests/safety-gateway for Context Builder/promote/publish/raw executor/PMS-truth drift
```

## Residual handoff

Successor work must use a new plan pack. W0-W2 deliberately leave these residuals outside this pack:

1. Context Builder — future work may decide how active skills/advisory workspace context enters prompts. W0-W2 do not inject workspace context into runtime prompts.
2. Skill Proposal Flow hardening — future work may connect admin proposal runtime to workspace tools, add richer proposal schemas, and remove or migrate old MVP proposal surfaces if replacement ownership is clear.
3. Eval Runner — future work may execute proposal eval fixtures and store eval outputs under `evals/{runId}/`; W0-W2 only validate proposal fixture presence/JSON shape.
4. Approval/Promote — future work must implement approval cards, reviewer decisions, active promotion/archive/supersede, and publication rules. W0-W2 do not write active skill/policy areas.
5. Session Memory files — future work may persist bounded redacted session continuity files. W0-W2 only define the boundary and preserve current runtime continuity behavior.
6. Daily Sweep — future work may mine lessons or stale proposals under explicit policy. W0-W2 do not implement daily sweep or long-term memory mining.
7. Production DB/object storage — future work may replace local filesystem with production storage after a new plan and migration contract. W0-W2 intentionally remain local filesystem plus JSON/Markdown artifacts.
8. Unified-agent/admin proposal runtime migration — W2 did not migrate the existing admin proposal loop to `packages/workspace-tools` because W2 deliverables did not require runtime integration. A future slice should decide whether `workspace_*` tools replace old proposal tool paths, and must avoid duplicate ownership or Safety Gateway bypass.

No same-pack W0-W2 implementation/review residual remains open.

## Plan hygiene result

Hot parser surface after closeout:

```text
docs/plan/README.md
```

Cold archive surface:

```text
docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/
```

Archived parser files:

- `pms-agent-workbench-w0-w2-v1-2026-05-06_PLAN.md`
- `pms-agent-workbench-w0-w2-v1-2026-05-06_STATUS.md`
- `pms-agent-workbench-w0-w2-v1-2026-05-06_WORKSET.md`
- `pms-agent-workbench-w0-w2-v1-2026-05-06_CLOSEOUT.md`

## Re-promotion condition

Do not resume this pack as active work. Any successor effort must create a new plan pack that cites this archive as historical evidence and explicitly names scope, validation, replacement ownership, and residual handling.
