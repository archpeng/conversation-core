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
