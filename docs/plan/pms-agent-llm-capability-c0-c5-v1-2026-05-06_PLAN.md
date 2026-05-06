# PMS Agent LLM Capability C0-C5 Plan

Plan ID: `pms-agent-llm-capability-c0-c5-v1-2026-05-06`
Status: `ACTIVE`
Created: 2026-05-06
Mode: `single-root-autopilot-compatible`
Source baseline:

- Closed foundation pack: `docs/plan-archive/pms-agent-workbench-w0-w2-v1-2026-05-06/`
- Architecture SSOT: `docs/ARCHITECTURE_CONSTRAINTS.md`
- Workspace SSOT: `docs/WORKSPACE.md`
- Memory boundary SSOT: `docs/MEMORY_BOUNDARY.md`
- Runtime baseline: `AGENTS.md`

## Objective

Release LLM capability through typed intent, gated planning, structured session state, authority-labeled context, evidence-grounded response synthesis, and eval pressure without granting naked tools or weakening Safety Gateway.

Target mechanism:

```text
LLM
  receives: typed user turn, structured session state, authority-labeled context,
            visible gated tool manifest, previous evidence/tool observations
  produces: intent frame, tool plan, response draft

Runtime validates: schema, profile-visible tools, evidence requirements, no naked executor
Safety Gateway decides: allow, deny, require_approval
Tools return: PMS evidence, workspace advisory result, audit refs
Eval scores: task success, safety boundary, evidence grounding, follow-up quality
```

## Bitter Lesson-Compatible Design Principles

1. **Contract is interface, not intelligence.**
   - Typed schemas define what the model must return.
   - They do not encode all business decisions.
   - 类型契约只承载输入输出边界，不承载完整业务大脑。

2. **LLM chooses among gated actions.**
   - The model chooses tool plans from a visible gated manifest.
   - Runtime validates.
   - Safety Gateway decides.
   - LLM 负责选动作，系统负责验动作，Safety Gateway 负责裁决。

3. **Context is retrieved and authority-labeled.**
   - Context Builder retrieves and labels context.
   - It does not convert advisory notes into facts.
   - context-builder 提供带权威等级的观察，不把建议性内容升级为事实。

4. **PMS evidence is environment observation.**
   - Current PMS facts are observations from `pms-platform`, not memory or prompt knowledge.
   - PMS evidence 是环境观察，不是 prompt 知识。

5. **Eval creates selection pressure.**
   - Eval results drive prompt/tool/context/schema iteration.
   - eval 不是装饰测试，而是驱动系统演化的选择压力。

## In Scope

- C0 typed intent / slot extraction contract as a small interface for LLM output, not a keyword router.
- C1 LLM-driven planning over profile-visible gated tool manifests, with runtime shape validation and Safety Gateway as the only execution boundary.
- C2 structured redacted session state for continuity, slots, refs, and prior evidence refs; no PMS current facts as memory truth.
- C3 Context Builder for active skills / workspace advisory / session continuity with authority labels and injection budget.
- C4 evidence-grounded response synthesis that requires `pms-platform` evidence refs for current PMS facts.
- C5 eval hardening for follow-up, clarification, prompt injection, memory-not-truth, natural-language confirm, and gated-tool planning boundaries.

## Non-Goals

- No raw read/write/edit/bash/http/PMS executor exposure to LLM.
- No direct PMS mutation from natural language.
- No approval/promote/archive/supersede lifecycle implementation.
- No Daily Sweep or lesson-mining automation.
- No production DB/object storage migration.
- No full admin proposal runtime migration unless a later pack explicitly replaces the old ownership path.
- No full proposal Eval Runner that persists proposal eval outputs under `evals/{runId}/`; C5 covers this pack's runtime/eval pressure only.
- No generic workflow engine, generic plugin system, or broad prompt-rule dump.

## Stage Order

- [ ] `C0` typed-intent-slot-contract
- [ ] `C1` llm-gated-tool-planning
- [ ] `C2` structured-session-state
- [ ] `C3` context-builder-advisory-injection
- [ ] `C4` evidence-grounded-response-synthesis
- [ ] `C5` eval-capability-pressure
- [ ] `PACK_COMPLETE` closeout-and-archive

## Stage Definitions

#### `C0` typed-intent-slot-contract

- Owner: `unified-agent-contract`
- State: `ACTIVE`
- Priority: `critical`

目标：

- Define the minimal typed intent / slot extraction contract that lets LLM understanding become runtime-verifiable without encoding a full business workflow tree.

交付物：

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

#### `C1` llm-gated-tool-planning

- Owner: `unified-agent-runtime`
- State: `QUEUED`
- Priority: `critical`

目标：

- Let the LLM choose typed plans from a profile-visible gated tool manifest while runtime validates the plan and Safety Gateway remains the only execution authority.

交付物：

1. Visible gated tool manifest contract for `customer_pms` and `admin_customization` profiles.
2. Typed tool-plan schema covering `call_tool`, `ask_clarification`, and `refuse`/`require_approval` style outcomes.
3. Runtime validation rejecting non-visible tools, naked executor names, malformed plans, and unsafe direct mutation requests.
4. Tests proving `LLM proposes -> runtime validates -> Safety Gateway decides -> executor runs only if allowed` ordering.

done_when:

1. LLM/tool-plan path can choose among gated tools without raw executor visibility.
2. Denied or approval-required Safety decisions prevent executor side effects.
3. Customer profile cannot plan workspace/bash/raw file tools.
4. Natural-language confirm cannot become direct PMS mutation.
5. `pnpm build`, targeted C1 tests, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If tool planning bypasses `runGatedTool` or workspace Safety Gateway equivalents, stop.
2. If planner becomes a fixed workflow table instead of LLM-selected gated actions, stop and replan.
3. If admin proposal runtime migration becomes necessary, stop and split a dedicated successor pack instead of mixing ownership.

必须避免：

1. Do not expose raw filesystem/PMS/bash/http tools to the LLM.
2. Do not move Safety Gateway decisions into prompt text or runtime heuristics.
3. Do not introduce parallel old/new production tool paths with unclear ownership.

#### `C2` structured-session-state

- Owner: `unified-agent-session`
- State: `QUEUED`
- Priority: `high`

目标：

- Add small structured session continuity so follow-ups can carry slots, intent, refs, and evidence refs without making memory a PMS fact source.

交付物：

1. Redacted structured session state type for intent label, slot memory, missing slots, draft/pending/card/evidence refs, and safety flags.
2. Merge/update rules for current intent frame plus previous session state.
3. Tests proving follow-up slot carryover and forbidden durable fields are absent.
4. If file persistence is added, it must be bounded/redacted and under the existing workspace/session boundary; otherwise C2 remains in-memory/runtime-scoped.

done_when:

1. Follow-up turns can reuse prior non-factual slots/refs through typed state.
2. Tests prove raw user text, raw Feishu IDs, raw PMS payloads, prices, availability counts, and room/order current states are not persisted as session truth.
3. Follow-up PMS fact requests still require fresh or explicitly cited PMS evidence.
4. `pnpm build`, targeted C2 tests, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If session state stores current PMS facts as answer authority, stop.
2. If persistence requires production DB/object storage decisions, stop and defer.
3. If session code starts owning Safety Gateway policy or executor side effects, stop.

必须避免：

1. Do not store full transcripts or raw PII.
2. Do not use memory to answer availability, price, room state, reservation status, or pending action validity.
3. Do not create a generic memory database.

#### `C3` context-builder-advisory-injection

- Owner: `unified-agent-context-builder`
- State: `QUEUED`
- Priority: `high`

目标：

- Build authority-labeled advisory context from active skills, workspace advisory surfaces, and session continuity so LLM receives better observations without upgrading advisory memory into fact authority.

交付物：

1. Context bundle type with source, authority, content summary, evidence refs if any, and `canAnswerCurrentPmsFact` flag.
2. Context retrieval path through existing gated/workspace-safe read/list surfaces where needed; no raw filesystem read.
3. Prompt/context injection adapter that keeps mandatory policy, PMS evidence, workspace advisory, session continuity, user claim, and model prior separated.
4. Tests proving advisory notes/active skills can guide behavior but cannot answer current PMS facts.

done_when:

1. Context Builder returns bounded authority-labeled context for relevant turns.
2. Workspace/advisory items are always `canAnswerCurrentPmsFact: false`.
3. PMS evidence, when present, remains distinguishable as environment observation.
4. Injection keeps prompt small and does not dump broad hand-written rule piles.
5. `pnpm build`, targeted C3 tests, `pnpm test`, `pnpm guard:boundaries`, and `git diff --check` pass.

stop_boundary:

1. If Context Builder reads workspace files without Safety Gateway/workspace-safe surface, stop.
2. If advisory context overrides PMS evidence or Safety Gateway decisions, stop.
3. If C3 turns into a broad prompt rule dump, stop and replan.

必须避免：

1. Do not make active skills/proposals/workspace notes PMS truth.
2. Do not inject secrets, raw transcripts, raw PMS payloads, or hidden prompts.
3. Do not implement approval/promote/archive in this slice.

#### `C4` evidence-grounded-response-synthesis

- Owner: `unified-agent-response`
- State: `QUEUED`
- Priority: `critical`

目标：

- Synthesize final `AgentResult` from intent, tool results, context, session, and PMS evidence while enforcing that current PMS facts require `pms-platform` evidence refs.

交付物：

1. Response synthesis contract or module that separates PMS facts, advisory guidance, clarification, refusal, approval-card, and proposal-created outcomes.
2. Evidence requirement validation for PMS fact-bearing `text_reply` outputs.
3. Tests proving uncited PMS facts fail, missing evidence triggers clarification/refusal/tool-read path, and high-risk mutation claims cannot be synthesized as completed text.
4. AgentResult outputs remain adapter-safe and do not expose pi internals, tool traces, raw PMS payloads, or hidden prompts.

done_when:

1. Current PMS fact replies include current `pms-platform` evidence refs or refuse/clarify instead.
2. Advisory/session/workspace/model prior cannot satisfy evidence requirement.
3. Approval-required outcomes become `approval_card` or safe refusal, not mutation-complete text.
4. `pnpm build`, targeted C4 tests, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` pass.

stop_boundary:

1. If response synthesis treats memory/workspace/user claims/model prior as current PMS truth, stop.
2. If final output leaks raw payloads, hidden prompt, stack traces, or tool traces, stop.
3. If C4 requires weakening `AgentResult`, stop and replan contract ownership.

必须避免：

1. Do not add old `body.replies[]` compatibility.
2. Do not claim final PMS mutations from natural language.
3. Do not use prompt-only policy as a substitute for response validation.

#### `C5` eval-capability-pressure

- Owner: `evals-and-boundary-tests`
- State: `QUEUED`
- Priority: `critical`

目标：

- Convert C0-C4 behavior into regression pressure so future prompt/tool/context/schema iteration is guided by task success and safety failures.

交付物：

1. Evals/tests for follow-up slot carryover, focused clarification, prompt injection, memory-not-truth, natural-language confirm, context advisory, and tool planning boundaries.
2. Assertions that LLM-planned actions use only visible gated tools and denied actions do not call executors.
3. Eval output continues to run through existing `pnpm eval`; no full proposal Eval Runner persistence is claimed.
4. Documentation/update notes tying failures back to Bitter Lesson principles and architecture laws.

done_when:

1. `pnpm eval` covers the new C-pack failure modes and passes.
2. `pnpm test` proves the same boundaries at unit/integration level where needed.
3. Prompt injection cannot bypass Safety Gateway, evidence requirements, or memory-not-truth law.
4. Follow-up quality improves through structured state rather than broad fixed workflows.
5. `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, and `git diff --check` pass.

stop_boundary:

1. If evals merely assert hardcoded keyword workflow outputs, stop and replan.
2. If eval fixtures require raw executors or production side effects, stop.
3. If C5 reveals earlier slice drift, route back to the owning slice instead of masking failure.

必须避免：

1. Do not use evals as decorative snapshots.
2. Do not weaken assertions to fit current implementation.
3. Do not claim full proposal Eval Runner or production eval storage.

#### `PACK_COMPLETE` closeout-and-archive

- Owner: `autopilot-closeout`
- State: `QUEUED`
- Priority: `terminal`

目标：

- Close the C0-C5 pack only after accepted reviews prove all slices complete and no non-deferred C-pack work remains.

交付物：

1. Closeout artifact summarizing C0-C5 deliverables, Bitter Lesson compliance, validation evidence, and residuals.
2. Hot/cold plan hygiene: completed pack archived under `docs/plan-archive/`; `docs/plan/README.md` reset to no active pack.
3. Residual handoff for admin proposal runtime migration, full proposal Eval Runner, Approval/Promote/Archive, Daily Sweep, and production storage.

done_when:

1. C0-C5 are accepted by review and marked done.
2. Final validation passes: `pnpm build`, `pnpm test`, `pnpm guard:boundaries`, `pnpm eval`, `plan_sync`, and `git diff --check`.
3. Closeout artifact records evidence and residual handoff.
4. Hot parser surface contains only allowed active/no-active parser files after archive.

stop_boundary:

1. If any C0-C5 slice remains active, queued, failed, or needs review, hand back to that slice.
2. If final implementation violates Bitter Lesson-compatible principles by replacing LLM planning with broad hand-written workflows, replan before closeout.
3. If Safety Gateway is no longer the unique execution boundary, closeout is forbidden.

必须避免：

1. Do not claim production readiness or full lifecycle completion.
2. Do not archive before parser truth and closeout evidence are aligned.
3. Do not hide residuals created by C-pack scope cuts.

## Verification Ladder

Minimum validation grows by slice:

```text
C0: pnpm build + targeted contract tests + pnpm guard:boundaries + git diff --check
C1: C0 gates + targeted gated-planning tests + pnpm test
C2: C1 gates + targeted session continuity tests
C3: C2 gates + context authority-label tests
C4: C3 gates + response evidence validation + pnpm eval
C5: full pnpm build + pnpm test + pnpm guard:boundaries + pnpm eval + git diff --check
PACK_COMPLETE: full validation + plan_sync + closeout/archive proof
```

## Continuous Wave Ladder

Accepted review writeback advances exactly one stage at a time:

```text
C0 -> C1 -> C2 -> C3 -> C4 -> C5 -> PACK_COMPLETE
```

Do not jump over queued stages. Each stage must complete `execute -> review -> accepted writeback` before the next stage becomes active.

## Autopilot Transition Contract

- `wave_plan/completed` dispatches `execute` for the active stage.
- `execute/completed` dispatches same-stage `review`; do not advance the active slice during execute.
- `review/completed` is the accepted-stage writeback gate that updates README/STATUS/WORKSET to the next deterministic stage.
- `review/continue` keeps the same active stage for another execute cycle.
- `needs_replan` routes to `replan` and keeps parser truth honest.
- `blocked` or `failed` stop execution and preserve current active stage for repair.
- `done` is reserved for objective closeout only when active stage is `PACK_COMPLETE` and every non-deferred stage is done.
- Closeout is forbidden unless README and WORKSET parse as active stage `PACK_COMPLETE`, owner `autopilot-closeout`, and no non-deferred C0-C5 stage remains.

## Review Checklist

Before accepting any stage, verify:

1. Contract remains interface, not full intelligence.
2. LLM action choice is over visible gated tools only.
3. Runtime validates schema/profile/evidence/no-naked-executor.
4. Safety Gateway is the only execution authority for side effects.
5. Context is authority-labeled and advisory context does not become PMS truth.
6. PMS facts in final replies come from `pms-platform` evidence refs.
7. Eval/test additions create selection pressure instead of snapshotting brittle keyword flows.
8. Package ownership matches `docs/ARCHITECTURE_CONSTRAINTS.md`.
9. No legacy compatibility, raw tools, production mutation, or generic framework drift is introduced.

## Residuals After This Pack

Expected residuals unless explicitly superseded by a future plan:

- Full admin proposal runtime migration to `workspace_*` tools.
- Full proposal Eval Runner with persisted results under `evals/{runId}/`.
- Approval/Promote/Archive lifecycle.
- Daily Sweep / lesson mining.
- Production DB/object storage backend.
- Production adapter replacement and rollout validation.
