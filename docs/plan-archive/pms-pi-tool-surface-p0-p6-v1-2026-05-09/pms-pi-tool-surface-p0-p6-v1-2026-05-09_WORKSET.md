# PMS Pi Tool Surface P0-P6 Workset

Plan ID: `pms-pi-tool-surface-p0-p6-v1-2026-05-09`

## Stage Order

- [x] `P0` progress-audit-and-regression-pressure
- [x] `P1` typed-client-coverage-acceptance
- [x] `P2` capability-derived-safe-read-tools
- [x] `P3` per-capability-gateway-routing
- [x] `P4` pi-native-multi-tool-iteration
- [x] `P5` safe-workflow-composition-tools
- [x] `P6` scaffolding-shrink-and-closeout
- [x] `PACK_COMPLETE` closeout-and-archive

## Machine Queue

- active_step: `none`
- latest_completed_step: `PACK_COMPLETE`
- intended_handoff: `archive complete`
- pack_state: `PACK_COMPLETE`

## `P0` Workset - progress-audit-and-regression-pressure

Owner boundary: `packages/evals` and existing unified-agent tests

Status: `completed`

Primary files:

- `packages/evals/src/eval-cases.ts`
- `packages/evals/src/index.ts`
- `tests/tool-plan.test.ts`
- `tests/unified-agent.core.test.ts`
- `tests/unified-agent.events-control.test.ts`

Tasks:

1. Preserve the current progress audit in `STATUS.md`.
2. Strengthen the 13-total/12-available discrepancy case.
3. Make the expected behavior explicit:
   - first availability safe read;
   - then inventory summary safe read;
   - answer explains full-stay candidates versus total inventory;
   - evidence refs are preserved.
4. Record whether the case is expected to fail until P2/P3/P4 are implemented.

done_when:

1. Regression requires `pms_availability_search` plus `pms_inventory_summary`.
2. Final answer cites both evidence refs and explains 12 candidates versus 13 total rooms.
3. `pnpm build && pnpm test` passed.

## `P1` Workset - typed-client-coverage-acceptance

Owner boundary: `packages/pms-platform-client`

Status: `completed`

Primary files:

- `packages/pms-platform-client/src/client.ts`
- `packages/pms-platform-client/src/inventory-client.ts`
- `packages/pms-platform-client/src/inventory-schemas.ts`
- `docs/pms-platform-endpoint-map.md`
- `tests/pms-platform-client.test.ts`
- `apps/agent-service/src/executors.ts`

Tasks:

1. Re-verify typed client methods and evidence wrapping.
2. Remove obsolete executor casts for new client methods.
3. Confirm invalid input tests cover each method.
4. Confirm endpoint map matches code.

done_when:

1. Runtime executors call typed methods directly.
2. Transitional `Record<string, Function>` method casts are removed.
3. `pnpm build && pnpm test` passed.

## `P2` Workset - capability-derived-safe-read-tools

Owner boundary: `packages/unified-agent` tool registration

Status: `completed`

Primary files:

- `packages/unified-agent/src/pms-capability-tools.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/profile.ts`
- `packages/unified-agent/src/index.ts`
- `tests/tool-plan.test.ts`

Tasks:

1. Add or adapt a PMS planner projection item type.
2. Generate safe-read tool descriptors from projection items.
3. Preserve curated semantic descriptions as overrides.
4. Reject unsupported params with schema tests.
5. Decide how `pms_pending_action_status` enters the visible surface.
6. Avoid raw endpoint mirroring and generic plugin abstractions.

done_when:

1. Safe read manifest is derived from capability projection data.
2. Confirm/cancel are absent from visible tools.
3. Generated schemas reject unsupported params.
4. `pnpm build && pnpm test` passed.

## `P3` Workset - per-capability-gateway-routing

Owner boundary: `packages/gated-tools` and `apps/agent-service/src/executors.ts`

Status: `completed`

Primary files:

- `packages/gated-tools/src/pms-tools.ts`
- `packages/unified-agent/src/pms-capability-tools.ts`
- `packages/unified-agent/src/tool-registration.ts`
- `apps/agent-service/src/executors.ts`
- `tests/gated-tools.test.ts`
- `tests/tool-plan.test.ts`
- `tests/agent-service-runtime.test.ts`

Tasks:

1. Use `gatedPmsSafeRead` in generated read tools.
2. Route by real capability ID to `pmsReadExecutors`.
3. Pass validated params through explicit request fields.
4. Add tests for `decide:pms_availability_search` and `decide:pms_inventory_summary`.
5. Delete the old `gated_pms_read` alias; no read compatibility alias remains.

done_when:

1. Generated PMS read tools audit under their own capability IDs.
2. Unknown capabilities fail closed.
3. `pms_availability_search` and `pms_inventory_summary` routing are covered by tests.
4. `pnpm build && pnpm test` passed.

## `P4` Workset - pi-native-multi-tool-iteration

Owner boundary: `packages/unified-agent/src/session.ts` and extracted owner modules

Status: `completed`

Primary files:

- `packages/unified-agent/src/session.ts`
- `packages/unified-agent/src/session-turn-prompt.ts`
- `packages/unified-agent/src/pi-io.ts`
- `packages/unified-agent/src/session-evidence.ts`
- `packages/unified-agent/src/session-types.ts`
- `tests/unified-agent.core.test.ts`
- `tests/unified-agent.events-control.test.ts`
- `packages/evals/src/eval-cases.ts`

Tasks:

1. Stop requiring JSON-only normal actionable turns.
2. Let Pi call active PMS custom tools directly.
3. Capture tool sequence and evidence refs.
4. Preserve final evidence-bound response synthesis.
5. Keep deterministic fallback only for LLM unavailable or explicit stub mode.

done_when:

1. One turn performs availability read, inventory summary read, and final answer.
2. Evidence refs from tools appear in final answer.
3. `pnpm build && pnpm test` pass.

## `P5` Workset - safe-workflow-composition-tools

Owner boundary: workflow tool registration and executor routing

Status: `completed`

Primary files:

- `packages/unified-agent/src/tool-registration.ts`
- `packages/unified-agent/src/pms-capability-tools.ts`
- `apps/agent-service/src/executors.ts`
- `packages/safety-gateway/src/capability-registry.ts`
- `tests/unified-agent.pms-workflow.test.ts`
- `tests/agent-service-runtime.test.ts`
- `packages/evals/src/eval-cases.ts`

Tasks:

1. Expose draft create/update, quote, and prepare-confirm as separate safe workflow tools.
2. Add group workflow variants where schemas differ.
3. Expose constrained pending-action status readback.
4. Update booking tests to prove no final mutation.
5. Keep confirm/cancel unavailable as LLM tools.

done_when:

1. Booking prep works through composable safe workflow tools.
2. Approval card still requires pending-action evidence.
3. `pnpm build && pnpm test` pass.

## `P6` Workset - scaffolding-shrink-and-closeout

Owner boundary: `packages/unified-agent`

Status: `completed`

Primary files:

- `packages/unified-agent/src/tool-plan.ts`
- `packages/unified-agent/src/session-turn-prompt.ts`
- `packages/unified-agent/src/session.ts`
- `docs/dialogue-architecture.md`
- `ARCHITECTURE.md`
- `docs/plan/README.md`

Tasks:

1. Remove live coarse `gated_pms_read(target=...)` dependency.
2. Remove or quarantine `ToolPlanAction` JSON-only scaffolding.
3. Remove obsolete `bounded_read_then_workflow`.
4. Remove coarse Safety Gateway `pms_read` and `pms_workflow` compatibility capability registrations.
5. Update architecture docs.
6. Prepare closeout archive.

done_when:

1. No live customer PMS turn depends on old coarse routing.
2. Replacement tests/evals pass.
3. Full gate passes.

## Verification Queue

Run after each implementation slice:

```bash
pnpm build
pnpm test
```

Closeout requires:

```bash
pnpm build
pnpm test
```

`pnpm test` already includes boundary guard and eval.

Latest observed gate:

- `pnpm build`: passed
- `pnpm test`: passed, 22 files, 172 tests
- boundary guard: passed
- eval: ok=true, 20/20
