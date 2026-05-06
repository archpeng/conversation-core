# Architecture

`pi-coding-agent` is the Agent core. It owns understanding, planning, tool-call intent, and response drafting. It does not own permissions, PMS truth, or final mutation authority.

Long-term architecture and AI-readability constraints are the active SSOT in `docs/ARCHITECTURE_CONSTRAINTS.md`.

## Planes

| Plane | Owns | Must not own |
| --- | --- | --- |
| Agent | understanding, planning, tool-call intent, response drafting | raw permission, PMS truth, final mutation authority |
| Capability / Policy | capability registry, risk class, constraints, approval rules | business facts, executor side effects |
| Fact Source | PMS evidence, current room/reservation/workflow state | prompt memory or Agent transcript truth |
| Executor | constrained PMS, file, bash, sandbox execution | policy decisions |
| Audit / Eval | traceability, regression proof, safety validation | runtime authorization |

## Boundary law

Safety Gateway is the only execution boundary. Every executor/tool call must be evaluated before it can run. There is no direct Agent-to-executor path.

## PMS truth law

Agent memory may hold redacted continuity references. PMS facts must come only from `pms-platform` evidence envelopes.
