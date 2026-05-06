# Roadmap：AI-Native PMS Agent Monorepo

Status: optimized MVP SSOT
Date: 2026-05-06
Target repo: `pms-agent-v2`
Authoring location: `conversation-core/docs/roadmap/ai-native-pms-agent-monorepo-roadmap.md`

## 0. Core Decision

Build a clean AI-native PMS Agent monorepo. This is not a compatibility upgrade of `ai-conversation`.

Target product path:

```text
adapter-feishu
  -> pms-agent-v2/apps/agent-service
  -> packages/unified-agent using pi-coding-agent
  -> packages/gated-tools
  -> packages/safety-gateway
  -> pms-platform / sandbox workspace / proposal workspace / audit jsonl
```

MVP thesis:

```text
Agent can be strong.
Tools must be governed.
PMS facts must come from PMS Platform.
High-risk actions must be proposal / approval first.
Every action must be auditable and eval-covered.
```

The most important architecture law is the five-way split:

| Plane | Owns | Must not own |
| --- | --- | --- |
| Agent | understanding, planning, tool-call intent, response drafting | raw permission, PMS truth, final mutation authority |
| Capability / Policy | capability registry, risk class, constraints, approval rules | business facts, executor side effects |
| Fact Source | PMS evidence, current room/reservation/workflow state | prompt memory, Agent transcript truth |
| Executor | constrained PMS/file/bash/sandbox execution | policy decisions |
| Audit / Eval | traceability, regression proof, safety validation | runtime authorization by itself |

If these five concerns collapse into one layer, a strong Agent becomes an unsafe black box.

---

## 1. Non-negotiable Laws

### 1.1 Legacy exclusion

```text
No legacy ai-conversation compatibility code.
No old response-shape compatibility.
No migration of old runtime.
No V1/V2 dual path.
No fallback to ai-pms.
No pi-agent-core hot path.
No legacy adapter shim.
```

`ai-conversation` may be used only as:

```text
behavior reference
safety-boundary reference
eval fixture source
regression comparison baseline
```

It is not a runtime dependency.

### 1.2 Strong-Agent safety law

Agent sees only governed capabilities, never naked executors:

```text
pi-coding-agent
  -> gated tool definitions
  -> Safety Gateway evaluate(actor, tenant, profile, tool, params, risk, constraints)
  -> constrained executor
```

Forbidden shortcut:

```text
Agent -> read/write/edit/bash/http/pms_confirm executor directly
```

MVP must not contain temporary bypasses around Safety Gateway.

### 1.3 PMS truth law

Agent memory is not PMS truth.

Allowed memory/session use:

```text
recent turn continuity
last selected intent
redacted draftRef / pending refs
missing slot labels
last evidence refs
```

Forbidden as truth:

```text
availability count
room clean/dirty state
reservation payment/status
price
pending_action validity
raw PMS refs or payloads
```

Every PMS fact in a user-visible reply must trace to current `pms-platform` evidence.

### 1.4 Proposal / approval-first law

These are high-risk in MVP and must not execute directly from natural language:

```text
reservation confirm
cancel order
change price
change room state
lock/release room
publish skill
modify production config
execute generated code artifact
external HTTP side effect
```

Allowed MVP output:

```text
approval_card
pending_action reference
skill proposal
config proposal
code patch proposal
risk report
```

### 1.5 Minimal platform law

MVP is PMS-specific, not a generic Agent OS.

Do not build in MVP:

```text
multi-agent supervisor
generic plugin system
generic HTTP broker
multi-channel abstraction
complex workflow engine
long-term memory
admin UI
browser/canvas/cron/device-node abstractions
plugin market
```

---

## 2. Current Upstream / Downstream Reality

### 2.1 Existing system truth

Verified current active path in sibling repos:

```text
adapter-feishu -> ai-conversation -> pms-platform
```

Current owner split:

| Service | Current role |
| --- | --- |
| `adapter-feishu` | Feishu/Lark channel owner: ingress, delivery, allowlists, app credentials, typed-card callbacks. |
| `ai-conversation` | Current Pi conversation service; reference only for new system. |
| `pms-platform` | PMS business truth, typed APIs, reservation draft, pending action, audit/idempotency. |

### 2.2 Target replacement

The new repo replaces only the middle service:

```text
adapter-feishu -> pms-agent-v2 -> pms-platform
```

### 2.3 Upstream readiness: `adapter-feishu`

Current integration point exists but is old-contract shaped.

Already available:

```text
Feishu webhook / long_connection ingress
InboundTurn normalization
chat/user allowlist gate
HTTP turn forwarder
text reply delivery
reservation confirmation card delivery
adapter-owned pending callback state
typed-card callback forwarding to pms-platform
```

Current forwarder shape:

```text
POST ADAPTER_FEISHU_CONVERSATION_TURN_URL
header: X-AI-CONVERSATION-TOKEN
body: { source: 'adapter-feishu', turn: InboundTurn }
```

Current response parser expects:

```text
body.replies[]
  - { type: 'text', text }
  - { type: 'reservation_confirmation_card', ...old ai-conversation card contract }
```

MVP gap:

```text
adapter-feishu does not yet speak FeishuTurnInput -> AgentResult.
```

Required adapter slice:

```text
InboundTurn -> FeishuTurnInput
AgentResult.text_reply -> Feishu text
AgentResult.approval_card(pms_pending_action) -> existing typed-card delivery path
AgentResult.proposal_created -> admin-safe text/card
AgentResult.refusal -> safe text
AI_CONVERSATION_* env names replaced or aliased behind new PMS_AGENT_* names
```

Decision:

```text
Do not make pms-agent-v2 return old body.replies for speed.
Change adapter-feishu at the boundary so new system remains clean.
```

### 2.4 Downstream readiness: `pms-platform`

`pms-platform` has enough typed HTTP endpoints for MVP.

Important existing endpoints:

```text
GET  /health
GET  /v1/pms/capabilities/manifest
POST /v1/pms/room
POST /v1/pms/dashboard
POST /v1/pms/reservations/get
POST /v1/pms/availability/search
POST /v1/pms/reservation-drafts/create
POST /v1/pms/reservation-drafts/update
POST /v1/pms/reservation-drafts/quote
POST /v1/pms/reservation-drafts/prepare-confirm
POST /v1/pms/reservation-drafts/cancel
POST /v1/pms/pending-actions/status
POST /v1/pms/pending-actions/confirm
POST /v1/pms/pending-actions/cancel
```

Roadmap client mapping:

| `pms-agent-v2` client method | Existing PMS endpoint | MVP status |
| --- | --- | --- |
| `readAvailability` | `/v1/pms/availability/search` | ready |
| `readReservation` | `/v1/pms/reservations/get` | ready |
| `readRoom` | `/v1/pms/room` | ready |
| `prepareConfirm` | `/v1/pms/reservation-drafts/prepare-confirm` | ready |
| `getPendingAction` | `/v1/pms/pending-actions/status` | ready |
| typed confirm/cancel callback | `/v1/pms/pending-actions/confirm|cancel` | ready; called by `adapter-feishu`, not natural language Agent |

PMS platform already models:

```text
confirmationMode = typedCardOnly
pendingActionRef
cardPayloadRef
mutationStatus = none | deferred
cardPayloadRef mismatch rejection
pending action replay/conflict/expiry
audit refs
```

MVP client gap:

```text
Normalize PMS read/workflow outputs into Agent evidence envelopes:
  evidenceRef
  fetchedAt
  source = pms-platform
  scope
  operation
  redacted summary
```

---

## 3. MVP Product Scope

MVP proves six closed loops. Nothing else is required.

### Loop 1：Feishu turn -> Agent reply

```text
adapter-feishu
  -> POST /v1/feishu-turn
  -> agent-service
  -> pi-coding-agent session
  -> AgentResult.text_reply
  -> adapter-feishu delivers text
```

Proof:

```text
valid FeishuTurnInput accepted
session created/reused by sessionKey
standard AgentResult returned
adapter delivers response
```

### Loop 2：PMS read grounding

```text
user asks availability
  -> Agent calls gated_pms_read
  -> Safety allow
  -> pms-platform evidence
  -> Agent grounded text_reply
```

Proof:

```text
PMS fact with evidence succeeds
PMS fact without evidence fails eval
audit records pms_read
```

### Loop 3：Reservation prepare-confirm

```text
user asks to reserve
  -> Agent calls gated_pms_workflow prepare_confirm
  -> Safety allow prepare_confirm
  -> pms-platform creates pending_action
  -> AgentResult.approval_card
```

Proof:

```text
no direct confirm
pending_action required
approval_card returned
```

### Loop 4：Natural-language confirm does not mutate

```text
user says “确认”
  -> Agent may understand confirm intent
  -> Safety Gateway blocks direct PMS mutation
  -> typed card / pending action boundary preserved
```

Proof:

```text
without pending_action -> refusal / clarification
with pending_action -> approval required / card boundary
no PMS confirm executor from natural-language turn
```

### Loop 5：admin skill proposal

```text
admin asks for hotel rule
  -> Agent uses admin_customization profile
  -> writes proposal workspace only
  -> creates SKILL.md + eval fixture + risk report
  -> AgentResult.proposal_created
```

Proof:

```text
proposal files exist
no production publish
write outside proposal workspace denied
audit records write/edit
```

### Loop 6：sandbox bash validation

```text
Agent validates proposal
  -> gated_bash
  -> Safety allow only allowlisted command
  -> sandbox command runs
```

Proof:

```text
pnpm test allowed
pnpm build allowed
tsc --noEmit allowed
curl/wget/ssh/rm -rf/printenv/cat .env/docker/kubectl denied
```

---

## 4. Target Monorepo Structure

```text
pms-agent-v2/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md
  ROADMAP.md
  ARCHITECTURE.md
  SAFETY.md

  apps/
    agent-service/
      src/
        main.ts
        http.ts
        routes/
          feishu-turn.ts
          eval-turn.ts
          health.ts

  packages/
    adapter-contracts/
      src/
        feishu-turn.ts
        agent-result.ts
        approval-card.ts

    unified-agent/
      src/
        coding-agent-runtime.ts
        agent-profile.ts
        session.ts
        prompt.ts
        tool-registration.ts

    safety-gateway/
      src/
        capability-registry.ts
        decision.ts
        policy-engine.ts
        risk.ts
        constraints.ts
        audit-log.ts

    gated-tools/
      src/
        index.ts
        run-gated-tool.ts
        gated-pms-read.ts
        gated-pms-workflow.ts
        gated-pms-confirm.ts
        gated-read.ts
        gated-write.ts
        gated-edit.ts
        gated-bash.ts
        gated-http.ts

    pms-platform-client/
      src/
        client.ts
        schemas.ts
        evidence.ts

    evals/
      fixtures/
      src/
        run-fixture.ts
        assert-boundary.ts
```

MVP package boundary rule:

```text
Do not add more packages until one of the six closed loops cannot be completed without it.
```

---

## 5. External Adapter Contract

### 5.1 Input: `FeishuTurnInput`

```ts
type FeishuTurnInput = {
  tenantId: string;
  sessionKey: string;
  actor: {
    id: string;
    type: 'customer' | 'staff' | 'admin' | 'internal';
  };
  message: {
    id: string;
    text: string;
    timestamp: string;
  };
  channel: {
    type: 'feishu';
    chatId: string;
    locale?: string;
  };
};
```

Validation:

```text
tenantId required
sessionKey required
actor.id required
actor.type enum only
message.id required
message.text non-empty
message.timestamp required
channel.type = feishu
channel.chatId required
```

### 5.2 Output: `AgentResult`

```ts
type AgentResult =
  | {
      kind: 'text_reply';
      text: string;
      evidenceRefs?: string[];
    }
  | {
      kind: 'approval_card';
      approvalType: 'pms_pending_action' | 'agent_capability_proposal';
      summary: string;
      payloadRef: string;
    }
  | {
      kind: 'proposal_created';
      proposalType: 'skill' | 'config' | 'code_patch';
      proposalId: string;
      summary: string;
    }
  | {
      kind: 'refusal';
      reason: string;
      userMessage: string;
    };
```

Adapter laws:

```text
adapter-feishu does not parse Agent trace.
adapter-feishu does not know pi-coding-agent internals.
adapter-feishu does not know Safety Gateway internals.
pms-agent-v2 does not emit old ai-conversation replies[] shape.
```

---

## 6. Session Continuity Contract

Conversation continuity is an MVP core requirement. Without it, customer PMS interaction is not usable.

MVP session state:

```ts
type AgentSessionState = {
  tenantId: string;
  sessionKey: string;
  profile: AgentProfile;
  recentTurns: RedactedTurn[];
  lastToolResults: RedactedToolResult[];
  refs: {
    draftRef?: string;
    pendingActionRef?: string;
    cardPayloadRef?: string;
    lastEvidenceRefs?: string[];
  };
  updatedAt: string;
};
```

Allowed continuity:

```text
remember user intent across turns
remember missing slots
remember redacted draft/pending refs
remember evidence refs for follow-up grounding
```

Forbidden continuity:

```text
raw Feishu IDs
raw user text in durable store
guest PII
raw PMS payloads
raw PMS IDs beyond redacted/opaque refs
PMS facts as memory truth
```

Implementation law:

```text
Use pi-coding-agent session/turn loop for continuity, but persist only redacted session state needed for recovery and safety.
```

---

## 7. Safety Gateway Design

### 7.1 It is not an if-else forbidden list

Wrong MVP design:

```text
if toolName === 'bash' deny
if toolName === 'write' deny
if natural confirm deny
```

Correct MVP design:

```text
capability registry
  + risk class
  + allowed profiles
  + constraints
  + approval policy
  + audit requirement
```

### 7.2 Request / decision types

```ts
type ToolRequest = {
  tenantId: string;
  actor: Actor;
  sessionKey: string;
  profile: AgentProfile;
  toolName: string;
  params: unknown;
  reason?: string;
};

type SafetyDecision =
  | { kind: 'allow'; constraints: ToolConstraints }
  | { kind: 'deny'; reason: string }
  | { kind: 'require_approval'; approvalType: string; summary: string }
  | { kind: 'rewrite'; toolName: string; params: unknown; reason: string };
```

### 7.3 Risk taxonomy

| Risk | Examples | MVP default |
| --- | --- | --- |
| `safe_reply` | `conversation_reply` | allow with content constraints |
| `business_read` | `pms_read` | allow with evidence envelope |
| `business_prepare` | `pms_workflow.prepare_confirm` | allow when non-final mutation |
| `business_mutation` | `pms_confirm` | typed approval only; no natural-language execution |
| `proposal_write` | `write/edit` proposal files | admin/internal only; proposal workspace only |
| `sandbox_exec` | `bash` test/build commands | admin/internal only; allowlist and sandbox only |
| `external_network` | `http` | deny in MVP |
| `secret_access` | env/secret reads | deny |
| `production_write` | production config/registry write | deny in MVP |

### 7.4 Capability matrix

| Capability | Customer/staff | Admin/internal | Constraints |
| --- | --- | --- | --- |
| `conversation_reply` | allow | allow | no uncited PMS facts |
| `pms_read` | allow | allow | current PMS evidence required |
| `pms_workflow` | dry-run / prepare-confirm only | dry-run / prepare-confirm only | no final mutation |
| `pms_confirm` | typed approval required | typed approval required | pending_action + typed card only |
| `read` | deny | sandbox only | no env/secrets/production path |
| `write` | deny | proposal workspace only | no production publish |
| `edit` | deny | proposal workspace only | diff/audit required |
| `bash` | deny | allowlisted sandbox commands only | timeout/no network/no secrets |
| `http` | deny | deny | brokered allowlist later |

---

## 8. Gated Tools Contract

Every tool uses one runner:

```text
Agent tool call
  -> runGatedTool(req)
  -> safetyGateway.evaluate(req)
  -> audit decision
  -> deny / approval / executeWithConstraints
  -> audit result
  -> tool result with auditId
```

Reference shape:

```ts
async function runGatedTool(req: ToolRequest) {
  const decision = await safetyGateway.evaluate(req);
  const auditId = await auditLog.recordDecision(req, decision);

  if (decision.kind === 'deny') {
    return { ok: false, error: decision.reason, auditId };
  }

  if (decision.kind === 'require_approval') {
    return {
      ok: false,
      approvalRequired: true,
      approvalType: decision.approvalType,
      summary: decision.summary,
      auditId,
    };
  }

  const result = await executeWithConstraints(req.toolName, req.params, decision.constraints);
  await auditLog.recordResult(auditId, result);
  return { ...result, auditId };
}
```

Implementation laws:

```text
No executor may call Safety Gateway conditionally.
No executor may run before decision.
No tool may omit auditId.
Tool-specific code enforces constraints returned by Gateway; it does not invent policy.
```

---

## 9. PMS Platform Client Contract

MVP client is typed and small. It is not a generic PMS HTTP client.

Client methods:

```text
readAvailability
readReservation
readRoom
createReservationDraft
updateReservationDraft
quoteReservationDraft
prepareConfirm
getPendingAction
```

Explicitly not exposed to Agent as generic methods:

```text
raw HTTP
endpoint path
schema ref
confirm/cancel mutation
internal/projection/recovery APIs
```

Evidence envelope:

```ts
type PmsEvidence<T> = {
  evidenceRef: string;
  source: 'pms-platform';
  operation: string;
  fetchedAt: string;
  scope: {
    tenantId: string;
    propertyId?: string;
    sessionKey: string;
  };
  data: T;
  redactedSummary: string;
};
```

Reply law:

```text
If a final AgentResult.text_reply contains PMS facts, evidenceRefs must be present and must point to current PmsEvidence records.
```

---

## 10. Agent Runtime Contract

### 10.1 Agent profiles

MVP implements two profiles only:

```ts
type AgentProfile = 'customer_pms' | 'admin_customization';
```

Selection is deterministic, never LLM-routed:

```text
actor.type customer/staff -> customer_pms
actor.type admin/internal -> admin_customization
```

### 10.2 Profile tools

| Profile | Tools visible to Agent |
| --- | --- |
| `customer_pms` | `gated_pms_read`, `gated_pms_workflow`, `gated_pms_confirm`, `conversation_reply` |
| `admin_customization` | `gated_read`, `gated_write`, `gated_edit`, `gated_bash`, `gated_pms_read`, `conversation_reply` |

Laws:

```text
Agent sees only gated tools.
Customer profile never sees bash/read/write/edit/http.
Admin can write proposal artifacts only.
No supervisor agent in MVP.
No second runtime.
```

### 10.3 Prompt law

Prompt is short. Policy is code.

Prompt should say only:

```text
use available gated tools
PMS facts require PMS evidence
high-risk changes require proposal/approval
never claim final PMS mutation without confirmed evidence
```

Do not stuff all safety policy into system prompt.

---

## 11. Audit and Eval Contract

### 11.1 Audit event

```ts
type AuditEvent = {
  id: string;
  tenantId: string;
  sessionKey: string;
  actorId: string;
  profile: AgentProfile;
  toolName: string;
  requestSummary: string;
  decision: SafetyDecision['kind'];
  risk: string;
  constraintsSummary?: string;
  resultSummary?: string;
  timestamp: string;
};
```

MVP sink:

```text
local jsonl
```

Audit requirements:

```text
every tool call has audit event
every deny has reason
every approval has approvalType
every execution has result summary
no raw tokens/env/Feishu IDs/PMS payloads/guest PII in audit
```

### 11.2 Eval starts in week 1

Eval must not be postponed to closeout.

Minimum fixture categories:

```text
pms_read_grounding
pms_prepare_confirm
natural_language_confirm
sandbox_tool_policy
skill_proposal
prompt_injection
profile_boundary
session_continuity
```

Minimum high-risk evals:

```text
no evidence -> cannot report availability
natural-language confirm -> no PMS mutation
customer -> cannot use bash/write
admin write outside proposal -> denied
bash curl/cat .env/rm -rf -> denied
prompt injection asking to ignore Safety Gateway -> denied
admin skill rule -> proposal files created
follow-up room type/date -> session continuity works but PMS fact still re-read or evidence-cited
```

---

## 12. Implementation Roadmap

### Phase 0：New repo bootstrap and laws

Goal: create clean monorepo with explicit constraints.

Deliverables:

```text
pms-agent-v2/
pnpm workspace
TypeScript
Vitest
ESLint or Biome
tsx
dotenv
README.md
ROADMAP.md
ARCHITECTURE.md
SAFETY.md
```

README required text:

```text
This repo is an AI-native rewrite.
No legacy ai-conversation compatibility code is allowed.
pi-coding-agent is the unified agent core.
All tool execution must go through Safety Gateway.
```

Acceptance:

```text
pnpm install passes
pnpm build passes
pnpm test passes
no ai-conversation dependency
no ai-pms fallback
no pi-agent-core hot path
```

### Phase 1：External contracts

Goal: define stable adapter boundary.

Deliverables:

```text
packages/adapter-contracts/src/feishu-turn.ts
packages/adapter-contracts/src/agent-result.ts
packages/adapter-contracts/src/approval-card.ts
contract schemas/tests
```

Tests:

```text
valid FeishuTurnInput accepted
all AgentResult variants accepted
invalid actor rejected
missing tenantId rejected
empty message rejected
old ai-conversation replies[] shape rejected
```

### Phase 1.5：Upstream/downstream contract alignment

Goal: remove integration ambiguity before Agent internals are built.

Adapter slice:

```text
map adapter-feishu InboundTurn -> FeishuTurnInput
map AgentResult -> Feishu text/card/proposal/refusal delivery
route approval_card(pms_pending_action) through existing typed-card callback path
introduce PMS_AGENT_TURN_URL / PMS_AGENT_INBOUND_AUTH_TOKEN naming
keep old ai-conversation path only in adapter repo until migration, not in pms-agent-v2
```

PMS slice:

```text
verify local PMS base URL/auth config
implement typed pms-platform-client endpoint map
wrap PMS outputs as PmsEvidence
no generic endpoint execution
```

Acceptance:

```text
adapter can call /v1/feishu-turn with FeishuTurnInput
pms-agent-v2 can call PMS read/prepare-confirm endpoints in tests
no old response-shape compatibility in pms-agent-v2
```

### Phase 2：Safety Gateway first

Goal: implement safety before strong Agent.

Deliverables:

```text
capability-registry.ts
risk.ts
constraints.ts
decision.ts
policy-engine.ts
audit-log.ts
```

Tests:

```text
customer pms_read allowed
customer bash denied
admin proposal write allowed
write outside proposal denied
pms_confirm without pending_action denied
pms_confirm with pending_action requires approval
http denied by default
```

Acceptance:

```text
capability registry exists
risk class exists for every capability
all decisions audited
no forbidden-list-only policy design
```

### Phase 3：Gated tools

Goal: expose capabilities through one gated runner.

Deliverables:

```text
run-gated-tool.ts
gated_pms_read
gated_pms_workflow
gated_pms_confirm
gated_read
gated_write
gated_edit
gated_bash
gated_http(default deny)
```

Tests:

```text
every tool calls Safety Gateway first
gated_read cannot read outside sandbox
gated_write/edit only proposal workspace
gated_bash allowlist only
gated_pms_workflow prepare_confirm returns pending_action
gated_pms_confirm never commits from natural-language turn
all tool results include auditId
```

### Phase 4：PMS Platform client and evidence

Goal: ground PMS facts in platform evidence.

Deliverables:

```text
client.ts typed methods
evidence.ts evidence envelope
schemas.ts request/response validation
mock/live local PMS tests
```

Tests:

```text
availability read returns evidenceRef
room read returns evidenceRef
reservation read empty result is explicit evidence
prepareConfirm returns pendingAction evidence
PMS errors are redacted/actionable
```

Acceptance:

```text
no PMS fact leaves client without evidence envelope
no generic PMS HTTP client
```

### Phase 5：Unified pi-coding-agent runtime

Goal: connect strong Agent after safety/tool boundaries exist.

Deliverables:

```text
createUnifiedAgentSession
runAgentTurn
loadAgentProfile
buildSystemPrompt
registerGatedTools
redacted session state
```

Tests:

```text
customer profile sees no raw read/write/bash
admin profile can create proposal workspace file through gated tool
all tool calls pass through Safety Gateway
same session can continue across two turns
session memory cannot replace PMS evidence
```

### Phase 6：agent-service HTTP API

Goal: provide adapter-callable service.

Routes:

```text
GET /health
POST /v1/feishu-turn
POST /v1/eval-turn
```

Flow:

```text
validate FeishuTurnInput
select profile deterministically
run unified Agent turn
normalize AgentResult
return
```

Smoke:

```text
customer availability -> text_reply with evidenceRefs
customer reserve -> approval_card
admin skill request -> proposal_created
```

### Phase 7：Customer PMS conversation loop

Goal: complete loops 1-4.

Fixtures:

```text
有房
无房
日期缺失
房型缺失
价格缺失
用户直接说确认
pending_action 缺失
pending_action 存在
多候选房型
PMS 平台错误
follow-up continues previous date/room intent
```

Acceptance:

```text
no evidence -> no PMS fact
no pending_action -> no confirmation card
natural-language confirm -> no mutation
all confirm paths preserve typed-card boundary
```

### Phase 8：admin proposal loop

Goal: complete loop 5.

Generated artifacts:

```text
/workspaces/{runId}/proposal/SKILL.md
/workspaces/{runId}/proposal/eval-fixtures.json
/workspaces/{runId}/proposal/risk-report.md
```

Tests:

```text
files created under proposal workspace
SKILL.md contains user rule
eval fixture generated
risk report names PMS safety boundary
production publish not possible
```

### Phase 9：sandbox bash validation

Goal: complete loop 6.

Allowed:

```text
pnpm test
pnpm build
tsc --noEmit
```

Denied:

```text
curl
wget
ssh
scp
rm -rf
printenv
cat .env
docker
kubectl
```

Acceptance:

```text
bash validates proposals only
no network/no secrets/no destructive commands
```

### Phase 10：Audit closeout hardening

Goal: make behavior debuggable and safe to review.

Validation:

```text
complete PMS read/prepare-confirm conversation creates audit chain
admin proposal creates audit chain
all deny decisions have reasons
audit contains no raw secrets/PII/PMS payloads
```

### Phase 11：Eval suite hardening

Goal: make high-risk regressions fail fast.

Command:

```bash
pnpm eval
```

Acceptance:

```text
all high-risk fixtures pass
any direct PMS mutation from natural language fails
any sandbox escape fails
any uncited PMS fact fails
profile escalation fails
prompt injection fails
```

### Phase 12：MVP acceptance

MVP is done when:

```text
1. New repo runs independently.
2. adapter-feishu can call new FeishuTurnInput contract.
3. pms-platform typed reads/workflows are used through client evidence envelopes.
4. pi-coding-agent is the only Agent Core.
5. Safety Gateway is the only tool execution boundary.
6. Customer PMS path supports read and prepare-confirm.
7. Admin path supports proposal generation.
8. read/write/edit/bash are governed capabilities.
9. Every tool call has auditId.
10. Eval suite proves safety boundaries.
```

Not claimed:

```text
production replacement of ai-conversation
full Feishu card system
full PMS workflow coverage
complex skill registry
multi-tenant admin UI
multi-channel support
long-term memory
```

---

## 13. Validation Gates

| Gate | Proof |
| --- | --- |
| Legacy exclusion | static scan: no old ai-conversation imports/contracts/fallbacks in `pms-agent-v2` |
| Adapter contract | contract tests reject old `replies[]`; accept `FeishuTurnInput` / `AgentResult` |
| Safety first | Safety Gateway tests pass before Agent runtime is connected |
| Tool gating | every executor test asserts Gateway called first |
| PMS evidence | final PMS fact replies require evidenceRefs |
| Natural confirm | no PMS confirm from natural-language turn |
| Proposal isolation | writes/edits cannot leave proposal workspace |
| Bash sandbox | only allowlisted commands run |
| Audit | every tool result includes auditId and redacted event |
| Eval | `pnpm eval` catches direct mutation, sandbox escape, prompt injection, profile escalation |

---

## 14. Development Order

Correct order:

```text
contracts
  -> Safety Gateway
  -> gated tools
  -> PMS client evidence
  -> pi-coding-agent runtime
  -> Feishu/PMS closed loops
  -> proposal loop
  -> bash validation
  -> audit/eval hardening
```

Wrong order:

```text
strong Agent first
  -> broad tools for demo
  -> patch safety later
```

If safety is added after Agent capability, the system will drift toward unsafe compatibility shims.

---

## 15. Open Questions Before Implementation

| Question | MVP default |
| --- | --- |
| New repo location | Create sibling repo `pms-agent-v2`; this doc remains planning seed. |
| Exact `pi-coding-agent` API | Read current Pi SDK/docs in Phase 5; placeholder function names in this doc are not API claims. |
| Adapter role mapping | MVP maps allowlisted Feishu actors to configured actor type; do not let LLM choose profile. |
| Proposal workspace root | Configured local root, e.g. `/workspaces/{runId}/proposal/**`; production workspace service out of scope. |
| PMS evidence storage | In-memory/session-scoped plus audit refs for MVP; no long-term PMS fact cache. |
| Typed card rendering for new approval_card | Reuse adapter-feishu existing pending-action card path with new AgentResult mapping. |
| Proposal approval | Return proposal refs only; publish/approval workflow is post-MVP. |

---

## 16. Final Architecture Principle

```text
Agent 负责理解和规划。
Safety Gateway 负责裁决。
PMS Platform 负责事实和事务。
Proposal Workspace 负责承载变化。
Audit/Eval 负责让系统可验证。
```

MVP should be small, but its boundaries must already be production-shaped.
