# Final Reality Audit

Scope: `pms-agent-v2-ai-native-mvp-v1-2026-05-06` P12 final audit before parser handoff to `PACK_COMPLETE` closeout.

## Verdict

The MVP implementation evidence is sufficient for closeout handoff after P12 review. This is not a production-readiness claim.

## Roadmap-to-reality checks

| Roadmap / plan claim | Reality evidence |
| --- | --- |
| Clean monorepo with no legacy runtime dependency | `scripts/boundary-guard.mjs`; `pnpm guard:boundaries`; static legacy scan over `apps`, `packages`, `package.json`, `scripts`. |
| Feishu turn input and AgentResult output contract | `packages/adapter-contracts/src/*`; `tests/adapter-contracts.test.ts`; `tests/agent-service.test.ts`; P1/P1A accepted review evidence in `docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/pms-agent-v2-ai-native-mvp-v1-2026-05-06_STATUS.md`. |
| Safety Gateway before executors | `packages/safety-gateway/src/*`; `packages/gated-tools/src/run-gated-tool.ts`; `tests/safety-gateway.test.ts`; `tests/gated-tools.test.ts`; `tests/sandbox-hardening.test.ts`. |
| PMS facts only from evidence envelopes | `packages/pms-platform-client/src/evidence.ts`; `packages/unified-agent/src/customer-loop.ts`; `tests/customer-pms-loop.test.ts`; `packages/evals/src/index.ts`. |
| Customer PMS read / prepare-confirm / natural-confirm boundary | `packages/unified-agent/src/customer-loop.ts`; `tests/customer-pms-loop.test.ts`; `tests/integration-smoke.test.ts`. |
| Admin proposal workspace loop without publish path | `packages/unified-agent/src/proposal-loop.ts`; `tests/admin-proposal-loop.test.ts`; `tests/integration-smoke.test.ts`. |
| Sandbox validation only | `packages/safety-gateway/src/policy-engine.ts`; `tests/sandbox-hardening.test.ts`; `tests/integration-smoke.test.ts`; `SAFETY.md`. |
| Audit and eval regression surface | `packages/safety-gateway/src/audit-log.ts`; `packages/evals/src/index.ts`; `pnpm eval`; `pnpm test`. |
| Local integration smoke across adapter/service/PMS boundaries | `tests/integration-smoke.test.ts`; `docs/local-integration-smoke.md`. |

## Static scan results

Required local checks for P12:

```bash
pnpm build
pnpm test
pnpm exec vitest run tests/integration-smoke.test.ts
pnpm guard:boundaries
rg -n "ai-conversation|ai-pms|pi-agent-core|body\.replies|replies\s*:|compat(?:ibility)?[-_/]?(?:v1|v2)|(?:v1|v2)[-_/]?compat(?:ibility)?" apps packages package.json scripts
rg -n "TODO|FIXME|XXX|debugger|demo-only|just in case" apps packages tests docs/local-integration-smoke.md docs/pms-platform-endpoint-map.md README.md SAFETY.md package.json scripts
```

Expected allowances:

- `scripts/boundary-guard.mjs` contains banned terms as scanner configuration.
- Negative tests contain old-contract and legacy strings only as rejection fixtures.
- `packages/evals/src/index.ts` and `scripts/boundary-guard.mjs` print deterministic CLI summaries; these are not debug logs or production logging paths.

## Sibling workspace state

P12 did not require sibling edits.

- `pms-agent-v2`: dirty with active MVP implementation and plan files.
- `adapter-feishu`: 7 pre-existing changed files from accepted upstream/downstream alignment work; P12 does not add sibling changes.
- `pms-platform`: clean.

## Residuals

Post-MVP only:

1. Production deployment/runbook and real secret wiring are intentionally out of MVP closeout scope.
2. Live Feishu/PMS smoke can run after closeout in an environment with approved credentials and ownership boundaries.
3. Durable production audit storage/retention is outside this local deterministic MVP; the MVP proves redacted JSONL shape and chains.

No accepted P12 residual is a hidden bug in the current local MVP evidence surface.
