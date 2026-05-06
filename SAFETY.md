# Safety

Safety Gateway is mandatory and central. It decides allow, deny, approval-required, or rewrite before any executor/tool call.

## Forbidden shortcuts

```text
Agent -> read/write/edit/bash/http/PMS executor directly
Agent -> PMS confirm from natural language
Agent -> external HTTP side effect without proposal or approval
```

## High-risk actions

Reservation confirm, cancel order, price change, room-state change, skill publishing, production config change, generated-code execution, and external HTTP side effects are proposal or approval first.

## Evidence and audit

PMS user-visible facts must cite current `pms-platform` evidence. Every allowed, denied, or approval-required tool decision must be auditable. Eval coverage starts early and remains part of the acceptance gate.

## Sandbox validation boundary

Sandbox bash is a validation-only capability. Safety Gateway allows only exact deterministic validation commands in a sandbox workspace: `pnpm test`, `pnpm build`, and `tsc --noEmit`. Network, secret-inspection, destructive, container, cluster, and interactive shell commands are denied before any executor runs.

Sandbox executors must run with a bounded timeout and no ambient network or secret exposure. Sandbox reads must stay under `/workspaces/{runId}/sandbox/**`; writes and edits stay proposal-only under `/workspaces/{runId}/proposal/**` for MVP review artifacts.
