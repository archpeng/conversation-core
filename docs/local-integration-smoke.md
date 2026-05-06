# Local Integration Smoke

Purpose: prove the MVP loop wiring locally without production rollout, live Feishu, live PMS, external network, or secrets.

## Scope

The smoke uses local mocks for both edges:

```text
adapter-feishu mock
  -> POST /v1/feishu-turn
  -> pms-agent-v2 agent-service
  -> gated tools + Safety Gateway
  -> pms-platform evidence mock / proposal workspace mock / sandbox mock
  -> AgentResult
  -> adapter-feishu delivery mock
```

It is not a deployment, rollout, or production-readiness claim.

## Run

```bash
pnpm exec vitest run tests/integration-smoke.test.ts
```

The full local validation also runs this smoke through:

```bash
pnpm test
```

## Covered MVP loops

1. Feishu turn -> Agent text reply -> adapter delivery mock.
2. PMS read grounding -> Safety allow -> PMS evidence mock -> grounded text with evidence refs.
3. Reservation prepare-confirm -> Safety allow -> pending-action evidence -> approval card.
4. Natural-language confirm boundary -> refusal without pending action and approval-card boundary with pending action; no PMS confirm executor call.
5. Admin skill proposal -> proposal workspace writes for `SKILL.md`, `eval-fixtures.json`, and `risk-report.md`; no production publish path.
6. Sandbox bash validation -> allowlisted sandbox command allowed and network command denied before executor side effect.

## Redacted local inputs

Use placeholders only:

```json
{
  "tenantId": "tenant_1",
  "sessionId": "session_secret_smoke",
  "actor": { "role": "customer", "id": "actor_secret_smoke" },
  "message": { "text": "2026-05-06 suite availability" }
}
```

Do not put live Feishu IDs, PMS payloads, tokens, or production URLs in smoke fixtures.

## Sibling workspace evidence

P11 does not require sibling repo edits. Current workspace scan evidence:

- `pms-agent-v2`: dirty with active MVP pack implementation files.
- `adapter-feishu`: 7 existing changed files from accepted upstream/downstream alignment work; P11 does not add new sibling edits.
- `pms-platform`: clean.
