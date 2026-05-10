# PMS Agent AGENTS Readability R0-R6 Workset

Plan id: `pms-agent-agents-readability-r0-r6-v1-2026-05-10`

## Intended Files

- `apps/agent-service/src/runtime.ts`
- `apps/agent-service/src/runtime-*.ts`
- `packages/pms-platform-client/src/*.ts`
- `packages/workspace-core/src/*.ts`
- `packages/evals/src/eval-cases.ts`
- `packages/evals/src/eval-cases.helpers.ts`
- `packages/evals/src/eval-cases.intent.ts`
- `packages/evals/src/eval-cases.pms-helpers.ts`
- `packages/evals/src/eval-cases.tool-planning.ts`
- `packages/unified-agent/src/customer-loop.ts`
- `packages/unified-agent/src/customer-fallback-policy.ts`
- `packages/unified-agent/src/not-configured-executor.ts`
- `packages/unified-agent/src/response-synthesis.ts`
- `packages/unified-agent/src/response-synthesis-policy.ts`
- `packages/unified-agent/src/session-evidence.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/pms-capability-tools.ts`
- `packages/unified-agent/src/pms-workflow-tools.ts`
- `tests/pms-platform-client*.test.ts`
- `tests/pms-platform-client.helpers.ts`
- `docs/debt/static-code-audit-debt-2026-05-10.md`
- `docs/plan/README.md`
- `docs/plan-archive/pms-agent-agents-readability-r0-r6-v1-2026-05-10/*`

## Constraints

- Preserve public imports from existing package entrypoints.
- Keep behavior changes out of extraction work.
- No boundary guard bypass.
- No `--no-verify`.

## Final Verification

- `pnpm build`
- `pnpm test`
- cast scan for `as never`, double-cast, and `as Partial<T>`
- line-count scan for owner-bound hotspots
