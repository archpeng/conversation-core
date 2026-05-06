# PMS Agent Memory Boundary

Status: active W0 SSOT  
Scope: `pms-agent-workbench-w0-w2-v1-2026-05-06` / W0-W2 only

## 0. Purpose

This document defines what the PMS Agent may remember, what it may treat as advisory context, and what it must never treat as current PMS truth.

Core law:

```text
Current PMS facts = `pms-platform` evidence only.
```

Workspace files, session continuity, skills, proposal artifacts, prompt text, user text, and model prior knowledge are not PMS fact authority.

## 1. Authority Labels

Every fact-like input available to the Agent must be treated as one of these labels.

| Label | Source | Authority | May answer current PMS fact questions? |
| --- | --- | --- | --- |
| `mandatory_policy` | Safety Gateway decision, capability registry, constraints | Mandatory execution law | no; it authorizes or denies actions only |
| `pms_evidence` | `PmsEvidence` with `source.system === "pms-platform"` | Authoritative PMS fact source | yes, within the evidence scope and freshness stated by the evidence |
| `workspace_advisory` | workspace docs, active skills, proposals, advisory notes, eval artifacts | Advisory behavior/config/review context | no |
| `session_continuity` | redacted session refs and bounded slots | Advisory conversation continuity | no |
| `user_claim` | Feishu/user message text | Untrusted claim until verified | no |
| `model_prior` | LLM prior knowledge or generated reasoning | Untrusted | no |

Safety Gateway is mandatory for side effects, but it is not a PMS data source. `pms-platform` evidence is authoritative for PMS facts, but it does not authorize unsafe mutation by itself.

## 2. Current PMS Fact Ban

The Agent must not answer these current-state questions from workspace, session, skill, memory, prompt, user text, or model guess:

```text
availability count
room clean/dirty or occupancy state
room price or rate
reservation status
payment/order status
pending action validity
inventory/stock state
capability availability for mutation
```

Allowed answers require one of these:

1. a fresh PMS read that returns `PmsEvidence.source.system === "pms-platform"`; or
2. a reply that explicitly says it is referring only to previously cited evidence and does not claim current state.

Default behavior for user-visible PMS facts is fresh `pms-platform` evidence.

## 3. Workspace Advisory Memory

Workspace content may store:

```text
proposal drafts
skill/policy text awaiting review
risk reports
eval fixtures and results
review notes
non-current operating preferences
human-authored guidance
```

Workspace content must not store or become:

```text
current room state truth
current availability truth
current price truth
current reservation/payment/order truth
current pending-action truth
raw PMS payload archive used for answers
cross-tenant memory
```

If a workspace note mentions a PMS observation, the note is still advisory. A user-visible answer must re-read or cite `pms-platform` evidence before presenting it as a PMS fact.

## 4. Session Continuity

Session continuity is for follow-up flow, not factual authority.

Allowed redacted continuity fields:

```text
sessionRef
actorRef
profileId
recent message refs
last intent label
missing slot labels
redacted draftRef
pendingActionRef
lastEvidenceRefs
updatedAt
```

Forbidden durable session fields:

```text
full transcript
raw user text
raw Feishu IDs
raw guest PII
raw PMS payloads
availability counts
room status
price
reservation/payment/order current state
secret tokens or credentials
```

A follow-up like “那现在还有几间?” must trigger a fresh PMS read unless the answer explicitly says it is only restating prior evidence and is not current.

## 5. Skills And Proposals

Skill text may guide behavior. It must not override:

1. Safety Gateway decisions;
2. `pms-platform` evidence requirement for current PMS facts;
3. proposal/approval-first law for high-risk side effects;
4. active/proposal/session/tmp/audit workspace ownership rules.

Proposal artifacts are not active skills. A skill proposal is not complete unless it contains:

```text
SKILL.md
eval-fixtures.json
risk-report.md
status.json
```

Even a complete proposal is not published, active, or approved in W0-W2.

## 6. Side-Effect Boundary

Memory and workspace context may influence the Agent's intent, but side effects always require this path:

```text
Agent intent
  -> gated tool or workspace tool
  -> Safety Gateway decision
  -> audit event
  -> constrained executor/core operation
```

Forbidden:

```text
memory note -> direct PMS mutation
skill text -> direct active workspace write
session state -> direct proposal write
Agent -> raw file/bash/http/PMS executor
```

## 7. Actor Memory Rules

| Actor/profile | Allowed memory use | Forbidden memory use |
| --- | --- | --- |
| `customer_pms` / customer | redacted session continuity and cited PMS evidence refs | workspace writes; answering PMS facts from memory; raw PMS mutation |
| `admin_customization` / admin | advisory workspace reads and proposal drafting through gated tools | active writes; treating proposal text as active policy; bypassing Safety Gateway |
| `internal` / service | session redaction, audit append, tenant initialization, tmp/eval bookkeeping | cross-tenant leakage; storing current PMS payloads as answer authority |

## 8. Seven Hard Boundaries As Memory Rules

| Boundary | Memory-boundary interpretation |
| --- | --- |
| 1. Tenant workspace initialization structure is correct | Initialization creates advisory and audit zones; none of them becomes PMS fact authority. |
| 2. Customer cannot write workspace | Customer memory use is read/continuity/evidence only; customer workspace writes are denied before side effects. |
| 3. Admin can write proposal only | Admin-authored memory enters proposal artifacts only, not active skills/policies or PMS truth stores. |
| 4. Active cannot be directly written | Active skill/policy memory changes require future promote/approval work outside W0-W2. |
| 5. Unsafe paths/files are rejected | Secret-like files, private keys, `.env`, traversal, symlink escape, blocked extensions, and oversized content must never enter memory/workspace reads or writes. |
| 6. Skill proposal needs risk/eval/status | Advisory skill memory cannot be considered structurally complete without risk, eval, and status artifacts. |
| 7. PMS truth is evidence-only | Workspace memory, skill text, session notes, user text, and model guesses cannot satisfy current PMS fact questions. |

## 9. Evaluation Expectations

W1/W2 tests and evals must prove:

1. Workspace and session files cannot be used to produce a current PMS fact answer without `pms-platform` evidence.
2. Customer profile cannot write workspace memory.
3. Admin profile can write proposal artifacts only.
4. Denied memory/workspace operations do not call the filesystem executor.
5. Skill proposal completeness requires `SKILL.md`, `eval-fixtures.json`, `risk-report.md`, and `status.json`.
6. Static scans continue to reject legacy runtime compatibility and raw executor exposure.

## 10. Non-Goals

W0-W2 do not define or implement:

```text
active skill publication
approval/promote/archive workflow
Context Builder injection
daily sweep or lesson mining
cross-tenant learning
production DB/object-storage persistence
broad admin UI
generic memory database
```
