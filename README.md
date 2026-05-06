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

## Plan control plane

Active execution truth lives in this repo:

```text
docs/plan/
docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md
```

The plan was migrated from `conversation-core` so future execution, review, and closeout should start from `/home/peng/dt-git/github/pms-agent-v2`. This repo's `origin` remote currently points to the former current directory Git remote: `https://github.com/archpeng/conversation-core.git`.

## P0 scope

This bootstrap contains only the monorepo skeleton, minimal TypeScript/Vitest tooling, root architecture docs, and boundary guardrails. Contracts, Safety Gateway logic, Agent runtime, PMS client behavior, and adapter changes are later slices.
