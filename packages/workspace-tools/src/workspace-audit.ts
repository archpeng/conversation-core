import type { GatedToolRequest } from "@pms-agent-v2/gated-tools";

export type WorkspaceToolName =
  | "workspace_read"
  | "workspace_write_proposal"
  | "workspace_edit_proposal"
  | "workspace_list_active_skills"
  | "workspace_create_skill_proposal";

export type WorkspaceToolActor = GatedToolRequest["actor"];

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

export async function appendWorkspaceAudit(
  input: { actor: WorkspaceToolActor; workspaceAudit?: WorkspaceAuditSink },
  toolName: WorkspaceToolName,
  outcome: WorkspaceAuditEvent["outcome"]
): Promise<void> {
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
