# Agent First Mobile R1-R7 Plan

Plan id: `agent-first-mobile-r1-r7-v1-2026-05-11`

Scope: close R1-R4 read-only mobile product alignment, then implement R5 reservation workflow UI, R6 typed operations, R7 audit review detail, and auth/session/RBAC.

## Stage C0: R1-R4 Closeout

Owner boundary: product read orchestration

Tasks:

1. Add product read object contracts for room, reservation, and availability.
2. Extend Product Gateway read APIs for profile/catalog task feed, reservation lookup, and availability search.
3. Extend mobile Objects view to express room, reservation, and availability read models.
4. Add contract, gateway, and mobile UI tests.

Verification:

```bash
pnpm build
pnpm test
```

done_when:

- R1-R4 read-only surface covers hotel profile, room type catalog, today arrivals/departures, inventory, room context, reservation lookup, and availability search.
- Every PMS fact returned to mobile carries evidence refs.
- No PMS mutation is added in C0.

## Stage R5: Reservation Workflow UI

Owner boundary: reservation workflow cards

Tasks:

1. Add reservation draft/quote/prepare-confirm product-contract shapes.
2. Add Product Gateway routes for single-room draft create/update/quote/prepare-confirm.
3. Add Product Gateway routes for group draft create/update/quote/prepare-confirm.
4. Add mobile reservation workflow card renderer for draft, quote, and prepare-confirm states.
5. Add slot capture form state for dates, room type, guest count, guest name, and group selections.
6. Add pending-action status readback and card refresh.
7. Add tests proving prepare-confirm stops at pending-action and does not confirm.

Verification:

```bash
pnpm build
pnpm test
```

done_when:

- Single-room and group reservation journeys can reach pending-action cards from mobile.
- UI never shows raw PMS token or stack traces.
- Natural-language confirmation still cannot trigger mutation.

## Stage R6: Typed Operations

Owner boundary: explicit action execution

Tasks:

1. Generalize action execution contract beyond reservation pending action.
2. Add check-in prepare/confirm card mapping.
3. Add check-out prepare/confirm card mapping.
4. Add housekeeping done/inspection/rework card mapping.
5. Add maintenance report/done/restore-sellable card mapping.
6. Add Product Gateway execution routes for supported typed operation refs.
7. Add mobile ActionCard enabled/disabled/loading/error states for these operations.
8. Persist or surface PMS audit refs on committed/rejected cards.
9. Add idempotency/error mapping for expired, rejected, and failed actions.
10. Add tests proving text-only confirmation does not execute any mutation.

Verification:

```bash
pnpm build
pnpm test
```

done_when:

- Supported operations execute only from typed cards.
- Committed/rejected/failed/expired states are visible in mobile UI.
- Audit refs are available after mutation.

## Stage R7: Audit Review Detail

Owner boundary: retrospective review

Tasks:

1. Add review detail contracts for task, evidence refs, safety audit refs, PMS audit refs, actor, and timestamps.
2. Add Product Gateway review detail routes backed by task ledger plus safety/PMS audit readback.
3. Add mobile Review detail screen with filters for committed, rejected, failed, and expired actions.
4. Add manager-oriented shift summary totals with latest audit links.
5. Add tests for readback traceability from review item to task/evidence/audit refs.

Verification:

```bash
pnpm build
pnpm test
```

done_when:

- Review can trace each action to task/evidence/audit refs.
- Review remains retrospective and is not the main action surface.

## Stage A1: Auth, Session, And RBAC

Owner boundary: mobile session boundary

Tasks:

1. Replace preview actor defaults with a gateway-issued session contract.
2. Add tenant/property selection to session scope without exposing PMS bearer tokens.
3. Add role gates for staff, manager, and admin card actions.
4. Add tests for unauthorized, wrong-role, and wrong-tenant action attempts.

Verification:

```bash
pnpm build
pnpm test
```

done_when:

- Mobile no longer hardcodes actor/session for production mode.
- Gateway enforces tenant/property/role before action execution.
- Browser never stores PMS or Agent service tokens.
