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

## Run deterministic test smoke

```bash
pnpm exec vitest run tests/integration-smoke.test.ts
```

The full local validation also runs this smoke through:

```bash
pnpm test
```

## Run local real HTTP smoke

Use three local processes with deterministic Pi stub mode and real HTTP between repos:

```bash
# terminal 1
cd /home/peng/dt-git/github/pms-platform
PMS_PLATFORM_LOCAL_HOST=127.0.0.1 \
PMS_PLATFORM_LOCAL_PORT=8791 \
PMS_PLATFORM_LOCAL_AUTH_TOKEN=local-pms-token \
PMS_PLATFORM_SANDBOX_RESET_ON_START=true \
npm run start:local-api

# terminal 2
cd /home/peng/dt-git/github/pms-agent-v2
PMS_AGENT_SERVICE_HOST=127.0.0.1 \
PMS_AGENT_SERVICE_PORT=8792 \
PMS_AGENT_AUTH_TOKEN=agent-token \
PMS_PLATFORM_BASE_URL=http://127.0.0.1:8791 \
PMS_PLATFORM_AUTH_TOKEN=local-pms-token \
PMS_AGENT_PI_MODE=stub \
PMS_AGENT_DEFAULT_CHECK_IN_DATE=2026-05-06 \
PMS_AGENT_DEFAULT_CHECK_OUT_DATE=2026-05-07 \
pnpm start

# terminal 3
cd /home/peng/dt-git/github/adapter-feishu
FEISHU_APP_ID=cli_fake_app \
FEISHU_APP_SECRET=cli_fake_secret \
ADAPTER_FEISHU_INGRESS_MODE=webhook \
ADAPTER_FEISHU_HOST=127.0.0.1 \
ADAPTER_FEISHU_PORT=8787 \
FEISHU_HOME_CHANNEL=oc-smoke \
PMS_AGENT_TURN_URL=http://127.0.0.1:8792/v1/feishu-turn \
PMS_AGENT_AUTH_TOKEN=agent-token \
PMS_PLATFORM_PENDING_ACTION_BASE_URL=http://127.0.0.1:8791 \
PMS_PLATFORM_PENDING_ACTION_TOKEN=local-pms-token \
npm start
```

Then POST a Feishu message webhook mock to adapter-feishu `/webhook`. In fake-credential smoke, adapter forwarding to `pms-agent-v2` should return `AgentResult.type = text`; final Feishu delivery may fail because fake Feishu credentials are intentionally not live.

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
