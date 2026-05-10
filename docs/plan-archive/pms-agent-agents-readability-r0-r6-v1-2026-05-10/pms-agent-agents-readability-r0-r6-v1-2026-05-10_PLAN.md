# PMS Agent AGENTS Readability R0-R6 Plan

Plan id: `pms-agent-agents-readability-r0-r6-v1-2026-05-10`

## Goal

Bring `pms-agent-v2` back under the repo AGENTS baseline by removing production cast debt, extracting owner-bound oversized modules, updating plan metadata, and closing the in-repo static AI readability debt items that belong to this repository.

## Slices

### R0 - Runtime Boundary Cleanup

Owner boundary: `apps/agent-service` runtime adapters, Pi session, resource context, and HTTP server.

Done when:

- Production `as never` and double-casts in `apps/agent-service/src/runtime.ts` are removed.
- `runtime.ts` is a lean compatibility export surface.
- Runtime behavior and public exports remain compatible.

Gate: `pnpm build`

### R1 - PMS Platform Client Split

Owner boundary: `packages/pms-platform-client` schema and HTTP client domains.

Done when:

- `schemas.ts` and `client.ts` are reduced to compatibility export/factory surfaces.
- Domain schema/client modules own availability/catalog, reservation/read, and workflow concerns.
- Public imports continue to work.

Gate: `pnpm build`

### R2 - Workspace, Eval, And Test Split

Owner boundary: workspace-core file/path/proposal modules, eval helpers, and PMS client test domains.

Done when:

- `workspace-core/src/index.ts`, `eval-cases.ts`, and PMS client tests are below owner-bound/readability thresholds.
- Shared test scaffolding lives in helper modules.
- Eval cases still export from `packages/evals/src/eval-cases.ts`.

Gate: `pnpm test`

### R3 - AI Readability Debt Closure

Owner boundary: degraded fallback, response synthesis policy, session evidence, tool registration fallback helpers, and typed test factories.

Done when:

- Static debt items for deterministic fallback and regex-heavy synthesis are bounded by clearer owner modules/policy notes.
- Unused single-tool synthesis exports are deleted if confirmed unused.
- Duplicated `notConfiguredExecutor` is centralized.
- Noisy `as never` test stubs are replaced with typed helpers where practical.

Gate: cast/debt scans plus `pnpm build`

### R4 - Plan Metadata And Closeout

Owner boundary: `docs/plan` and `docs/debt`.

Done when:

- `docs/plan/README.md` records current gate metadata.
- Active triplet is archived under `docs/plan-archive/<plan-id>/`.
- Debt register marks completed repo-local items and residual external-repo items clearly.

Gate: `git diff --check`

### R5 - Final Review

Owner boundary: whole repo verification.

Done when:

- `pnpm build`
- `pnpm test`
- final cast scan
- final line-count scan
- review notes captured in closeout and final response
