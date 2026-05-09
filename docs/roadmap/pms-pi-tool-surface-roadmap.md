# Roadmap: PMS Pi Tool Surface Capability Release

Status: proposed execution roadmap
Date: 2026-05-09
Target repo: `pms-agent-v2`
Upstream repo: `pms-platform`
Scope: PMS capability-derived Pi tools, safe workflow tools, and multi-step tool use

## 0. Purpose

Release the Pi runtime capability already present in `pms-agent-v2` by replacing the current coarse, hand-written PMS tool surface with capability-derived, typed, evidence-returning PMS tools.

The target behavior is not "LLM can call every PMS HTTP endpoint." The target is:

```text
pms-platform capability manifest / planner projection
  -> pms-agent-v2 capability adapter
  -> Safety Gateway visible PMS Pi tools
  -> typed pms-platform-client executor
  -> bounded evidence digest for Pi
  -> final response with evidence refs
```

The core product proof is the availability discrepancy case:

```text
User: next week, are any rooms booked?
Agent: calls pms_availability_search for the full stay range
Tool: returns 12 full-stay available candidates
Agent: sees the user expects 13 total rooms or needs booked-room detail
Agent: calls pms_inventory_summary for the same date range
Agent: explains that availability candidates mean rooms available for every night, while inventory summary shows total rooms and reserved/blocked/occupied counts by date
```

## 1. Current Baseline

Current `pms-agent-v2` is Pi-backed, but the PMS capability surface is constrained.

| Area | Current state | Limitation |
| --- | --- | --- |
| Pi registration | `createUnifiedAgentSession()` passes PMS tools as `customTools` | tools are hand-written wrappers, not generated from `pms-platform` capability projection |
| Visible PMS tools | `gated_pms_read`, `gated_pms_workflow`, `gated_pms_confirm` | only 3 coarse tools for all PMS behavior |
| Read targets | `availability`, `capabilities` | no inventory summary, room reservation context, reservation lookup, arrivals/departures, dashboard |
| Workflow targets | `prepare_confirm` path | draft/quote/prepare are hidden behind one bounded flow; no composable workflow tools |
| Planner path | LLM must output one `ToolPlanAction` JSON | prevents Pi-native multi-tool iteration after observing a tool result |
| Evidence synthesis | LLM sees `evidence.summary` only | too little information to explain availability/count discrepancies |

Current key files:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/tool-plan.ts`
- `apps/agent-service/src/executors.ts`
- `packages/pms-platform-client/src/client.ts`

Current upstream capability truth already exists in `pms-platform`:

- `pms_availability_search`
- `pms_inventory_summary`
- `pms_room_reservation_context`
- `pms_reservation_get`
- `pms_get_room`
- `pms_today_arrivals`
- `pms_today_departures`
- reservation draft / group draft / quote / prepare-confirm workflow capabilities
- pending-action status as an internal endpoint today

## 2. Non-Goals

Do not use this roadmap to add:

```text
raw pms-platform endpoint exposure to the LLM
confirm/cancel pending-action as natural-language tools
generic HTTP broker tools
generic plugin framework
second agent runtime
deterministic regex routing expansion
workspace or memory as PMS fact source
production PMS mutation without typed approval
```

The result should stay PMS-specific and Safety Gateway governed.

## 3. Target Tool Surface

### 3.1 Safe read tools

These tools should be visible to the customer PMS profile once they are backed by typed `pms-platform-client` methods and Safety Gateway policy.

| Tool name | Source capability | Semantics to put in description | Required context |
| --- | --- | --- | --- |
| `pms_availability_search` | `pms_availability_search` | Returns rooms available for every requested stay night. This is not total hotel inventory. | tenant, hotel/property, start/check-in date, optional end/check-out date |
| `pms_inventory_summary` | `pms_inventory_summary` | Returns daily aggregate inventory totals: total, available, reserved, blocked, occupied, by date/type where supported. Use to explain why availability count differs from total rooms. | tenant, property, date range/horizon |
| `pms_room_reservation_context` | `pms_room_reservation_context` | Explains reservation/block/occupancy context for one room. Use after inventory/availability identifies a missing or unavailable room. | tenant, roomId, requestedAt/date context |
| `pms_reservation_lookup` | `pms_reservation_get` | Looks up one reservation by reservation code. Use for status/detail questions about a known booking. | tenant, reservationCode |
| `pms_get_room` | `pms_get_room` | Reads one room's current room facts. Use when user asks about a specific room. | tenant, roomId |
| `pms_today_arrivals` | `pms_today_arrivals` | Lists/checks arrivals for a business date. | tenant, businessDate |
| `pms_today_departures` | `pms_today_departures` | Lists/checks departures for a business date. | tenant, businessDate |

`pms_inventory_intervals` can stay hidden in the first slice unless the evals prove summary is insufficient.

### 3.2 Safe workflow tools

Expose workflow tools only where side effects are draft-only, quote-only, prepare-only, or status-only.

| Tool name | Source capability | Visible to LLM | Boundary |
| --- | --- | --- | --- |
| `pms_reservation_draft_create` | `pms.reservation.draft.create` | yes | creates/updates draft evidence only; no final booking |
| `pms_reservation_draft_update` | `pms.reservation.draft.update` | yes | draft-only; must carry evidence refs |
| `pms_reservation_quote` | `pms.reservation.quote` | yes | quote facts only |
| `pms_reservation_prepare_confirm` | `pms.reservation.prepare_confirm` | yes | returns pending-action/approval-card refs; no final mutation |
| `pms_reservation_group_draft_create` | group draft create | yes | draft-only |
| `pms_reservation_group_draft_update` | group draft update | yes | draft-only |
| `pms_reservation_group_quote` | group quote | yes | quote facts only |
| `pms_reservation_group_prepare_confirm` | group prepare-confirm | yes | returns pending-action/approval-card refs; no final mutation |
| `pms_pending_action_status` | pending-action status | constrained yes | status readback only; confirm/cancel remain adapter-card-only |

Pending-action status needs an explicit design decision because `pms-platform` currently marks it internal. Either:

1. reclassify status as a constrained read capability in `pms-platform`, while keeping confirm/cancel internal; or
2. keep it as an agent-owned special safe read tool visible only for pending refs created in the current session/card flow.

Confirm and cancel must remain unavailable as LLM tools.

## 4. Tool Description Contract

Every generated tool must have a human-semantic description, not just an endpoint name.

Minimum description fields:

```text
what it answers
what it does not answer
when to combine it with another PMS tool
important date semantics
important mutation/safety semantics
evidence ref behavior
truncation/summarization limits
```

Examples:

```text
pms_availability_search:
Search full-stay available room candidates for the requested date range. A returned room is available for every requested night. Use pms_inventory_summary when the user asks about total room count, booked rooms, blocked rooms, or why the result count differs from hotel inventory.

pms_inventory_summary:
Read daily inventory totals for a date range, including total rooms and status counts where supported. Use this to explain availability discrepancies and booked/blocked/occupied counts. This does not pick a bookable room candidate; combine with pms_availability_search for booking preparation.

pms_room_reservation_context:
Read why a specific room is unavailable or associated with reservation/block context. Use after inventory summary or availability search points to a specific room.
```

## 5. Evidence Digest Contract

The LLM-visible tool result must be high-signal enough for reasoning but bounded enough for safety.

| Tool family | LLM-visible content must include | Runtime-only details may include |
| --- | --- | --- |
| availability | evidenceRef, date range, returned candidate count, semantics, candidate summary, truncation flag | complete read model |
| inventory summary | evidenceRef, date rows, total/available/reserved/blocked/occupied counts, notable shortages | complete inventory read model |
| room context | evidenceRef, roomId, relevant reservation/block context, source labels if safe | complete room context model |
| reservation lookup | evidenceRef, reservation code/status/dates/room summary | complete reservation model |
| draft/quote/prepare | evidenceRef, draft/quote/pending refs, approval requirement, mutationStatus | complete workflow read model |

Do not reduce all PMS evidence to one sentence. The previous behavior of only exposing `Availability search returned 12 rooms.` is insufficient for Pi reasoning.

## 6. Execution Phases

### P0. Regression evidence and eval guard

Owner boundary: `packages/evals` and existing unified-agent tests.

Work:

- Add an eval/test for the 13-total/12-available discrepancy.
- Assert that the correct answer distinguishes full-stay availability candidates from total inventory.
- Assert evidence refs are preserved.
- Keep the current system failing or incomplete until the tool surface is implemented.

Done when:

- a focused regression proves why single availability summary is insufficient;
- no production behavior changes yet.

### P1. Expand typed `pms-platform-client` coverage

Owner boundary: `packages/pms-platform-client`.

Work:

- Add typed methods and validation for:
  - `inventorySummary`
  - `roomReservationContext`
  - reservation lookup naming alignment if needed
  - optional `todayArrivals` / `todayDepartures`
- Preserve evidence wrapping for every PMS fact.
- Add richer summary builders, but do not rely on summary alone for final reasoning.
- Update `docs/pms-platform-endpoint-map.md`.

Done when:

- each new client method validates inputs and response shape;
- each method returns `PmsEvidence<T>`;
- tests cover success and invalid input;
- no raw PMS fact path bypasses evidence.

### P2. Build capability-derived PMS tool descriptors

Owner boundary: `packages/unified-agent` tool registration.

Work:

- Add a `pms-capability-tools` owner module.
- Convert `PmsCapabilityPlannerProjectionItem` into `GatedToolDefinition`.
- Filter by:
  - `customerChatAllowed`
  - `naturalLanguageExecutable`
  - `!confirmationRequired`
  - class not `confirm`
  - class not `internal`, except the explicit pending-action-status decision
- Apply curated semantic description overrides for PMS operations.
- Keep existing raw-tool denylist.

Done when:

- customer PMS visible tools are derived from capability names, not hard-coded `gated_pms_read` targets;
- generated tool schemas reject extra fields;
- the manifest can change upstream without requiring a new coarse target switch.

### P3. Route generated tools through Safety Gateway and typed executors

Owner boundary: `packages/gated-tools`, `apps/agent-service/src/executors.ts`.

Work:

- Evolve `GatedToolRequest` from coarse `target` routing toward `operation` / `capabilityName`.
- Map safe read operations to typed `pms-platform-client` methods.
- Map workflow operations to draft/quote/prepare methods.
- Ensure `confirm` and `cancel` are never visible and never routed from natural language.
- Keep `pms_pending_action_status` read-only and constrained.

Done when:

- Safety Gateway sees the actual capability/tool name;
- executor routing has no string fallthrough that turns unknown operations into capabilities;
- policy denial returns a bounded tool result;
- tests prove confirm/cancel are not in the visible manifest.

### P4. Replace JSON-only planning with Pi-native multi-tool iteration

Owner boundary: `packages/unified-agent/src/session.ts` plus small extracted owner modules if needed.

Work:

- Stop requiring normal actionable turns to return `ToolPlanAction` JSON.
- Let Pi call active `customTools` directly and observe tool results.
- Preserve deterministic fallback only for genuine LLM unavailable cases.
- Keep response synthesis/validation as the final evidence and policy guard.
- Add event tracking for tool call sequence, evidence refs, and final result.
- Keep a temporary compatibility path only behind tests or explicit stub mode, then delete it in P6.

Done when:

- one user turn can perform availability search, then inventory summary, then final answer;
- final answer cites current evidence refs;
- no regex fallback decides live PMS behavior while LLM is available;
- `pnpm build && pnpm test` pass.

### P5. Add PMS workflow composition tools

Owner boundary: workflow tool registration and executor routing.

Work:

- Expose draft create/update, quote, and prepare-confirm as separate safe workflow tools.
- Keep group workflow tools separate where schemas differ.
- Use evidence refs between tools instead of hidden deterministic selection where possible.
- For booking prep, allow Pi to:
  - search availability;
  - inspect inventory/room context if ambiguous;
  - create/update draft;
  - quote draft;
  - prepare confirm;
  - return approval card.

Done when:

- booking prep remains no-final-mutation;
- approval card creation still requires pending-action evidence;
- current single-room and group booking tests pass with the new tool names;
- obsolete `bounded_read_then_workflow` path is no longer required.

### P6. Shrink old scaffolding

Owner boundary: `packages/unified-agent`.

Work:

- Remove or quarantine `ToolPlanAction` JSON-only runtime scaffolding after Pi-native path is proven.
- Remove coarse `gated_pms_read(target=...)` routing once generated tools cover all safe reads.
- Keep only test stub support if needed.
- Update architecture docs and endpoint map.

Done when:

- no live customer PMS turn depends on coarse target routing;
- tests/evals cover the replacement;
- source files remain below the project complexity ceiling or have owner-bound extraction.

## 7. Required Tests And Evals

Minimum regression set:

| Case | Expected behavior |
| --- | --- |
| greeting | no PMS tool call required |
| availability for date range | calls `pms_availability_search`; explains full-stay candidates |
| availability count differs from total rooms | calls `pms_inventory_summary`; explains discrepancy |
| specific unavailable room | calls `pms_room_reservation_context` after identifying room |
| known reservation code | calls `pms_reservation_lookup` |
| single-room booking prep | search -> draft -> quote -> prepare-confirm -> approval card |
| group booking prep | search -> group draft/update -> group quote -> group prepare-confirm -> approval card |
| pending action status | status read only; no confirm/cancel mutation |
| confirm/cancel natural-language request | refusal or approval-card boundary; no raw confirm/cancel tool |
| pms-platform unavailable | bounded degraded response; no fabricated PMS facts |

Every PMS fact assertion must be evidence-backed.

## 8. Migration Strategy

Use a phased compatibility bridge, but do not keep parallel paths indefinitely.

1. Add client coverage and generated descriptors behind tests.
2. Register generated tools alongside current coarse tools in a controlled test profile.
3. Switch customer PMS profile to generated safe tools.
4. Keep old `gated_pms_read` only as a compatibility alias for one phase.
5. Remove old alias once evals pass and no tests depend on coarse targets.

No phase should expose raw HTTP or bypass Safety Gateway.

## 9. Verification Gates

Each implementation pack must pass:

```bash
pnpm build
pnpm test
```

Additional proof expected for this roadmap:

```text
visible tool manifest snapshot excludes confirm/cancel
generated tool schemas reject unsupported params
13-total/12-availability discrepancy eval passes
multi-tool sequence telemetry captures at least two PMS tools in one turn
final answer evidence refs match tool evidence refs
```

## 10. Plan Pack Conversion

This roadmap is not an active implementation pack. When execution starts, create a `docs/plan/` triplet with one active owner slice at a time:

```text
pms-pi-tool-surface-p0-p2-v1-2026-05-09_PLAN.md
pms-pi-tool-surface-p0-p2-v1-2026-05-09_STATUS.md
pms-pi-tool-surface-p0-p2-v1-2026-05-09_WORKSET.md
```

Suggested first pack:

```text
P0: regression/eval guard
P1: pms-platform-client coverage
P2: generated safe read descriptors
```

Suggested second pack:

```text
P3: Safety Gateway routing by capability
P4: Pi-native multi-tool iteration
```

Suggested third pack:

```text
P5: workflow composition tools
P6: scaffolding shrink
```

## 11. External Practice References

Pi practice verified against official docs:

- `createAgentSession({ customTools })` and `defineTool()`: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#custom-tools
- `pi.registerTool()`: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#piregistertooldefinition
- active tool control with `pi.setActiveTools()`: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#pigetactivetools--pigetalltools--pisetactivetoolsnames
- tool event interception with `tool_call` and `tool_result`: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#tool-events

OpenClaw practice observed locally:

- Pi tools are passed as `customTools` with an allowlist.
- Plugin tools are descriptor-first and availability/allowlist filtered.
- Cached descriptors avoid prompt-time runtime loading while execution still loads live tools.
- Before/after tool-call hooks guard execution.

The PMS implementation should copy the pattern, not the full OpenClaw plugin platform.
