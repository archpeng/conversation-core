# PMS Pi Tool Surface P0-P6 Status

Plan ID: `pms-pi-tool-surface-p0-p6-v1-2026-05-09`
Status file state: `PACK_COMPLETE`
Last updated: 2026-05-09

## Current State

- state: `PACK_COMPLETE`
- owner: `execute-plan`
- route: `PLAN -> EXEC -> REVIEW -> WRITEBACK -> NEXT_STAGE -> CLOSEOUT`
- workstream: `pms-pi-tool-surface-p0-p6-v1-2026-05-09`
- mode: `single-root-autopilot-compatible`
- design law: `capability-derived PMS Pi tools with Safety Gateway and pms-platform evidence`
- active_step: `none`
- latest_completed_step: `PACK_COMPLETE`

## Planned Stages

- [x] `P0` progress-audit-and-regression-pressure
- [x] `P1` typed-client-coverage-acceptance
- [x] `P2` capability-derived-safe-read-tools
- [x] `P3` per-capability-gateway-routing
- [x] `P4` pi-native-multi-tool-iteration
- [x] `P5` safe-workflow-composition-tools
- [x] `P6` scaffolding-shrink-and-closeout
- [x] `PACK_COMPLETE` closeout-and-archive

## Current Progress Audit

### `P0` - regression/eval guard

- Existing evidence:
  - `packages/evals/src/eval-cases.ts` contains `availabilityDiscrepancy`.
  - The eval now parses and executes `pms_availability_search` plus `pms_inventory_summary`.
  - The final synthesized answer must cite both PMS evidence refs and explain 12 full-stay candidates versus 13 total rooms.
  - The eval audits `pms_availability_search` and `pms_inventory_summary` separately.
- Gap: none for P0. P4 is still needed for live Pi-native multi-tool iteration in a normal turn.
- Status: `completed`.

### `P1` - typed PMS client coverage

- Existing evidence:
  - `packages/pms-platform-client/src/client.ts` exposes `inventorySummary`, `roomReservationContext`, `todayArrivals`, `todayDepartures`, and `reservationLookup`.
  - `packages/pms-platform-client/src/inventory-client.ts` wraps new endpoints in `PmsEvidence`.
  - `tests/pms-platform-client.test.ts` covers success and invalid input cases.
  - `docs/pms-platform-endpoint-map.md` lists the routes.
  - `apps/agent-service/src/executors.ts` now calls typed client methods directly for inventory summary, room reservation context, reservation lookup, arrivals, and departures.
- Gap: none for P1.
- Status: `completed`.

### `P2` - capability-derived descriptors

- Existing evidence:
  - `packages/unified-agent/src/pms-capability-tools.ts` defines a local `PmsCapabilityPlannerProjectionItem` adapter and generates visible safe-read tools from projection data.
  - The generated surface includes `pms_availability_search`, `pms_inventory_summary`, `pms_room_reservation_context`, `pms_reservation_lookup`, `pms_get_room`, `pms_today_arrivals`, `pms_today_departures`, and constrained `pms_pending_action_status`.
  - Tool descriptions preserve curated semantics, including that availability returns full-stay candidates rather than total inventory.
  - Generated schemas reject unsupported params.
  - `customer_pms` enables `useGeneratedTools`.
- Gap: upstream `pms-platform` manifest projection can replace the local adapter projection later without changing the tool contract.
- Status: `completed`.

### `P3` - per-capability gateway routing

- Existing evidence:
  - `packages/safety-gateway/src/capability-registry.ts` includes fine-grained PMS read IDs.
  - `packages/gated-tools/src/pms-tools.ts` has `gatedPmsSafeRead`.
  - `apps/agent-service/src/executors.ts` has `pmsReadExecutors`.
  - Generated safe-read tools now call `gatedPmsSafeRead` with their own capability IDs.
  - Generated safe-read tools route to `pmsReadExecutors.<toolName>`.
  - Request fields are forwarded explicitly for availability, inventory summary, room context, reservation lookup, arrivals/departures, room lookup, and pending-action status.
  - Tests assert `decide:pms_availability_search` and `decide:pms_inventory_summary`.
- Gap: none. The coarse customer PMS alias was removed in P6.
- Status: `completed`.

### `P4` - Pi-native multi-tool iteration

- Existing evidence:
  - `pi-io.ts` collects Pi `tool_execution_end` events through `promptAssistantTurn`.
  - `session.ts` handles Pi-native tool results through `runPiNativeToolResults`.
  - `session-turn-prompt.ts` exposes visible Pi custom tools directly and no longer asks for JSON plans.
  - Tests and evals prove multi-tool PMS evidence collection, including availability plus inventory summary.
- Gap: none.
- Status: `completed`.

### `P5` - workflow composition tools

- Existing evidence:
  - `pms-workflow-tools.ts` exposes draft create/update, quote, prepare-confirm, and group variants as separate Pi tools.
  - `apps/agent-service/src/executors.ts` routes each workflow capability to its typed `pms-platform-client` method.
  - Safety Gateway has per-step PMS workflow capability IDs.
  - Confirm/cancel are not visible to the LLM; prepare-confirm returns approval-card evidence only.
- Gap: none.
- Status: `completed`.

### `P6` - scaffolding shrink

- Existing evidence:
  - `packages/unified-agent/src/tool-plan.ts` was removed.
  - Live runtime no longer imports or executes JSON `ToolPlanAction` plans.
  - Customer tool registration no longer exposes coarse PMS aliases.
  - Safety Gateway no longer registers coarse `pms_read` or `pms_workflow` compatibility capability IDs.
  - Tests/evals were rewritten to Pi-native custom tool events and direct generated tool execution.
- Gap: none.
- Status: `completed`.

## Gate State

Latest observed validation:

```bash
pnpm build
pnpm test
```

Observed result:

- `pnpm build`: passed
- `pnpm test`: passed, 22 test files, 172 tests
- boundary guard: passed
- eval: ok=true, 20/20

Because the current worktree is dirty, every implementation slice must rerun gates before claiming completion.

## Worktree Notes

- Current repo has staged and unstaged source changes unrelated to this plan creation.
- Untracked `.claude/` worktrees are present and should be cleaned or ignored before closeout.
- `docs/roadmap/pms-pi-tool-surface-roadmap.md` is currently untracked but is the source roadmap for this pack.

## Decisions

1. Use one active P0-P6 plan pack because current code already spans P1-P3 partial implementation and the user requested a complete workset.
2. P0-P3 are now complete and verified by `pnpm build && pnpm test`.
3. P4-P6 are implemented: live Pi-native iteration uses generated tools instead of one JSON plan per turn.
4. Do not expose raw `pms-platform` routes. Tool generation must filter and semantically describe safe PMS capabilities.
5. Do not keep customer PMS compatibility aliases after P6.

## Closeout

Pack complete and ready for archive under `docs/plan-archive/pms-pi-tool-surface-p0-p6-v1-2026-05-09/`.
