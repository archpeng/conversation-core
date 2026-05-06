# PMS Agent V2 Roadmap

## MVP sequence

1. Bootstrap the clean monorepo and no-legacy guardrails.
2. Define `FeishuTurnInput -> AgentResult` adapter contracts.
3. Align `adapter-feishu` to the new contract without making this repo emit the old response shape.
4. Build Safety Gateway before any executor can run.
5. Add one gated tool runner path for every capability.
6. Add `pms-platform` client evidence envelopes.
7. Wire `pi-coding-agent` behind gated tools.
8. Expose the minimal agent-service API.
9. Prove customer PMS read / prepare-confirm and admin proposal loops.
10. Harden sandbox execution, audit, eval, and end-to-end smoke evidence.

## MVP limit

The MVP is PMS-specific. It does not include a generic plugin system, generic HTTP broker, multi-agent supervisor, database layer, or production deployment machinery.
