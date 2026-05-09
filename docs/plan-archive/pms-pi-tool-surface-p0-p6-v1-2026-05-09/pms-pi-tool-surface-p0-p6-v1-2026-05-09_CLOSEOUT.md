# PMS Pi Tool Surface P0-P6 Closeout

Pack ID: `pms-pi-tool-surface-p0-p6-v1-2026-05-09`
Closed: 2026-05-09

## Summary

Implemented the PMS Pi tool surface so customer PMS turns use generated, fine-grained Pi tools instead of a single JSON plan or coarse `gated_pms_read` route. The runtime now supports Pi-native multi-tool sequencing, safe PMS reads, safe booking workflow preparation, and approval-card-only final confirmation.

## Deliverables

### P0-P1 - evidence and typed PMS client coverage

- Regression coverage requires availability plus inventory summary for the 12-versus-13 room discrepancy case.
- PMS platform client and runtime executors use typed evidence routes for availability, inventory summary, room context, reservation lookup, arrivals, departures, room lookup, and pending-action status.

### P2-P3 - generated safe-read tools and gateway routing

- Customer PMS tool registration exposes `pms_availability_search`, `pms_inventory_summary`, `pms_room_reservation_context`, `pms_reservation_lookup`, `pms_get_room`, `pms_today_arrivals`, `pms_today_departures`, and `pms_pending_action_status`.
- Tool descriptions clarify operational semantics, including that availability returns full-stay bookable candidates, not total hotel inventory.
- Safety Gateway audits generated tools under their concrete capability IDs.
- Coarse `pms_read` and `pms_workflow` compatibility capability registrations were removed.

### P4 - Pi-native multi-tool iteration

- Normal user turns now reach Pi with visible custom tools directly.
- Live runtime consumes Pi tool execution events and evidence refs.
- Old JSON-shaped assistant output is treated as natural text, not executed as a plan.

### P5 - safe workflow composition

- Exposed safe workflow tools for draft create/update, quote, prepare-confirm, and group variants.
- `prepare_confirm` returns pending-action/approval-card evidence only.
- Final `pms_confirm` remains gateway/card-only and is not a visible LLM tool.

### P6 - scaffolding shrink

- Removed `packages/unified-agent/src/tool-plan.ts`.
- Removed live customer dependencies on `gated_pms_read`, `gated_pms_workflow`, `gated_pms_confirm`, `bounded_read_then_workflow`, and JSON plan execution.
- Updated architecture and dialogue docs to describe the Pi-native tool path.

## Gate

- `pnpm build`: passed
- `pnpm test`: 22 files, 172 tests passed
- boundary guard: passed
- eval: ok=true, 20/20, auditEvents=21

## Residuals

- `pms_confirm` remains registered in Safety Gateway only as the final approval/card boundary. It is intentionally not exposed as a Pi custom tool.
- The local PMS planner projection adapter can later be replaced by the upstream `pms-platform` capability manifest without changing the generated tool contract.
