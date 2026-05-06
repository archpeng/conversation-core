import { readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { runGatedTool, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import {
  readWorkspaceFile,
  validateSkillProposalCompleteness,
  WORKSPACE_IDENTIFIER_PATTERN,
  WorkspaceError,
  writeProposalFile,
  type ProposalCompletenessResult,
  type TenantScope,
  type WorkspaceReadResult,
  type WorkspaceWriteResult
} from "@pms-agent-v2/workspace-core";

export type WorkspaceToolName =
  | "workspace_read"
  | "workspace_write_proposal"
  | "workspace_edit_proposal"
  | "workspace_list_active_skills"
  | "workspace_create_skill_proposal";

export type WorkspaceArtifactAuthority = "workspace_advisory";

const ALLOWED_PROPOSAL_STATUS_STATES = new Set(["draft", "ready_for_review", "rejected"]);

export type WorkspaceToolActor = GatedToolRequest["actor"];

export type WorkspaceToolBaseInput = {
  gateway: SafetyGatewayPort;
  actor: WorkspaceToolActor;
  rootDir: string;
  tenantId: string;
  reason?: string;
  sourceEpisodeRefs?: readonly string[];
  maxBytes?: number;
  workspaceAudit?: WorkspaceAuditSink;
};

export type WorkspaceReadToolInput = WorkspaceToolBaseInput & {
  logicalPath: string;
};

export type WorkspaceWriteProposalToolInput = WorkspaceToolBaseInput & {
  logicalPath: string;
  content: string;
};

export type WorkspaceEditProposalToolInput = WorkspaceToolBaseInput & {
  logicalPath: string;
  oldText: string;
  newText: string;
};

export type WorkspaceListActiveSkillsToolInput = WorkspaceToolBaseInput;

export type WorkspaceCreateSkillProposalToolInput = WorkspaceToolBaseInput & {
  proposalId: string;
  skillMarkdown: string;
  evalFixturesJson: string;
  riskReportMarkdown: string;
  statusJson: string;
};

export type WorkspaceReadToolValue = {
  authority: WorkspaceArtifactAuthority;
  canAnswerCurrentPmsFact: false;
  file: WorkspaceReadResult;
};

export type WorkspaceWriteProposalToolValue = {
  authority: WorkspaceArtifactAuthority;
  canAnswerCurrentPmsFact: false;
  file: WorkspaceWriteResult;
};

export type WorkspaceEditProposalToolValue = WorkspaceWriteProposalToolValue & {
  replacements: 1;
};

export type WorkspaceListActiveSkillsToolValue = {
  authority: WorkspaceArtifactAuthority;
  canAnswerCurrentPmsFact: false;
  skills: readonly string[];
};

export type WorkspaceCreateSkillProposalToolValue = {
  authority: WorkspaceArtifactAuthority;
  canAnswerCurrentPmsFact: false;
  proposal: ProposalCompletenessResult;
  files: readonly WorkspaceWriteResult[];
};

export type WorkspaceAuditEvent = {
  id: string;
  at: string;
  toolName: WorkspaceToolName;
  outcome: "write" | "edit" | "create_skill_proposal";
  actorProfile: WorkspaceToolActor["profile"];
  targetKind: "redacted";
  reasonCode: "workspace_side_effect_committed";
};

export type WorkspaceAuditSink = {
  append(event: WorkspaceAuditEvent): void | Promise<void>;
};

export type WorkspaceAuditBuffer = WorkspaceAuditSink & {
  events(): readonly WorkspaceAuditEvent[];
};

export class WorkspaceToolError extends Error {
  constructor(readonly code: "invalid_input" | "edit_match_not_found" | "edit_match_ambiguous" | "symlink_escape", message: string) {
    super(message);
    this.name = "WorkspaceToolError";
  }
}

export function workspaceRead(input: WorkspaceReadToolInput): Promise<GatedToolResult<WorkspaceReadToolValue>> {
  return runGatedTool({
    gateway: input.gateway,
    request: workspaceRequest(input, "workspace_read", input.logicalPath, { operation: "read", riskLevel: "low" }),
    executor: async () => ({
      authority: "workspace_advisory",
      canAnswerCurrentPmsFact: false,
      file: await readWorkspaceFile(scopeFrom(input), input.logicalPath)
    })
  });
}

export function workspaceWriteProposal(input: WorkspaceWriteProposalToolInput): Promise<GatedToolResult<WorkspaceWriteProposalToolValue>> {
  return runGatedTool({
    gateway: input.gateway,
    request: workspaceRequest(input, "workspace_write_proposal", input.logicalPath, {
      operation: "write_proposal",
      content: input.content,
      riskLevel: "medium"
    }),
    executor: async () => {
      const file = await writeProposalFile(scopeFrom(input), input.logicalPath, input.content);
      await appendWorkspaceAudit(input, "workspace_write_proposal", "write");
      return { authority: "workspace_advisory", canAnswerCurrentPmsFact: false, file };
    }
  });
}

export function workspaceEditProposal(input: WorkspaceEditProposalToolInput): Promise<GatedToolResult<WorkspaceEditProposalToolValue>> {
  return runGatedTool({
    gateway: input.gateway,
    request: workspaceRequest(input, "workspace_edit_proposal", input.logicalPath, {
      operation: "edit_proposal",
      content: input.newText,
      riskLevel: "medium"
    }),
    executor: async () => {
      const scope = scopeFrom(input);
      const current = await readWorkspaceFile(scope, input.logicalPath);
      const first = current.content.indexOf(input.oldText);
      if (first < 0) throw new WorkspaceToolError("edit_match_not_found", "Workspace edit oldText was not found.");
      if (current.content.indexOf(input.oldText, first + input.oldText.length) >= 0) {
        throw new WorkspaceToolError("edit_match_ambiguous", "Workspace edit oldText must match exactly once.");
      }
      const file = await writeProposalFile(scope, input.logicalPath, current.content.replace(input.oldText, input.newText));
      await appendWorkspaceAudit(input, "workspace_edit_proposal", "edit");
      return { authority: "workspace_advisory", canAnswerCurrentPmsFact: false, file, replacements: 1 };
    }
  });
}

export function workspaceListActiveSkills(input: WorkspaceListActiveSkillsToolInput): Promise<GatedToolResult<WorkspaceListActiveSkillsToolValue>> {
  const target = `/workspaces/${input.tenantId}/active/skills/index.json`;
  return runGatedTool({
    gateway: input.gateway,
    request: workspaceRequest(input, "workspace_list_active_skills", target, { operation: "list_active_skills", riskLevel: "low" }),
    executor: async () => ({
      authority: "workspace_advisory",
      canAnswerCurrentPmsFact: false,
      skills: await listActiveSkillNames(input)
    })
  });
}

export async function workspaceCreateSkillProposal(
  input: WorkspaceCreateSkillProposalToolInput
): Promise<GatedToolResult<WorkspaceCreateSkillProposalToolValue>> {
  assertSkillProposalInput(input);
  const root = proposalRoot(input.tenantId, input.proposalId);
  return runGatedTool({
    gateway: input.gateway,
    request: workspaceRequest(input, "workspace_create_skill_proposal", `${root}/SKILL.md`, {
      operation: "create_skill_proposal",
      content: input.skillMarkdown,
      riskLevel: "medium"
    }),
    executor: async () => {
      const scope = scopeFrom(input);
      const files = [
        await writeProposalFile(scope, `${root}/SKILL.md`, input.skillMarkdown),
        await writeProposalFile(scope, `${root}/eval-fixtures.json`, input.evalFixturesJson),
        await writeProposalFile(scope, `${root}/risk-report.md`, input.riskReportMarkdown),
        await writeProposalFile(scope, `${root}/status.json`, input.statusJson)
      ];
      const proposal = await validateSkillProposalCompleteness(scope, input.proposalId);
      await appendWorkspaceAudit(input, "workspace_create_skill_proposal", "create_skill_proposal");
      return { authority: "workspace_advisory", canAnswerCurrentPmsFact: false, proposal, files };
    }
  });
}

export function canWorkspaceArtifactAnswerCurrentPmsFact(): false {
  return false;
}

export function createWorkspaceAuditBuffer(): WorkspaceAuditBuffer {
  const recorded: WorkspaceAuditEvent[] = [];
  return {
    append(event) {
      recorded.push(event);
    },
    events() {
      return recorded;
    }
  };
}

function workspaceRequest(
  input: WorkspaceToolBaseInput,
  capabilityId: WorkspaceToolName,
  target: string,
  options: { operation: string; content?: string; riskLevel: GatedToolRequest["riskLevel"] }
): GatedToolRequest {
  return {
    capabilityId,
    actor: input.actor,
    tenantId: input.tenantId,
    workspace: { kind: "tenant_workspace", path: target },
    target,
    content: options.content,
    operation: options.operation,
    reason: input.reason,
    sourceEpisodeRefs: input.sourceEpisodeRefs,
    riskLevel: options.riskLevel
  };
}

function scopeFrom(input: WorkspaceToolBaseInput): TenantScope {
  return { rootDir: input.rootDir, tenantId: input.tenantId, maxBytes: input.maxBytes };
}

async function listActiveSkillNames(input: WorkspaceListActiveSkillsToolInput): Promise<string[]> {
  assertIdentifier("tenantId", input.tenantId);
  const tenantRoot = path.resolve(input.rootDir, "workspaces", input.tenantId);
  const skillsDir = path.join(tenantRoot, "active", "skills");
  const [realTenantRoot, realSkillsDir] = await Promise.all([realpath(tenantRoot), realpath(skillsDir)]);
  assertInside(realSkillsDir, realTenantRoot);
  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json")))
    .map((entry) => entry.name)
    .sort();
}

function assertSkillProposalInput(input: WorkspaceCreateSkillProposalToolInput): void {
  assertIdentifier("proposalId", input.proposalId);
  if (!input.skillMarkdown.trim()) throw new WorkspaceToolError("invalid_input", "Skill proposal requires SKILL.md content.");
  if (!input.riskReportMarkdown.trim()) throw new WorkspaceToolError("invalid_input", "Skill proposal requires risk-report.md content.");
  assertJson("eval-fixtures.json", input.evalFixturesJson);
  assertAllowedStatusState(input.statusJson);
}

function assertAllowedStatusState(value: string): void {
  let parsed: { state?: unknown; status?: unknown };
  try {
    parsed = JSON.parse(value) as { state?: unknown; status?: unknown };
  } catch {
    throw new WorkspaceToolError("invalid_input", "status.json must be valid JSON.");
  }
  const state = typeof parsed.state === "string" ? parsed.state : parsed.status;
  if (typeof state !== "string" || !ALLOWED_PROPOSAL_STATUS_STATES.has(state)) {
    throw new WorkspaceToolError("invalid_input", "status.json must use a non-active proposal state.");
  }
}

function assertJson(label: string, value: string): void {
  try {
    JSON.parse(value);
  } catch {
    throw new WorkspaceToolError("invalid_input", `${label} must be valid JSON.`);
  }
}

function proposalRoot(tenantId: string, proposalId: string): string {
  return `/workspaces/${tenantId}/proposals/${proposalId}`;
}

function assertIdentifier(label: string, value: string): void {
  if (!WORKSPACE_IDENTIFIER_PATTERN.test(value)) throw new WorkspaceError("invalid_identifier", `${label} must match ${WORKSPACE_IDENTIFIER_PATTERN.source}.`);
}

function assertInside(realTarget: string, realRoot: string): void {
  const relative = path.relative(realRoot, realTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  throw new WorkspaceToolError("symlink_escape", "Workspace tool path resolves outside the tenant root.");
}

async function appendWorkspaceAudit(input: WorkspaceToolBaseInput, toolName: WorkspaceToolName, outcome: WorkspaceAuditEvent["outcome"]): Promise<void> {
  await input.workspaceAudit?.append({
    id: `workspace_${outcome}_${toolName}`,
    at: new Date().toISOString(),
    toolName,
    outcome,
    actorProfile: input.actor.profile,
    targetKind: "redacted",
    reasonCode: "workspace_side_effect_committed"
  });
}
