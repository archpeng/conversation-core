# PMS Agent AI-Native Hardening H1-H4 Plan

Plan ID: `pms-agent-ai-native-hardening-h1-h4-v1-2026-05-07`
Status: `READY`
Source roadmap: `docs/roadmap/ai-native-code-quality-hardening-roadmap.md`
Mode: `single-root-autopilot-compatible`

## Goal

Turn the code-quality hardening roadmap into four small proof-carrying implementation slices that protect AI-native boundaries without increasing MVP architecture surface.

## Scope

In scope:

1. executable package import-boundary guard;
2. inbound HTTP body size limit;
3. minimal model-visible PMS tool public content while preserving runtime `details`;
4. runtime turn-event logging default or documentation alignment.

Out of scope:

1. broad `session.ts` extraction; roadmap `H5` remains opportunistic residual;
2. generic linter framework;
3. new Agent runtime, plugin system, workflow engine, or memory/workspace platform;
4. legacy compatibility or old response shape support;
5. production PMS mutation from natural language;
6. raw tools in Agent visibility.

## Constraints

- Preserve five-plane split: Agent, Capability/Policy, Fact Source, Executor, Audit/Eval.
- Every side effect remains Safety Gateway-gated before executor execution.
- PMS current facts remain authoritative only through `pms-platform` evidence.
- Use minimal code changes; prefer rule tables and targeted tests over broad abstractions.
- No compatibility paths: if a safer path replaces an unsafe surface, do not keep parallel production behavior.
- If a slice needs three or more dominant owner boundaries, stop and replan.
- If this pack runs under extension autopilot, each phase ends with exactly one `autopilot_report` and active-slice phases use `stepId` equal to the active slice ID.
- `execute/completed` routes to same-slice review; accepted `review/completed` is the docs/plan writeback point for the next slice.

## Verification

Default full gate after each accepted slice unless explicitly narrowed by the slice:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

## Blockers / Risks

| Risk | Response |
| --- | --- |
| Current working tree already contains uncommitted implementation changes unrelated to this plan pack. | Before final commit, inspect/stage intentionally; do not silently discard user changes. |
| Import guard grows into generic linter. | Keep `scripts/boundary-guard.mjs` rule-table based and tied to architecture SSOT. |
| HTTP body limit breaks legitimate adapter payloads. | Use conservative explicit limit and normal-turn regression. |
| PMS tool content minimization breaks LLM synthesis. | Keep summary/evidenceRef in content and complete evidence in `details.value`. |
| Logging default change surprises operators. | Pair code change with README/env-table update or document current default explicitly. |

## Autopilot Transition Contract

- Planning phases prepare parser truth; they do not claim implementation completion.
- `execute/completed` dispatches `review` for the same active slice and must not advance `Stage Order` by itself.
- `review/completed` accepts the active slice, writes completion evidence, and advances README/STATUS/WORKSET to the next stage or `PACK_COMPLETE`.
- `review/continue` keeps the same active slice for another execute cycle.
- `needs_replan` routes to `replan`; `blocked`/`failed` stops; `done` is reserved for whole-objective completion and closeout.
- Closeout is allowed only when README and WORKSET parse as active slice `PACK_COMPLETE`, owner `autopilot-closeout`, state `DONE`, and no non-deferred stages remain.

## Slice Definitions

#### `H1` — import-boundary-guard

- Owner: `execute-plan`
- State: `READY`
- Priority: `highest`

目标：

- Extend the existing boundary guard so architecture forbidden dependency directions are machine-checked.

交付物：

1. `scripts/boundary-guard.mjs` keeps legacy scans and adds import-direction rules.
2. `tests/boundary-guard.test.ts` proves denied and allowed package directions.
3. Current repository passes `pnpm guard:boundaries`.

允许触碰：

- `scripts/boundary-guard.mjs`
- `tests/boundary-guard.test.ts`
- smallest matching docs update only if rule names need documented explanation

done_when:

1. Forbidden imports such as `safety-gateway -> pms-platform-client`, `pms-platform-client -> unified-agent`, and `adapter-contracts -> agent-service` fail with clear rule IDs.
2. Existing legacy module / old `replies[]` checks still pass their tests.
3. `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass at minimum; run full default gate before commit if time permits.

stop_boundary:

1. Stop if enforcing a rule requires TypeScript compiler plugins or a new lint framework.
2. Stop if current package ownership in code contradicts `docs/ARCHITECTURE_CONSTRAINTS.md`; replan instead of weakening the guard silently.
3. Stop if the change requires touching runtime business logic.

必须避免：

1. Do not add broad generic lint infrastructure.
2. Do not modify production runtime code for this slice.
3. Do not weaken existing legacy exclusion checks.

#### `H2` — http-body-size-limit

- Owner: `execute-plan`
- State: `queued`
- Priority: `high`

目标：

- Bound inbound request body accumulation at `apps/agent-service` before payload reaches service handling.

交付物：

1. Runtime config has an explicit max body byte limit, defaulting to a conservative value such as `256 KiB`.
2. Oversized POST returns deterministic safe response without stack trace or partial body echo.
3. Normal `/health` and valid `/v1/feishu-turn` behavior remains unchanged.

允许触碰：

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts` or nearest service-boundary test
- `README.md` only if a new env var or visible behavior is introduced

done_when:

1. Oversized body rejection is covered by a focused test.
2. Normal request regression remains green.
3. Full default gate passes before accepted review.

stop_boundary:

1. Stop if adapter payload shape or streaming protocol changes are needed.
2. Stop if the fix requires changing `adapter-contracts` DTO shape.
3. Stop if the body limit decision conflicts with deployment constraints not represented in docs.

必须避免：

1. Do not log request body content.
2. Do not expose stack traces.
3. Do not introduce external HTTP/server frameworks.

#### `H3` — pms-tool-public-content-minimization

- Owner: `execute-plan`
- State: `queued`
- Priority: `high`

目标：

- Minimize model-visible PMS tool `content` while preserving complete PMS evidence in `toolResult.details` for runtime orchestration.

交付物：

1. PMS allow tool content exposes only safe public fields: outcome, audit id, evidence ref, source method, summary.
2. Full `GatedToolResult` and `PmsEvidence` remain in `details.value`.
3. Tests prove raw room IDs / secret-looking PMS payload details are absent from content but available in details when needed.

允许触碰：

- `packages/unified-agent/src/tool-registration.ts`
- `tests/unified-agent.test.ts` or closest tool-registration test
- docs only if public tool content contract becomes user-facing

done_when:

1. PMS tool content redaction/minimization test passes.
2. Existing evidence-backed response synthesis and bounded workflow tests pass.
3. Full default gate passes before accepted review.

stop_boundary:

1. Stop if minimization requires changing `AgentResult` or PMS evidence schema.
2. Stop if runtime code starts reading from content instead of `details`.
3. Stop if non-PMS proposal tools need a separate policy decision not covered by this roadmap.

必须避免：

1. Do not remove evidence refs required for final replies.
2. Do not hide details from runtime orchestration.
3. Do not add a generic serialization framework.

#### `H4` — runtime-event-logging-default

- Owner: `execute-plan`
- State: `queued`
- Priority: `medium`

目标：

- Remove ambiguity around runtime turn-event stdout logging by making it opt-in or explicitly documenting the current default.

交付物：

1. Runtime config behavior is locked by test.
2. README env table matches the actual default.
3. Existing redacted event test remains green: no user text, no raw PMS payload, no evidenceRef, no pendingActionId.

允许触碰：

- `apps/agent-service/src/runtime.ts`
- `tests/agent-service-runtime.test.ts`
- `README.md`

done_when:

1. `PMS_AGENT_LOG_TURN_EVENTS` default and explicit `true`/`false` behavior are tested.
2. README documents the behavior if visible to operators.
3. Full default gate passes before accepted review.

stop_boundary:

1. Stop if observability requirements require external logging infrastructure.
2. Stop if event payload shape must include sensitive identifiers.
3. Stop if production deployment policy conflicts with the selected default.

必须避免：

1. Do not remove eventSink as a testable port.
2. Do not log raw user text or PMS payloads.
3. Do not introduce logging framework dependencies.

#### `PACK_COMPLETE` — closeout-and-archive

- Owner: `autopilot-closeout`
- State: `queued`
- Priority: `closeout`

目标：

- Close the hardening pack only after H1-H4 are accepted by review and docs/plan writeback is complete.

交付物：

1. STATUS/WORKSET show H1-H4 complete.
2. README current active slice is `PACK_COMPLETE`.
3. Final validation evidence is recorded.
4. Closed pack is ready to archive under `docs/plan-archive/`.

done_when:

1. All non-deferred stages are complete.
2. Full default gate has passed after H4.
3. Residual `H5` remains documented as opportunistic future work, not an active blocker.

stop_boundary:

1. Stop if any H1-H4 stage lacks accepted review evidence.
2. Stop if docs/plan files disagree on active slice.
3. Stop if uncommitted code changes are not intentionally included or explicitly excluded.

必须避免：

1. Do not claim closeout from an active non-terminal slice.
2. Do not archive active parser truth prematurely.
3. Do not include unrelated working-tree changes without inspection.

## Residuals

- Roadmap `H5` (`session.ts` owner-block extraction) is intentionally deferred until a future implementation naturally touches a bounded owner block.
- Existing uncommitted code changes in the working tree must be inspected separately before any full commit.

## Exit Criteria

- H1-H4 accepted by review.
- `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` pass.
- `docs/plan/README.md`, PLAN, STATUS, and WORKSET agree on `PACK_COMPLETE` before closeout.
