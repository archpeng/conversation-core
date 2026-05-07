# PMS Agent AI-Native Hardening H1-H4 Closeout

Plan ID: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`
Closeout state: `PACK_COMPLETE`
Closed on: 2026-05-07

## Verdict

The H1-H4 AI-native hardening pack is closed. H1, H2, H3, and H4 were implemented, reviewed, accepted, and reflected in parser truth before closeout.

This closeout is a local code-quality hardening claim. It is not a production Feishu/PMS live stability claim and does not expand MVP scope into generic logging, linting, workflow, or agent frameworks.

## Completed scope

### H1 — import-boundary-guard

Accepted artifacts:

- `scripts/boundary-guard.mjs`
- `tests/boundary-guard.test.ts`

Accepted result:

- Existing legacy scans remain active for forbidden legacy runtime modules, old `replies[]` output contract, and v1/v2 compatibility module paths.
- The boundary guard now uses a small rule table for forbidden package directions.
- Static import extraction covers static imports/exports, CommonJS `require(...)`, and dynamic `import(...)` specifiers.
- Focused tests prove denied directions including `pms-platform-client -> unified-agent`, `safety-gateway -> pms-platform-client`, `safety-gateway -> gated-tools`, `adapter-contracts -> agent-service`, and `workspace-core -> safety-gateway`.
- A documented allowed direction, `unified-agent -> pms-platform-client`, remains green.

### H2 — http-body-size-limit

Accepted artifacts:

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts`
- `README.md`

Accepted result:

- Runtime config includes `maxInboundBodyBytes` loaded from `PMS_AGENT_MAX_BODY_BYTES` with default `262144` bytes.
- HTTP request body accumulation rejects oversized bodies before `service.handle(...)` runs.
- Oversized bodies return status `413` with safe refusal `{ type: "refusal", reason: "invalid_request", message: "Request body too large." }`.
- Normal `/health` and valid `/v1/feishu-turn` behavior remains green under the configured limit.
- Runtime docs document the body limit env var.

### H3 — pms-tool-public-content-minimization

Accepted artifacts:

- `packages/unified-agent/src/tool-registration.ts`
- `tests/unified-agent.test.ts`

Accepted result:

- PMS evidence allow tool public content exposes only `outcome`, `auditId`, `evidenceRef`, `source`, and `summary`.
- Full `GatedToolResult` and complete `PmsEvidence` remain available through `toolResult.details.value` for runtime orchestration.
- Tests prove raw room IDs and secret-looking PMS payload values are absent from model-visible tool `content` while the original evidence object remains available in `details.value`.
- Runtime synthesis continues to read PMS evidence from `details.value`, not minimized public content.

### H4 — runtime-event-logging-default

Accepted artifacts:

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts`
- `tests/unified-agent.test.ts`
- `README.md`

Accepted result:

- Runtime turn-event stdout logging is explicit opt-in: only `PMS_AGENT_LOG_TURN_EVENTS=true` enables the runtime `eventSink`; unset and `false` disable it.
- Runtime config tests lock default/unset, explicit `false`, and explicit `true` behavior.
- README documents `PMS_AGENT_LOG_TURN_EVENTS` and redaction constraints.
- Event tests prove redacted planner/tool/result events omit user text, raw PMS payloads, evidence refs, and pending-action IDs, including approval-card result events.
- No logging framework dependency or external observability infrastructure was introduced.

## Final evidence

Closeout validation commands:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
node packages/evals/dist/index.js
git diff --check
plan_sync docs/plan
```

Observed closeout result:

```text
pnpm build: passed
pnpm test: passed; 20 test files / 166 tests; boundary guard passed; pnpm eval passed ok=true passed=19 total=19 auditEvents=17
pnpm guard:boundaries: passed
node packages/evals/dist/index.js: passed; ok=true passed=19 total=19 auditEvents=17
git diff --check: passed
pre-archive plan_sync docs/plan: STATUS/WORKSET done=4 pending=1 with PACK_COMPLETE ready
```

## Safety and architecture boundary evidence

- No legacy `ai-conversation`, `ai-pms`, `pi-agent-core`, old `replies[]`, or v1/v2 compatibility hot path was introduced.
- Agent-visible tools remain gated tool surfaces only.
- Safety Gateway remains the execution boundary before side effects.
- PMS facts remain grounded in current `pms-platform` evidence.
- No `AgentResult` or PMS evidence schema change was required.
- No new generic lint, logging, serialization, workflow, or agent framework was added.

## Residual handoff

No same-pack H1-H4 implementation or review residual remains open.

Successor residuals only:

1. Roadmap H5 (`session.ts` owner-block extraction) remains opportunistic and should run only when a future concrete owner slice touches that block.
2. Production Feishu/GPT/PMS live runtime stability, latency/SLO hardening, and production observability remain outside this local hardening pack.
3. The repository remote still points at the former `conversation-core` URL; changing it is outside this pack.

## Plan hygiene result

Hot parser surface after closeout:

```text
docs/plan/README.md
```

Cold archive surface:

```text
docs/plan-archive/pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07/
```

Archived parser files:

- `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_PLAN.md`
- `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_STATUS.md`
- `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_WORKSET.md`
- `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07_CLOSEOUT.md`

## Re-promotion condition

Do not resume this pack as active work. Any successor effort must create a new active plan pack that cites this archive as historical evidence and explicitly names scope, validation, ownership, and residual handling.
