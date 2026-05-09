# PMS Pi Tool Surface P0-P6 Plan

Plan ID: `pms-pi-tool-surface-p0-p6-v1-2026-05-09`
Status: `IN_PROGRESS`
Source: `docs/roadmap/pms-pi-tool-surface-roadmap.md` plus current code progress audit
Mode: `single-root-autopilot-compatible`

## Goal

Release the Pi runtime capability already present in `pms-agent-v2` by moving customer PMS turns from coarse JSON-planned PMS wrappers to capability-derived, typed, Safety Gateway-governed PMS Pi tools that return bounded `pms-platform` evidence.

The target product proof is:

```text
availability_search returns 12 full-stay candidates
-> inventory_summary explains total inventory and reserved/blocked/occupied counts
-> final response distinguishes available candidates from total hotel rooms
-> evidence refs are preserved
```

## Current Progress Snapshot

Baseline reviewed on 2026-05-09 against the current dirty worktree. P0-P6 implementation was completed and verified on 2026-05-09.

| Roadmap stage | Current code evidence | State |
| --- | --- | --- |
| `P0` regression/eval guard | `availability-discrepancy-12-candidates-not-total` now requires `pms_availability_search` plus `pms_inventory_summary`, both evidence refs, and separate audits. | `completed` |
| `P1` typed `pms-platform-client` coverage | `inventorySummary`, `roomReservationContext`, `todayArrivals`, `todayDepartures`, and `reservationLookup` are used through typed client methods without transitional method casts. | `completed` |
| `P2` capability-derived descriptors | `pms-capability-tools.ts` now converts local PMS planner projection items into generated safe-read descriptors with curated semantic descriptions and schema validation. | `completed` |
| `P3` Safety Gateway and executor routing | Generated tools now call `gatedPmsSafeRead`, audit under per-capability IDs, and dispatch to `pmsReadExecutors.<toolName>`. | `completed` |
| `P4` Pi-native multi-tool iteration | Normal turns collect Pi native tool events through `promptAssistantTurn`; runtime no longer parses JSON action plans. | `completed` |
| `P5` workflow composition tools | Draft create/update, quote, prepare-confirm, and group variants are visible safe workflow Pi tools. | `completed` |
| `P6` scaffolding shrink | Coarse customer PMS aliases, JSON plan parser, and bounded read/workflow orchestration were removed from live code. | `completed` |

Latest observed gate: `pnpm build` passed, `pnpm test` passed with 171 tests and eval 20/20.

## Scope

In scope:

1. `P0` - strengthen regression/eval pressure and capture the current progress baseline.
2. `P1` - accept and clean typed PMS client coverage needed by safe read tools.
3. `P2` - convert PMS capability projection items into visible safe-read Pi tools with semantic descriptions.
4. `P3` - route generated tools through actual per-capability Safety Gateway IDs and typed executors.
5. `P4` - replace normal-turn JSON-only planning with Pi-native multi-tool iteration.
6. `P5` - expose safe workflow composition tools for draft, update, quote, prepare-confirm, and pending-action status.
7. `P6` - remove or quarantine old coarse scaffolding after replacement proof.

Out of scope:

- Raw `pms-platform` endpoint exposure to the LLM.
- Natural-language confirm/cancel tools.
- Generic HTTP brokers, plugin platforms, multi-agent supervisors, or second runtimes.
- Workspace or memory as a PMS fact source.
- New regex routing for customer PMS behavior.
- Production PMS mutation without typed approval/card flow.

## Constraints

- Every PMS fact must come from current `pms-platform` evidence.
- Every execution path must pass Safety Gateway.
- Confirm/cancel remain adapter-card or gateway callback surfaces, not LLM-callable tools.
- Generated tools must be high-information and PMS-specific, not raw endpoint mirrors.
- Compatibility paths may exist for one bounded phase only and must have deletion criteria.
- Each stage must preserve `pnpm build && pnpm test`.
- If a stage spans more than its named owner boundary, split it or stop for replan.

## Verification

Default gate after every implementation slice:

```bash
pnpm build
pnpm test
```

Additional roadmap proof required before closeout:

```text
visible customer PMS manifest excludes raw confirm/cancel tools
generated safe-read schemas reject unsupported params
availability discrepancy eval requires inventory summary
one normal turn can call at least two PMS tools before final answer
final answer evidence refs match the PMS tool evidence refs
no live customer PMS turn depends on coarse target routing
```

## Stage Definitions

### `P0` - progress-audit-and-regression-pressure

- Owner boundary: `packages/evals` and existing unified-agent tests
- State: `READY`
- Priority: `highest`

Goal:

Turn the 13-total/12-availability discrepancy into a hard regression that requires the future tool surface, while preserving the current progress audit as the baseline for this pack.

Work:

1. Keep the current progress matrix in `STATUS.md` as the baseline.
2. Strengthen the discrepancy eval/test so success requires:
   - an availability read with full-stay candidate semantics;
   - an inventory summary read for total/reserved/blocked/occupied explanation;
   - evidence refs from both reads where both reads occur.
3. Keep the old single-availability behavior marked as incomplete, not accepted.
4. Add or update telemetry assertions only if they do not require the P4 runtime yet.

Touched files:

- `packages/evals/src/eval-cases.ts`
- `packages/evals/src/index.ts` if case registration changes
- `tests/tool-plan.test.ts` or unified-agent tests for generated read behavior
- `docs/plan/pms-pi-tool-surface-p0-p6-v1-2026-05-09_STATUS.md`

done_when:

1. A focused regression proves single availability evidence is insufficient for total-room questions.
2. The expected future behavior is explicit: `pms_availability_search` plus `pms_inventory_summary`.
3. `pnpm build && pnpm test` pass or the status file records the intentional failing gate and exact reason.

stop_boundary:

1. Stop if the eval requires P4 Pi-native runtime before P2/P3 routing is fixed.
2. Stop if test changes weaken PMS evidence or Safety Gateway assertions.

### `P1` - typed-client-coverage-acceptance

- Owner boundary: `packages/pms-platform-client`
- State: `queued`
- Priority: `high`

Goal:

Formally accept the typed PMS client methods needed by safe-read tools and remove transitional adapter debt that no longer reflects the client type surface.

Work:

1. Verify typed methods and schemas for:
   - `inventorySummary`
   - `roomReservationContext`
   - `reservationLookup`
   - `todayArrivals`
   - `todayDepartures`
2. Confirm every method returns `PmsEvidence<T>`.
3. Confirm endpoint map and tests match the client methods.
4. Remove executor-side transitional casts that call these methods via `Record<string, Function>` after the client type is accepted.

Touched files:

- `packages/pms-platform-client/src/client.ts`
- `packages/pms-platform-client/src/inventory-client.ts`
- `packages/pms-platform-client/src/inventory-schemas.ts`
- `docs/pms-platform-endpoint-map.md`
- `apps/agent-service/src/executors.ts` for obsolete cast cleanup
- `tests/pms-platform-client.test.ts`
- `tests/agent-service-runtime.test.ts`

done_when:

1. New safe-read client methods are typed, validated, evidence-wrapped, and tested.
2. Runtime executors call typed client methods directly.
3. No raw PMS fact path bypasses evidence.
4. `pnpm build && pnpm test` pass.

stop_boundary:

1. Stop if `pms-platform` route shape is not stable enough to type without guessing.
2. Stop if accepting client coverage requires exposing internal confirm/cancel routes.

### `P2` - capability-derived-safe-read-tools

- Owner boundary: `packages/unified-agent` tool registration
- State: `queued`
- Priority: `high`

Goal:

Replace hand-maintained coarse PMS read targets with generated PMS safe-read Pi tools derived from a PMS capability planner projection, with curated semantic descriptions where needed.

Work:

1. Define the local adapter type for PMS planner projection items if `pms-platform-client` does not yet expose it.
2. Convert projection items into `GatedToolDefinition`s.
3. Filter visible tools by:
   - customer chat allowed;
   - natural-language executable;
   - no confirmation requirement;
   - not confirm/cancel;
   - not internal except the explicit pending-action-status decision.
4. Keep semantic description overrides for availability, inventory summary, room context, reservation lookup, arrivals, and departures.
5. Decide whether `pms_pending_action_status` is generated from upstream projection or an agent-owned constrained read.
6. Switch the customer PMS profile to generated safe-read tools only after P3 routing is ready or behind an explicit transitional flag.

Touched files:

- `packages/unified-agent/src/pms-capability-tools.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/profile.ts`
- `packages/unified-agent/src/index.ts`
- `tests/tool-plan.test.ts`
- `tests/unified-agent.core.test.ts`

done_when:

1. Customer PMS visible safe-read tools are capability-derived, not hard-coded `gated_pms_read` targets.
2. Tool schemas reject extra fields.
3. Tool descriptions explain semantics, including that availability candidates are not total inventory.
4. Confirm/cancel are absent from visible manifests.
5. `pnpm build && pnpm test` pass.

stop_boundary:

1. Stop if the projection is too weak to distinguish safe read from mutation.
2. Stop if the implementation starts resembling a generic plugin framework.

### `P3` - per-capability-gateway-routing

- Owner boundary: `packages/gated-tools` and `apps/agent-service/src/executors.ts`
- State: `queued`
- Priority: `highest`

Goal:

Make Safety Gateway see the actual PMS capability ID for generated PMS tools and route execution through typed per-capability executors.

Work:

1. Use `gatedPmsSafeRead` for generated read tools.
2. Route generated tool execution to `pmsReadExecutors[capabilityId]`.
3. Pass validated params into `GatedToolRequest` using explicit fields, not lossy `target` fallthrough.
4. Ensure unknown PMS operations fail closed.
5. Delete the old `gated_pms_read` compatibility alias; no coarse read alias remains after P6.
6. Prove generated `pms_availability_search` audits as `pms_availability_search`, not a coarse read capability.
7. Prove generated `pms_inventory_summary` audits as `pms_inventory_summary`.

Touched files:

- `packages/gated-tools/src/pms-tools.ts`
- `packages/unified-agent/src/pms-capability-tools.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `apps/agent-service/src/executors.ts`
- `tests/gated-tools.test.ts`
- `tests/tool-plan.test.ts`
- `tests/agent-service-runtime.test.ts`

done_when:

1. Safety Gateway audit receives real capability IDs for generated PMS tools.
2. Fine-grained read tools use `pmsReadExecutors`, not coarse `pmsRead`.
3. Unknown operations do not fall through to capabilities manifest or availability.
4. Confirm/cancel remain non-visible.
5. `pnpm build && pnpm test` pass.

stop_boundary:

1. Stop if per-capability request params require widening `GatedToolRequest` into a generic untyped bag.
2. Stop if any change bypasses Safety Gateway for convenience.

### `P4` - pi-native-multi-tool-iteration

- Owner boundary: `packages/unified-agent/src/session.ts` and extracted owner modules if needed
- State: `queued`
- Priority: `high`

Goal:

Stop forcing normal actionable turns into one JSON object and let Pi call active PMS `customTools` directly, observe tool results, and continue tool use inside a single user turn.

Work:

1. Replace normal-turn `ToolPlanAction JSON-only output contract` with Pi-native tool availability.
2. Remove JSON plan parsing from the live normal-turn path; old JSON-shaped assistant text is treated as ordinary text in regression tests.
3. Capture tool-call and tool-result events enough to prove tool sequence and evidence refs.
4. Preserve final response synthesis and authority checks.
5. Preserve deterministic fallback only when the LLM is unavailable or stub mode is explicitly active.
6. Add the availability plus inventory summary product proof.

Touched files:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/session-turn-prompt.ts`
- `packages/unified-agent/src/pi-io.ts`
- `packages/unified-agent/src/session-evidence.ts`
- `packages/unified-agent/src/session-types.ts`
- `tests/unified-agent.core.test.ts`
- `tests/unified-agent.events-control.test.ts`
- `packages/evals/src/eval-cases.ts`

done_when:

1. One normal customer turn can call `pms_availability_search`, then `pms_inventory_summary`, then answer.
2. Final answer cites the PMS evidence refs returned by tools.
3. No regex fallback decides live PMS behavior while the LLM is available.
4. Raw built-in tools remain absent from the customer PMS profile.
5. `pnpm build && pnpm test` pass.

stop_boundary:

1. Stop if Pi SDK event semantics are unclear enough that evidence refs cannot be reliably captured.
2. Stop if removing JSON-only planning weakens Safety Gateway or final evidence validation.

### `P5` - safe-workflow-composition-tools

- Owner boundary: workflow tool registration and executor routing
- State: `queued`
- Priority: `medium`

Goal:

Expose booking preparation as safe composable workflow tools while keeping final PMS mutation behind typed approval/card flow.

Work:

1. Add separate tools for single-room draft create/update, quote, and prepare-confirm.
2. Add separate tools for group draft create/update, quote, and prepare-confirm where schemas differ.
3. Add or expose constrained `pms_pending_action_status` status readback.
4. Use evidence refs between tools where possible.
5. Keep final confirm/cancel unavailable as LLM tools.
6. Update booking workflow tests away from hidden `bounded_read_then_workflow` orchestration.

Touched files:

- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/pms-capability-tools.ts` or a new workflow tool module
- `apps/agent-service/src/executors.ts`
- `packages/safety-gateway/src/capability-registry.ts`
- `tests/unified-agent.pms-workflow.test.ts`
- `tests/agent-service-runtime.test.ts`
- `packages/evals/src/eval-cases.ts`

done_when:

1. Booking prep remains no-final-mutation.
2. Approval card creation requires pending-action evidence.
3. Single-room and group booking tests pass with new tool names.
4. Confirm/cancel are still card-callback-only.
5. `pnpm build && pnpm test` pass.

stop_boundary:

1. Stop if workflow tool design requires exposing raw pending-action confirm/cancel.
2. Stop if draft/update/quote/prepare cannot be represented with typed evidence refs.

### `P6` - scaffolding-shrink-and-closeout

- Owner boundary: `packages/unified-agent`
- State: `queued`
- Priority: `closeout`

Goal:

Delete or quarantine old scaffolding once the generated, per-capability, Pi-native path proves replacement behavior.

Work:

1. Remove live dependency on coarse `gated_pms_read(target=...)`.
2. Remove or quarantine `ToolPlanAction` JSON-only runtime scaffolding.
3. Remove obsolete `bounded_read_then_workflow` orchestration.
4. Update architecture and dialogue docs to reflect the new runtime.
5. Clean plan/archive state.
6. Keep only explicit LLM-unavailable or stub-mode fallback support; do not keep JSON-plan compatibility execution.

Touched files:

- `packages/unified-agent/src/tool-plan.ts`
- `packages/unified-agent/src/session-turn-prompt.ts`
- `packages/unified-agent/src/session.ts`
- `docs/dialogue-architecture.md`
- `ARCHITECTURE.md`
- `docs/plan/README.md`

done_when:

1. No live customer PMS turn depends on coarse target routing.
2. Tests/evals cover the replacement path.
3. Old compatibility code has deletion evidence.
4. Full gate passes: `pnpm build && pnpm test`.

stop_boundary:

1. Stop if deleting scaffolding would remove the only safe fallback for LLM-unavailable mode.
2. Stop if docs and runtime disagree after the shrink.

### `PACK_COMPLETE` - closeout-and-archive

- Owner boundary: plan closeout
- State: `queued`
- Priority: `closeout`

done_when:

1. P0-P6 complete with status evidence.
2. Full gate passes.
3. `docs/plan/README.md`, PLAN, STATUS, and WORKSET agree on `PACK_COMPLETE`.
4. The active triplet is archived to `docs/plan-archive/pms-pi-tool-surface-p0-p6-v1-2026-05-09/`.

## Exit Criteria

- Pi can perform multi-step PMS safe-read reasoning for availability discrepancy.
- PMS safe-read tools are capability-derived and Safety Gateway-audited by real capability ID.
- Booking preparation is composed from safe workflow tools and still ends at approval/card boundary.
- Coarse read targets and JSON-only normal-turn planning are no longer the live customer PMS path.
