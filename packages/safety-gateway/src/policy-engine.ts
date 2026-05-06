import { getCapabilityDefinition } from "./capability-registry.js";
import { safetyConstraints, type ActorProfile, type SafetyConstraintId } from "./constraints.js";
import { buildDecision, type SafetyDecision, type SafetyDecisionReason, type ToolRequest } from "./decision.js";

const proposalProfiles = new Set<ActorProfile>(["staff", "admin", "internal"]);
const sandboxProfiles = new Set<ActorProfile>(["admin", "internal"]);

export function decideToolRequest(request: ToolRequest): SafetyDecision {
  const capability = getCapabilityDefinition(request.capabilityId);
  if (!capability) {
    return buildDecision("deny", request, [{ code: "unknown_capability", message: "Capability is not registered." }]);
  }

  if (capability.constraints.includes("http_default_deny")) {
    return buildDecision("deny", request, [constraintReason("http_default_deny", capability.id, capability.risk.level)], capability);
  }

  if (capability.constraints.includes("tenant_scope_required") && !hasText(request.tenantId)) {
    return buildDecision("deny", request, [constraintReason("tenant_scope_required", capability.id, capability.risk.level)], capability);
  }

  if (capability.kind === "proposal_workspace") {
    if (!proposalProfiles.has(request.actor.profile)) {
      return buildDecision("deny", request, [constraintReason("customer_read_only", capability.id, capability.risk.level)], capability);
    }
    if (request.workspace?.kind !== "proposal" || !isProposalWorkspacePath(request.workspace.path) || !isProposalWorkspacePath(request.target)) {
      return buildDecision("deny", request, [constraintReason("proposal_workspace_required", capability.id, capability.risk.level)], capability);
    }
    return buildDecision("allow", request, [allowReason("proposal_workspace_allowed", capability.id, capability.risk.level)], capability);
  }

  if (capability.kind === "tenant_workspace") {
    if (!proposalProfiles.has(request.actor.profile)) {
      return buildDecision("deny", request, [constraintReason("customer_read_only", capability.id, capability.risk.level)], capability);
    }
    if (request.workspace?.kind !== "tenant_workspace" || !isTenantWorkspacePath(request.workspace.path, request.tenantId) || !isTenantWorkspacePath(request.target, request.tenantId)) {
      return buildDecision("deny", request, [constraintReason("tenant_workspace_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.id === "workspace_read" && !isTenantWorkspaceReadablePath(request.target, request.tenantId)) {
      return buildDecision("deny", request, [constraintReason("tenant_workspace_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.id === "workspace_list_active_skills" && !isTenantWorkspaceActiveSkillsPath(request.target, request.tenantId)) {
      return buildDecision("deny", request, [constraintReason("tenant_workspace_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.constraints.includes("workspace_proposal_required") && !isTenantWorkspaceProposalPath(request.target, request.tenantId)) {
      return buildDecision("deny", request, [constraintReason("workspace_proposal_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.constraints.includes("workspace_reason_required") && !hasText(request.reason)) {
      return buildDecision("deny", request, [constraintReason("workspace_reason_required", capability.id, capability.risk.level)], capability);
    }
    return buildDecision("allow", request, [allowReason("tenant_workspace_allowed", capability.id, capability.risk.level)], capability);
  }

  if (capability.kind === "sandbox") {
    if (!sandboxProfiles.has(request.actor.profile)) {
      return buildDecision("deny", request, [constraintReason("customer_read_only", capability.id, capability.risk.level)], capability);
    }
    if (request.workspace?.kind !== "sandbox") {
      return buildDecision("deny", request, [constraintReason("sandbox_workspace_required", capability.id, capability.risk.level)], capability);
    }
    if (!isSandboxWorkspacePath(request.workspace.path)) {
      return buildDecision("deny", request, [constraintReason("sandbox_path_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.id === "sandbox_write" || capability.id === "sandbox_edit") {
      return buildDecision("deny", request, [constraintReason("sandbox_write_disabled", capability.id, capability.risk.level)], capability);
    }
    if (capability.id === "sandbox_read" && !isSandboxWorkspacePath(request.target)) {
      return buildDecision("deny", request, [constraintReason("sandbox_path_required", capability.id, capability.risk.level)], capability);
    }
    if (capability.id === "sandbox_bash" && !isAllowedSandboxCommand(request.target)) {
      return buildDecision("deny", request, [constraintReason("sandbox_command_allowlist", capability.id, capability.risk.level)], capability);
    }
    return buildDecision("allow", request, [allowReason("sandbox_workspace_allowed", capability.id, capability.risk.level)], capability);
  }

  if (request.actor.profile === "customer" && capability.id !== "pms_read" && capability.id !== "pms_workflow" && capability.id !== "pms_confirm") {
    return buildDecision("deny", request, [constraintReason("customer_read_only", capability.id, capability.risk.level)], capability);
  }

  if (capability.id === "pms_confirm") {
    if (!hasText(request.pendingActionId)) {
      return buildDecision("deny", request, [constraintReason("pending_action_required", capability.id, capability.risk.level)], capability);
    }
    return buildDecision("require_approval", request, [constraintReason("typed_approval_required", capability.id, capability.risk.level)], capability);
  }

  return buildDecision("allow", request, [allowReason("capability_constraints_satisfied", capability.id, capability.risk.level)], capability);
}

function constraintReason(constraintId: SafetyConstraintId, capabilityId: string, riskLevel: SafetyDecisionReason["riskLevel"]): SafetyDecisionReason {
  return {
    code: constraintId,
    message: safetyConstraints[constraintId].summary,
    capabilityId: capabilityId as SafetyDecisionReason["capabilityId"],
    riskLevel,
    constraintId
  };
}

function allowReason(code: string, capabilityId: string, riskLevel: SafetyDecisionReason["riskLevel"]): SafetyDecisionReason {
  return {
    code,
    message: "Capability risk and constraints are satisfied for this request.",
    capabilityId: capabilityId as SafetyDecisionReason["capabilityId"],
    riskLevel
  };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProposalWorkspacePath(path: unknown): path is string {
  return typeof path === "string"
    && (/^\/workspaces\/[^/]+\/proposal\/[A-Za-z0-9._/-]+$/.test(path) || /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/proposals\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._/-]+$/.test(path))
    && !path.includes("..")
    && !hasBlockedPathSegment(path);
}

function isTenantWorkspacePath(path: unknown, tenantId: unknown): path is string {
  return typeof path === "string"
    && typeof tenantId === "string"
    && path.startsWith(`/workspaces/${tenantId}/`)
    && /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._/-]+$/.test(path)
    && !path.includes("..")
    && !hasBlockedPathSegment(path);
}

function isTenantWorkspaceProposalPath(path: unknown, tenantId: unknown): path is string {
  return isTenantWorkspacePath(path, tenantId)
    && typeof path === "string"
    && /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/proposals\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._/-]+$/.test(path);
}

function isTenantWorkspaceActiveSkillsPath(path: unknown, tenantId: unknown): path is string {
  return isTenantWorkspacePath(path, tenantId)
    && typeof path === "string"
    && /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/active\/skills\/[A-Za-z0-9._/-]+$/.test(path);
}

function isTenantWorkspaceReadablePath(path: unknown, tenantId: unknown): path is string {
  return isTenantWorkspaceProposalPath(path, tenantId)
    || isTenantWorkspaceActiveSkillsPath(path, tenantId)
    || (isTenantWorkspacePath(path, tenantId) && typeof path === "string" && /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/active\/policies\/[A-Za-z0-9._/-]+$/.test(path))
    || (isTenantWorkspacePath(path, tenantId) && typeof path === "string" && /^\/workspaces\/[A-Za-z0-9_-]{1,64}\/(README|PROFILE)\.md$/.test(path));
}

function isSandboxWorkspacePath(path: unknown): path is string {
  return typeof path === "string"
    && /^\/workspaces\/[^/]+\/sandbox(?:\/[A-Za-z0-9._/-]+)?$/.test(path)
    && !path.includes("..")
    && !hasBlockedPathSegment(path);
}

function hasBlockedPathSegment(path: string): boolean {
  return /(^|\/)production(\/|$)/i.test(path)
    || /(^|\/)root(\/|$)/i.test(path)
    || /(^|\/)\.env(?:[./]|$)/i.test(path)
    || /(^|\/)env(\/|$)/i.test(path)
    || /(^|\/)(?:\.ssh|id_rsa|id_dsa|id_ecdsa|id_ed25519|private-key|secret|token|credential)(\/|$)/i.test(path)
    || /\.(?:pem|key|p12|pfx|crt)$/i.test(path);
}

function isAllowedSandboxCommand(command: unknown): boolean {
  if (typeof command !== "string") return false;
  const normalized = command.trim().replace(/\s+/g, " ");
  return normalized === "pnpm test"
    || normalized === "pnpm build"
    || normalized === "tsc --noEmit";
}
