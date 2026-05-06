# PMS Agent LLM Capability C0-C5 Workset

Plan ID: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`

## Stage Order

- [ ] `C0` typed-intent-slot-contract
- [ ] `C1` llm-gated-tool-planning
- [ ] `C2` structured-session-state
- [ ] `C3` context-builder-advisory-injection
- [ ] `C4` evidence-grounded-response-synthesis
- [ ] `C5` eval-capability-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Active Stage

### `C0`

- Owner: `unified-agent-contract`
- State: `ACTIVE`
- Priority: `critical`

目标：

- Define the minimal typed intent / slot extraction contract that lets LLM understanding become runtime-verifiable without encoding a full business workflow tree.

必须交付：

1. Typed intent frame / slot state / missing-slot / ambiguity/confidence contract under the dominant owner surface, expected to be `packages/unified-agent` unless current code proves a narrower contract location.
2. Runtime parser/validator entrypoint for model-produced intent frames.
3. Tests proving valid frames pass, invalid frames fail, and contract shape does not become keyword-rule intelligence.
4. Documentation or inline contract note that C0 is an interface, not the business brain.

done_when:

1. Intent/slot contract exists and is imported by runtime-facing tests.
2. Tests prove missing slots are represented structurally and one focused clarification can be derived without hardcoding full workflows.
3. Static review finds no broad keyword router or deterministic business decision tree introduced as C0 intelligence.
4. `pnpm build`, targeted tests, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If implementation needs broad regex/keyword routing to pass, stop and replan C0.
2. If the contract starts deciding Safety Gateway policy or PMS fact truth, stop and replan.
3. If C0 requires raw tool exposure or direct PMS calls, stop immediately.

必须避免：

1. Do not encode all booking workflows into schema enums/if-else logic.
2. Do not treat user claims or session memory as PMS facts.
3. Do not add generic NLU framework abstractions unless a failing test proves the need.

执行提示：

1. Start by reading `packages/unified-agent/src/**` and existing unified-agent/customer loop tests to locate the narrowest contract owner.
2. Add the smallest possible typed interface and validator.
3. Add targeted tests before broad runtime integration.
4. Keep deterministic fallback tiny; do not build the business brain in C0.

## Completed Stage Evidence

- None yet. This pack was just created.

## Slice Ownership

### `C0`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `tests/unified-agent*.test.ts` or a new targeted test file under `tests/`
- Optional narrow doc note only if needed for SSOT discoverability

Forbidden owner drift:

- `packages/safety-gateway/src/**` unless C0 discovers a missing type import only; C0 must not change policy.
- `packages/pms-platform-client/src/**`; C0 must not call PMS.
- `packages/workspace-core/src/**`; C0 must not change filesystem rules.

### `C1`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/gated-tools/src/**` only for typed manifest/wrapper shape if existing types are insufficient
- `tests/unified-agent*.test.ts`, `tests/gated-tools.test.ts`, or targeted planning tests

### `C2`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `apps/agent-service/src/**` only if service session cache wiring must carry new structured state
- targeted session continuity tests

### `C3`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/workspace-tools/src/**` only through existing read/list APIs; avoid low-level changes unless review proves a narrow missing read surface
- context authority-label tests

### `C4`

Expected owner surfaces:

- `packages/unified-agent/src/**`
- `packages/adapter-contracts/src/**` only if a contract gap is proven; avoid changing `AgentResult` shape unless necessary
- response/evidence tests

### `C5`

Expected owner surfaces:

- `packages/evals/**`
- `tests/**`
- `scripts/boundary-guard.mjs` only if a named new boundary needs static proof

### `PACK_COMPLETE`

Expected owner surfaces:

- `docs/plan/*`
- `docs/plan-archive/pms-agent-llm-capability-c0-c5-v1-2026-05-06/`

## Expected Verification

For C0:

```bash
pnpm build
pnpm vitest run <targeted C0 tests>
pnpm guard:boundaries
git diff --check
```

For C1:

```bash
pnpm build
pnpm vitest run <targeted C1 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C2:

```bash
pnpm build
pnpm vitest run <targeted C2 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C3:

```bash
pnpm build
pnpm vitest run <targeted C3 tests>
pnpm test
pnpm guard:boundaries
git diff --check
```

For C4:

```bash
pnpm build
pnpm vitest run <targeted C4 tests>
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

For C5:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
git diff --check
```

For PACK_COMPLETE:

```bash
pnpm build
pnpm test
pnpm guard:boundaries
pnpm eval
plan_sync docs/plan
git diff --check
```

## Autopilot Transition Contract

- `wave_plan/completed` dispatches `execute` for the active stage.
- `execute/completed` dispatches same-stage `review`; do not advance the active slice during execute.
- `review/completed` is the accepted-stage writeback gate that updates README/STATUS/WORKSET to the next deterministic stage.
- `review/continue` keeps the same active stage for another execute cycle.
- `needs_replan` routes to `replan` and keeps parser truth honest.
- `blocked` or `failed` stop execution and preserve current active stage for repair.
- `done` is reserved for objective closeout only when active stage is `PACK_COMPLETE` and every non-deferred stage is done.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and no non-deferred C0-C5 stage remains.

## Detailed Execution Queue

### `C0` workset — typed-intent-slot-contract

执行步骤：

1. Read current unified-agent runtime files and tests to identify existing deterministic loop surfaces and current AgentResult path.
2. Define a small intent frame contract with fields for intent label, slot map, missing slots, ambiguity/confidence, source language, and evidence requirement hints if needed.
3. Define validator/parser for unknown model output; invalid output must fail safe.
4. Add focused clarification derivation from `missingSlots` without broad workflow branching.
5. Add tests for valid frame, invalid frame, missing-slot structure, and no PMS fact authority.
6. Run C0 validation and update STATUS/WORKSET only through accepted review.

预期：

- C0 creates an interface for LLM understanding, not a keyword router or booking workflow engine.

测试预期：

- Schema validation rejects malformed model output.
- Missing slots can drive one focused clarification.
- No C0 code calls PMS, Safety Gateway policy, or raw tools.

### `C1` workset — llm-gated-tool-planning

执行步骤：

1. Read existing profile/tool visibility and `runGatedTool` tests.
2. Define visible gated manifest per profile.
3. Define typed tool plan shape for call/clarify/refuse/approval boundary.
4. Validate planned tool names against profile-visible manifest.
5. Ensure executor calls remain behind Safety Gateway.
6. Add tests for non-visible tool rejection, raw executor rejection, customer workspace/bash denial, and natural-language confirm no mutation.

预期：

- LLM gets a safe action space, not raw tools.

测试预期：

- LLM-proposed disallowed actions fail before executor.
- Allowed calls still require Safety Gateway allow.

### `C2` workset — structured-session-state

执行步骤：

1. Read existing session cache/state surfaces.
2. Add bounded typed session state for slots and opaque refs.
3. Add merge/update rules from intent frame to session state.
4. Ensure redaction excludes raw text, raw PMS payloads, raw Feishu IDs, PII, and current PMS facts.
5. Add follow-up tests proving slot carryover and evidence re-read/citation requirement.

预期：

- Follow-up ability improves through state, not memory truth.

测试预期：

- Follow-up can fill missing slots.
- Current PMS facts still require PMS evidence.

### `C3` workset — context-builder-advisory-injection

执行步骤：

1. Read workspace-tools active-skill/list/read surfaces.
2. Define context bundle with authority labels.
3. Retrieve only bounded relevant advisory context.
4. Inject context into runtime prompt/tool planning as labeled observations.
5. Add tests proving advisory cannot answer current PMS facts.

预期：

- LLM has better context, but context authority remains explicit.

测试预期：

- Workspace/advisory context is `canAnswerCurrentPmsFact: false`.
- PMS evidence remains the only current fact authority.

### `C4` workset — evidence-grounded-response-synthesis

执行步骤：

1. Read existing AgentResult synthesis paths.
2. Separate response drafting from evidence validation.
3. Add validation that PMS fact-bearing text requires `pms-platform` evidence refs.
4. Preserve approval-card/proposal/refusal output boundaries.
5. Add tests for uncited PMS fact failure and high-risk mutation claim rejection.

预期：

- LLM can synthesize better answers while evidence law remains deterministic.

测试预期：

- PMS facts without evidence fail or become clarification/refusal/tool-read path.
- AgentResult remains adapter-safe.

### `C5` workset — eval-capability-pressure

执行步骤：

1. Add eval cases for follow-up, clarification, prompt injection, memory-not-truth, natural-language confirm, context advisory, and tool planning.
2. Ensure evals fail for broad hardcoded keyword workflows where possible.
3. Ensure `pnpm eval` remains the pack-level regression gate.
4. Run full validation.

预期：

- Eval becomes selection pressure for future LLM/tool/context/schema iteration.

测试预期：

- Safety/evidence/follow-up regressions fail loudly.

### `PACK_COMPLETE` workset — closeout-and-archive

执行步骤：

1. Confirm accepted reviews for C0-C5 are reflected in README/STATUS/WORKSET.
2. Run final validation.
3. Write closeout artifact with Bitter Lesson compliance and residual handoff.
4. Archive completed pack and reset hot parser surface.

预期：

- C-pack closes only after implementation and eval pressure prove the LLM capability release boundary.

测试预期：

- `plan_sync` sees terminal/no-active truth after archive.

## Machine Queue

- active_step: `C0`
- latest_completed_step: `none`
- intended_handoff: `execute-plan`
- latest_plan_summary: C0-C5 LLM capability release pack created.
- latest_verification:
  - `plan_sync before creation returned no active plans in docs/plan.`
  - `workspace_scan before creation showed main branch clean with dirty_files=0.`
  - `Read governing docs: docs/plan/README.md, AGENTS.md, docs/ARCHITECTURE_CONSTRAINTS.md, docs/WORKSPACE.md, docs/MEMORY_BOUNDARY.md.`
