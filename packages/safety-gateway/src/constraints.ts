export type ActorProfile = "customer" | "staff" | "admin" | "internal";

export type WorkspaceKind = "none" | "proposal" | "sandbox";

export type SafetyConstraintId =
  | "tenant_scope_required"
  | "proposal_workspace_required"
  | "sandbox_workspace_required"
  | "sandbox_path_required"
  | "sandbox_command_allowlist"
  | "sandbox_write_disabled"
  | "pending_action_required"
  | "typed_approval_required"
  | "customer_read_only"
  | "http_default_deny";

export type SafetyConstraint = {
  id: SafetyConstraintId;
  summary: string;
};

export const safetyConstraints: Record<SafetyConstraintId, SafetyConstraint> = {
  tenant_scope_required: {
    id: "tenant_scope_required",
    summary: "PMS capabilities require a tenant-scoped request."
  },
  proposal_workspace_required: {
    id: "proposal_workspace_required",
    summary: "Proposal changes must target the proposal workspace, not production PMS state."
  },
  sandbox_workspace_required: {
    id: "sandbox_workspace_required",
    summary: "File and bash capabilities require a sandbox workspace."
  },
  sandbox_path_required: {
    id: "sandbox_path_required",
    summary: "Sandbox file and bash capabilities must target a sandbox workspace path."
  },
  sandbox_command_allowlist: {
    id: "sandbox_command_allowlist",
    summary: "Sandbox bash permits only deterministic validation commands."
  },
  sandbox_write_disabled: {
    id: "sandbox_write_disabled",
    summary: "Sandbox write/edit are disabled in MVP; writes and edits must stay in proposal workspaces."
  },
  pending_action_required: {
    id: "pending_action_required",
    summary: "PMS confirmation requires a current pending action reference."
  },
  typed_approval_required: {
    id: "typed_approval_required",
    summary: "High-risk PMS mutation must return approval-required before execution."
  },
  customer_read_only: {
    id: "customer_read_only",
    summary: "Customer profile is limited to tenant-scoped PMS reads and approval requests."
  },
  http_default_deny: {
    id: "http_default_deny",
    summary: "Arbitrary HTTP is not an MVP capability."
  }
};
