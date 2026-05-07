# PMS Agent V2

`pms-agent-v2` is a clean AI-native PMS Agent MVP. `pi-coding-agent` is the first-class Agent core. Safety Gateway is the only execution boundary.

The target path is:

```text
adapter-feishu -> pms-agent-v2/apps/agent-service -> pms-platform
```

## Non-negotiable laws

1. No legacy `ai-conversation` runtime compatibility belongs in this repo.
2. No old `replies[]` response surface belongs in this repo.
3. No `ai-pms` fallback, no `pi-agent-core` hot path, and no V1/V2 dual route belongs in this repo.
4. The Agent sees gated tools only; every executor/tool call must pass Safety Gateway before side effects.
5. PMS facts must come from current `pms-platform` evidence, not Agent memory or prompt text.
6. Natural-language PMS mutation is forbidden; high-risk actions are proposal or approval first.
7. Audit and eval proof start with the MVP and gate changes before closeout.
8. Architecture and AI-readability constraints in `docs/ARCHITECTURE_CONSTRAINTS.md` must stay true as the Agent becomes stronger.
9. MVP changes must stay minimal: wire existing typed `pms-platform` capabilities and shrink deterministic scaffolding before adding frameworks, generic platforms, supervisors, rollout machinery, or broad workspace/memory abstractions.

## Plan control plane

Current hot parser truth lives in this repo:

```text
docs/plan/README.md
docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md
```

The MVP plan pack is closed at `PACK_COMPLETE` and archived under:

```text
docs/plan-archive/pms-agent-v2-ai-native-mvp-v1-2026-05-06/
```

Future execution, review, and closeout should start from `/home/peng/dt-git/github/pms-agent-v2` with a new active plan pack. This repo's `origin` remote currently points to the former current directory Git remote: `https://github.com/archpeng/conversation-core.git`.

## MVP closeout scope

This closed MVP includes the monorepo scaffold, adapter contracts, Safety Gateway, gated tools, PMS evidence client, unified Agent runtime, service API, customer/admin loops, sandbox hardening, audit/eval proof, and local integration smoke.

## Runtime start

Build first, then start the agent service:

```bash
pnpm build
PMS_AGENT_SERVICE_HOST=127.0.0.1 \
PMS_AGENT_SERVICE_PORT=8792 \
PMS_AGENT_AUTH_TOKEN=agent-token \
PMS_PLATFORM_BASE_URL=http://127.0.0.1:8791 \
PMS_PLATFORM_AUTH_TOKEN=local-pms-token \
PMS_AGENT_PROPOSAL_WORKSPACE=.local/pms-agent-proposals \
PMS_AGENT_PI_MODE=real \
PMS_AGENT_PI_MODEL_PROVIDER=openai \
PMS_AGENT_PI_MODEL_ID=gpt-5.5 \
pnpm start
```

Runtime env:

| Env | Purpose |
| --- | --- |
| `PMS_AGENT_SERVICE_HOST` / `PMS_AGENT_SERVICE_PORT` | HTTP bind host/port for `/health`, `/v1/feishu-turn`, and `/v1/eval-turn`. |
| `PMS_AGENT_MAX_BODY_BYTES` | Maximum inbound HTTP request body size before service handling; defaults to `262144` bytes. |
| `PMS_AGENT_AUTH_TOKEN` | Optional inbound token required in `X-PMS-AGENT-TOKEN`; set this when adapter-feishu calls the service. |
| `PMS_PLATFORM_BASE_URL` / `PMS_PLATFORM_AUTH_TOKEN` | PMS Platform HTTP base URL and bearer token for evidence reads. |
| `PMS_AGENT_PROPOSAL_WORKSPACE` | Workspace root for admin proposal artifacts. |
| `PMS_AGENT_PI_MODE` | `real` uses `pi-coding-agent` SDK; `stub` is for deterministic local smoke only. |
| `PMS_AGENT_PI_SESSION_MODE` | `memory` or `persistent` SDK session manager. |
| `PMS_AGENT_PI_MODEL_PROVIDER` / `PMS_AGENT_PI_MODEL_ID` | Intended live override: `openai` / `gpt-5.5`. Real mode resolves this pair through Pi's `ModelRegistry` at startup and fails fast if the configured pair is not found. |
| `PMS_AGENT_LOG_TURN_EVENTS` | Redacted runtime turn-event stdout logging. Default/unset and `false` disable logging; set exactly `true` to emit redacted planner/tool/result events. Events must not include user text, raw PMS payloads, evidence refs, or pending action IDs. |
| `PMS_AGENT_DEFAULT_CHECK_IN_DATE` / `PMS_AGENT_DEFAULT_CHECK_OUT_DATE` / `PMS_AGENT_DEFAULT_ROOM_TYPE` | Local MVP defaults used by the deterministic PMS availability executor. |
