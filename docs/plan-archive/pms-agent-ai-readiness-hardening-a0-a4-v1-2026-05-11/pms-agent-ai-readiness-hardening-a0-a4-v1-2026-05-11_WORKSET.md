# PMS Agent AI-Readiness Hardening A0-A4 Workset

## Owner Boundaries

- Runtime audit: `safety-gateway` audit log and `agent-service` runtime gateway/config wiring.
- PMS evidence: `agent-service` PMS read executors and `pms-platform-client` availability result contract.
- Guard rails: root scripts, AI-readiness guard script, and seeded guard tests.
- Workspace tools: audit, active-skills, skill-proposal, and error owner modules.
- Docs: architecture, debt register, and plan archive.

## Changed Surfaces

- Runtime Safety audit now writes full JSONL events to a configured file path.
- Catalog-backed room-type miss returns `searchAvailability` evidence with catalog evidence listed in `sourceRefs`.
- `pnpm test` runs `guard:ai-readiness`.
- `workspace-tools/src/index.ts` is a thin compatibility/export surface below the 350-line source budget.
