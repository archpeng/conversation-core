# PMS Agent AI-Native Hardening H1-H4 Workset

Plan ID: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`

## Stage Order

- [ ] `H1` import-boundary-guard
- [ ] `H2` http-body-size-limit
- [ ] `H3` pms-tool-public-content-minimization
- [ ] `H4` runtime-event-logging-default
- [ ] `PACK_COMPLETE` closeout-and-archive

## Active Stage

### `H1`

- Owner: `execute-plan`
- State: `READY`
- Priority: `highest`

目标：

- Convert documented package ownership constraints into executable import-boundary checks in the existing boundary guard.

必须交付：

1. Rule-table import direction checks in `scripts/boundary-guard.mjs`.
2. Focused tests in `tests/boundary-guard.test.ts` proving forbidden and allowed directions.
3. Passing validation for the current repo.

done_when:

1. Forbidden imports such as `safety-gateway -> pms-platform-client`, `pms-platform-client -> unified-agent`, `safety-gateway -> gated-tools`, `adapter-contracts -> agent-service`, and `workspace-core -> safety-gateway` are rejected with clear rule IDs.
2. Existing legacy dependency, old `replies[]`, and compat-module guard behavior remains covered.
3. `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass at minimum.

stop_boundary:

1. Stop if the guard needs a new linter framework, TS compiler plugin, or broad dependency analysis package.
2. Stop if current code violates a documented forbidden direction and fixing it would require runtime behavior changes outside H1.
3. Stop if the slice needs edits outside `scripts/boundary-guard.mjs`, `tests/boundary-guard.test.ts`, or tiny docs wording.

必须避免：

1. Do not add generic lint infrastructure.
2. Do not change production runtime behavior in H1.
3. Do not weaken or remove existing legacy guard rules.
4. Do not hide violations through broad ignore patterns.

## Slice Ownership

### `H1`

- `scripts/boundary-guard.mjs`
- `tests/boundary-guard.test.ts`
- Optional: smallest matching docs wording if rule IDs need explanation

### `H2`

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts` or nearest service-boundary test
- Optional: `README.md` env table if configurable limit is added

### `H3`

- `packages/unified-agent/src/tool-registration.ts`
- `tests/unified-agent.test.ts` or nearest tool-registration test

### `H4`

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts`
- `README.md`

### `PACK_COMPLETE`

- `docs/plan/README.md`
- `docs/plan/*_STATUS.md`
- `docs/plan/*_WORKSET.md`
- final closeout/archive files under `docs/plan-archive/`

## Expected Verification

Default full gate before pack closeout:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

H1 minimum execution gate:

```bash
pnpm test
pnpm guard:boundaries
git diff --check
```

Planning handoff gate:

```bash
plan_sync docs/plan
git diff --check
pnpm guard:boundaries
```

## Per-Stage Verification Notes

| Stage | Required focused proof |
| --- | --- |
| `H1` | negative forbidden-import fixture and current repo passing guard |
| `H2` | oversized body rejection and normal turn unaffected |
| `H3` | PMS tool content hides raw payload while `details.value` preserves complete evidence |
| `H4` | logging default and explicit env behavior tested; README matches code |
| `PACK_COMPLETE` | full default gate plus parser truth set to terminal state |

## Autopilot Transition Contract

- `execute/completed` proves implementation evidence and dispatches same-slice `review`.
- Do not mark or advance the active slice from execute alone unless the whole objective reports `done` and parser truth is already terminal.
- `review/completed` is the accepted writeback gate that marks the reviewed slice complete and loads the next `Stage Order` item as `Active Stage`.
- `review/continue` keeps this `Active Stage`; `needs_replan` routes to `replan`; hard stops leave this stage active for repair.
- The next execute phase may run only after README/STATUS/WORKSET parse with the same active slice and intended handoff.
- Closeout is premature unless README and WORKSET name active slice `PACK_COMPLETE`, owner `autopilot-closeout`, state `DONE`, and all H1-H4 stages are complete or explicitly deferred.

## Execution Notes

- Under extension autopilot, the active stage ID is the `stepId` for active-slice reports.
- Skill-backed phases require `selectedTools` including `read` and `autopilot_report`.
- Do not make “ask whether to continue” the default stop rule; use the active stage `done_when` / `stop_boundary`.
- Review routes to `execution-reality-audit`; closeout uses the repo-local closeout prompt surface.
- Keep transition contract explicit whenever the workset is repaired or superseded.
- Before any full commit, inspect pre-existing uncommitted source/test changes and stage only intentional changes.
