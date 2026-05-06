# PMS Agent Workspace Contract

Status: active W0 SSOT  
Scope: `pms-agent-workbench-w0-w2-v1-2026-05-06` / W0-W2 only

## 0. Purpose

The PMS Agent workspace is a tenant-scoped workbench for advisory artifacts: proposal drafts, review evidence, bounded session continuity, audit records, and future active skill/policy files.

It is **not** PMS truth, not a generic memory database, and not a raw filesystem exposed to the Agent.

Non-negotiable law:

```text
Agent intent
  -> workspace tool adapter
  -> Safety Gateway decision + audit
  -> workspace-core path/schema guard
  -> constrained filesystem operation
```

Forbidden shortcut:

```text
Agent -> raw read/write/edit/bash/http/PMS executor
Agent -> workspace file write without Safety Gateway
workspace file -> current PMS fact authority
```

Current PMS facts still come only from `pms-platform` evidence. Workspace files may advise the Agent, but they must never answer current availability, price, room state, reservation status, payment/order state, pending-action validity, or inventory questions.

## 1. Logical Tenant Root

W1 must implement a logical root, not expose caller-supplied filesystem paths:

```text
/workspaces/{tenantId}/
```

`tenantId`, `proposalId`, `sessionId`, and `runId` are identifiers, not paths. W1 must accept only bounded identifier characters:

```text
[A-Za-z0-9_-]{1,64}
```

The local filesystem root is a service configuration value. `workspace-core` maps the logical tenant root under that configured root after validating tenant scope and path constraints.

## 2. Directory Zones

The initialized tenant workspace structure is:

```text
/workspaces/{tenantId}/
  README.md
  PROFILE.md
  active/
    skills/
    policies/
  proposals/
    {proposalId}/
      manifest.json
      SKILL.md
      eval-fixtures.json
      risk-report.md
      status.json
      notes/
  sessions/
    {sessionId}/
      continuity.json
  memory/
    advisory-notes/
  evals/
    {runId}/
  audit/
    workspace-events.jsonl
  tmp/
    {runId}/
```

Zone ownership:

| Zone | Purpose | Reads | Writes in W0-W2 | Direct Agent writes |
| --- | --- | --- | --- | --- |
| `README.md`, `PROFILE.md` | Tenant workspace metadata and human orientation | admin/internal; customer only if explicitly surfaced by product code | initialization only | no |
| `active/skills/` | Approved active skill files for future use | admin/internal; W2 may list names only | none in W0-W2 | no |
| `active/policies/` | Approved active policy/config references | admin/internal | none in W0-W2 | no |
| `proposals/{proposalId}/` | Draft artifacts awaiting review | admin/internal | admin proposal tools only after Safety Gateway allow | proposal-only |
| `sessions/{sessionId}/` | Redacted continuity refs, not transcript memory | service/internal; bounded Agent context only in existing runtime | service/session manager only | no |
| `memory/advisory-notes/` | Future advisory notes, never PMS fact truth | admin/internal | none in W0-W2 | no |
| `evals/{runId}/` | Evaluation inputs/results for proposed workspace changes | admin/internal | tool/service managed | no direct raw write |
| `audit/workspace-events.jsonl` | Append-only allow/deny/write evidence | internal/review | Safety Gateway/tool service append only | no |
| `tmp/{runId}/` | Bounded scratch for validation | internal/tool layer | tool/service managed with TTL | no direct raw write |

## 3. File Kinds

Allowed W0-W2 content kinds:

| Kind | Extensions | Zone | Notes |
| --- | --- | --- | --- |
| Markdown document | `.md` | proposals, active skill docs, notes | UTF-8 text only |
| JSON artifact | `.json` | proposals, sessions, evals, profile | schema-validated where applicable |
| JSONL audit | `.jsonl` | audit only | append-only, service/tool owned |

Default maximum file size for W1/W2 tests: `256 KiB` per read/write unless the caller explicitly uses a smaller operation limit.

Blocked names, segments, and extensions include:

```text
.env
.env.*
.ssh
id_rsa
id_dsa
id_ecdsa
id_ed25519
private-key
secret
token
credential
production
root
*.pem
*.key
*.p12
*.pfx
*.crt
```

W1 may add more blocked patterns, but must not remove these minimum denials.

## 4. Path Resolution Contract

Every workspace operation must be denied before filesystem access when any of these are true:

1. Tenant scope is missing or the logical path tenant differs from the request tenant.
2. The path is an absolute local filesystem path instead of a logical `/workspaces/{tenantId}/...` path.
3. The normalized path escapes the tenant root through `..`, encoded traversal, repeated separators with empty segments, or separator ambiguity.
4. The path targets a blocked segment, blocked extension, hidden secret file, private-key-like file, or `.env` file.
5. The path crosses or resolves through a symlink outside the tenant root.
6. The operation would read or write a file over the allowed size limit.
7. The operation targets a zone not allowed for the requested operation.

W1 must use filesystem checks for existing paths so symlink escape is tested against the real resolved path, not only string normalization.

## 5. Actor / Operation Matrix

W0-W2 profile rules:

| Actor/profile | Read active | Read proposal | Write proposal | Write active | Write session | Write audit/tmp |
| --- | --- | --- | --- | --- | --- | --- |
| `customer_pms` / customer | no direct workspace tool in W0-W2 | no | no | no | no | no |
| `admin_customization` / admin | yes, through gated read/list only | yes | yes, proposal zone only | no | no | no |
| `internal` / service | yes | yes | service/tool managed | initialization or future promote only, out of W0-W2 | yes, redacted only | append/tool managed |

Rules:

1. Customer actors cannot write workspace content.
2. Admin actors can write proposal content only.
3. Active areas cannot be directly written by Agent workspace tools.
4. Audit writes are tool/service append events, not Agent-authored content.
5. Session continuity writes are owned by runtime/session code, not workspace proposal tools.

## 6. Proposal Structure And Completeness

A skill proposal lives under:

```text
/workspaces/{tenantId}/proposals/{proposalId}/
```

Minimum skill-proposal files:

```text
SKILL.md
  proposed skill text; proposal-only, not active

eval-fixtures.json
  examples proving intended behavior and safety expectations

risk-report.md
  explicit risk assessment and no-production-mutation statement

status.json
  structured proposal status, reviewer state, and completeness metadata
```

A skill proposal is structurally complete only when all four files exist, validate as their file kind, and `status.json` states a non-active proposal state such as `draft`, `ready_for_review`, or `rejected`.

Completeness is not approval. W0-W2 do not publish skills, promote files into `active/`, or define approval-card UX. Future approval/promote work must be a separate reviewed slice.

## 7. Lifecycle

W0-W2 lifecycle:

```text
initialize tenant workspace
  -> admin drafts proposal artifacts through gated workspace tools
  -> workspace-core validates path/schema/completeness
  -> workspace-tools records allow/deny/write audit evidence
  -> review decides whether the proposal is acceptable
```

Out of scope for W0-W2:

```text
active promotion or publication
approval-card UX for workspace approval
Context Builder prompt injection
long-term lesson mining
cross-tenant learning
generic memory database
production DB/object-storage backend
broad tenant admin UI
```

## 8. W1 Package Expectations

`packages/workspace-core` owns only path/schema/store primitives:

1. `createTenantWorkspace(root, tenantId)` creates the directory skeleton in section 2.
2. `resolveTenantPath(scope, logicalPath, operation)` validates tenant scope, zone, file kind, traversal, blocked files, symlinks, and size before returning a local path.
3. `readWorkspaceFile(...)` reads allowed file kinds with size enforcement.
4. `writeProposalFile(...)` writes proposal-zone files only.
5. `validateSkillProposalCompleteness(...)` checks `SKILL.md`, `eval-fixtures.json`, `risk-report.md`, and `status.json`.

`workspace-core` must not implement actor/profile policy, Safety Gateway calls, Agent prompt injection, approval/promote workflow, or PMS fact reads.

## 9. W2 Package Expectations

`packages/workspace-tools` owns Safety-gated tool adapters:

```text
workspace_read
workspace_write_proposal
workspace_edit_proposal
workspace_list_active_skills
workspace_create_skill_proposal
```

Each side-effecting adapter must:

1. build a typed request carrying tenantId, actor/profile, operation, target path/proposalId, reason, and risk metadata;
2. call Safety Gateway before calling `workspace-core`;
3. write an audit event for allow, deny, approval-required, and successful write/edit outcomes;
4. never call the executor/core write path after a deny or approval-required decision;
5. preserve the PMS truth boundary by returning workspace artifacts as advisory content only.

## 10. Seven W0-W2 Hard Boundaries

| Boundary | Contract statement |
| --- | --- |
| 1. Tenant workspace initialization structure is correct | W1 initializes exactly the zones in section 2 for a validated tenant ID. |
| 2. Customer cannot write workspace | `customer_pms` / customer has no workspace write capability and any attempted write is denied before filesystem access. |
| 3. Admin can write proposal only | `admin_customization` / admin writes are constrained to `/proposals/{proposalId}/...`. |
| 4. Active cannot be directly written | `active/skills/` and `active/policies/` are read/list-only in W0-W2; no Agent tool writes them. |
| 5. Unsafe paths/files are rejected | Traversal, symlink escape, `.env`, secret/private-key-like paths, blocked extensions, and oversized files are denied before read/write. |
| 6. Skill proposal needs risk/eval/status | A skill proposal is incomplete without `risk-report.md`, `eval-fixtures.json`, and `status.json` in addition to `SKILL.md`. |
| 7. PMS truth is evidence-only | Workspace memory, skill text, proposal files, session notes, and tmp/eval artifacts are advisory only; current PMS facts must be re-read/cited from `pms-platform` evidence. |
