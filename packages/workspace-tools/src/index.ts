import { runGatedTool, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import {
  readWorkspaceFile,
  validateSkillProposalCompleteness,
  writeProposalFile,
  type ProposalCompletenessResult,
  type TenantScope,
  type WorkspaceReadResult,
  type WorkspaceWriteResult
} from "@pms-agent-v2/workspace-core";
import { listActiveSkillNames } from "./active-skills-tool.js";
import { assertSkillProposalInput, proposalRoot } from "./skill-proposal-tool.js";
import { appendWorkspaceAudit, createWorkspaceAuditBuffer, type WorkspaceAuditBuffer, type WorkspaceAuditEvent, type WorkspaceAuditSink, type WorkspaceToolActor, type WorkspaceToolName } from "./workspace-audit.js";
import { WorkspaceToolError } from "./workspace-errors.js";

export type WorkspaceArtifactAuthority = "workspace_advisory";

export type { WorkspaceAuditBuffer, WorkspaceAuditEvent, WorkspaceAuditSink, WorkspaceToolActor, WorkspaceToolName };

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

export { createWorkspaceAuditBuffer, WorkspaceToolError };

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
