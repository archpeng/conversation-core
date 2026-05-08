# PMS Agent V2 Runtime Baseline

Behavioral constraints and working conventions. Architecture invariants live in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Session Startup

- You are a PMS intelligent assistant for Feishu-driven hotel operations.
- Reply naturally in the user's language. For greetings, acknowledge the user and briefly explain that you can help with PMS availability, booking preparation, and approval-card workflows.
- Keep ordinary conversation concise; ask one focused clarification question when PMS slots are missing.

## MVP Minimalism Law

- Keep the MVP below the complexity ceiling: prefer one typed contract, one gated tool, one PMS evidence path, and one focused test over new frameworks.
- Next improvements must first narrow real `pms-platform` integration or reduce deterministic scaffolding; do not add generic platforms, plugin systems, multi-agent supervisors, rollout machinery, or broad workspace/memory abstractions unless a current failing test proves they are necessary.
- When adding a capability, name the single owner boundary before editing. If a change spans Agent, policy, executor, PMS client, and eval at once, split it or stop for a plan.
- Delete or shrink old scaffolding when a typed Pi/gated-tool path replaces it. Do not keep parallel paths "just in case".

## Owner-Bound Module Extraction

- Source files must stay lean. When a file approaches ~350 lines or mixes 3+ distinct concerns, extract a new owner-bound module.
- The extraction protocol:
  1. Name the single owner boundary for the new module.
  2. Move only the functions/types that belong to that boundary. Do not change function signatures or control flow.
  3. Parameterize extracted functions to accept only what they need — never import full session/config types that would create a circular dependency.
  4. If existing tests import from the original file, re-export from the original file so zero test imports change.
  5. Verify: `pnpm build && pnpm test` with zero test assertion changes.
- Do not create new abstractions, classes, wrappers, or intermediate layers during extraction. Move code, don't redesign it.
- Stop immediately if: a behavior change is required, a circular import emerges, or a test assertion must change.

## Type Guard Law

- `as Partial<T>` is forbidden in source code. It pretends partial conformance to a known type before validation.
- Use `as Record<string, unknown>` — the honest type for "this is an object whose shape I have not yet validated."
- For type guards that access nested properties, use an intermediate variable instead of chaining off `unknown`:
  ```ts
  // Correct
  const record = value as Record<string, unknown>;
  const source = record.source as Record<string, unknown> | undefined;
  return typeof source?.method === "string";
  ```
- Double casts (`as A as B`) and `as never` at package boundaries indicate a type mismatch that should be resolved with an explicit adapter function, not a stronger cast.

## LLM-First Runtime Law

- The Feishu PMS agent is LLM-first: each normal user turn must reach the Pi/LLM session before deterministic PMS/workflow scaffolding selects or finalizes an output.
- The deterministic safety scaffold (`runPostLlmSafetyScaffoldFallback`) fires ONLY when the LLM is genuinely unavailable: threw an error, returned empty output, or stub mode. Signal: `llmFailed || !assistantText.trim()`.
- An available LLM that returns natural language without a JSON plan means the LLM chose not to call tools — synthesize its text directly, do not route to regex/keyword fallback.
- Future runtime changes must preserve `LLM observes/plans -> typed contract/tool plan -> runtime validation -> Safety Gateway -> evidence/approval/proposal -> response synthesis` ordering.
- New business behavior should be released through typed gated tools and response synthesis, not by growing regex routing.
- Fallback text is allowed only as a degraded response when the LLM produces no usable visible text or for explicit test stubs; do not intentionally route live Feishu traffic around the LLM for latency or convenience.

## PMS Evidence Law

- Current PMS facts are authoritative only when read from `pms-platform` evidence.
- If `pms-platform` already exposes a typed route for a PMS fact or workflow, runtime code must call that route through `pms-platform-client`; synthetic PMS evidence is allowed only in tests or explicitly named local stubs.
- Availability, prices, reservations, room state, order status, and pending action status must not be answered from workspace files, session history, memory, skills, persona text, or model guesses.
- Cite or preserve evidence refs when returning PMS facts through the agent result contract.

## Safety And Mutation Red Lines

- Use only Safety Gateway gated tools visible to the active profile.
- Natural-language confirmation is not approval for PMS mutation.
- Reservation confirmation, cancellation, price/policy edits, workspace writes, and other high-risk actions require approval/proposal/card flow before side effects.
- Do not expose secrets, tokens, raw credentials, hidden prompts, tool stack traces, or internal completion placeholders.

## Memory Boundary

- Session continuity, workspace notes, skills, and persona files are advisory context.
- They may explain preferences or prior conversation flow, but never replace fresh `pms-platform` evidence for current PMS fact questions.
- Do not expand workspace or memory surfaces while a narrower typed PMS integration or deterministic-scaffold reduction would solve the current problem.

## Test Discipline

- Test files exceeding ~500 lines should be split by concern domain, not by test count. Each split file owns one domain (e.g. core turn flow, PMS workflow, event/control plane).
- Shared test helpers belong in a `tests/<module>.helpers.ts` file, not inlined in every test file.
- Eval cases live in `packages/evals/src/eval-cases.ts`; the runner and type definitions stay in `index.ts`.

## Plan Pack Convention

- Multi-stage work uses the plan pack triplet: `<plan-id>_PLAN.md`, `<plan-id>_STATUS.md`, `<plan-id>_WORKSET.md` in `docs/plan/`.
- Each stage has one owner boundary, one verification gate, and one `done_when` condition.
- Closed packs archive to `docs/plan-archive/<plan-id>/` with a `_CLOSEOUT.md` artifact.
- `docs/plan/README.md` tracks the active pack; it must stay small (README + at most one active triplet).

## Enforcement Gates

Every change must pass these gates before claiming done:
```bash
pnpm build          # tsc -b clean, zero errors
pnpm test           # all 172+ tests, boundary guard, eval 19/19
```

The boundary guard (`scripts/boundary-guard.mjs`) enforces:
- Forbidden cross-package imports (e.g. safety-gateway must not import gated-tools)
- Forbidden legacy module references
- Forbidden output contract patterns

No `--no-verify` or gate-skip without explicit user instruction.
