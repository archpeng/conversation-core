# PMS E2E Test Surfaces

## Default Golden E2E

`golden-group-booking.e2e.test.ts` is deterministic and runs in the normal `pnpm test` gate. It uses a scripted Pi session, but still exercises the real PMS tool surface, runtime executors, PMS client request shapes, and approval-card synthesis.

Use it to protect stable product behavior without calling a live model.

```bash
pnpm vitest run tests/golden-group-booking.e2e.test.ts
```

## Live Smoke

`live-group-booking.smoke.test.ts` is opt-in because it calls the running `pms-agent-v2` service and depends on the configured real Pi/LLM runtime. It sends the same three Chinese turns used in the production incident, expects an `approval_card`, simulates the typed card confirm against `pms-platform`, and verifies platform readback.

It is skipped unless `RUN_PMS_LIVE_SMOKE=true`.

```bash
set -a
source /home/peng/dt-git/github/pms-platform/.env
source /home/peng/dt-git/github/pms-agent-v2/.env
set +a
RUN_PMS_LIVE_SMOKE=true PMS_LIVE_SMOKE_RESET=true pnpm vitest run tests/live-group-booking.smoke.test.ts
```

The live smoke should not replace the golden E2E in CI; it is for validating a running local/staging chain with real model behavior.
