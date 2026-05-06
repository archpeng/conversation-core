import type { SafetyConstraintId } from "./constraints.js";
import { capabilityRisks, type CapabilityRisk } from "./risk.js";

export const capabilityIds = [
  "pms_read",
  "pms_workflow",
  "pms_confirm",
  "proposal_read",
  "proposal_write",
  "proposal_edit",
  "sandbox_read",
  "sandbox_write",
  "sandbox_edit",
  "sandbox_bash",
  "http_request"
] as const;

export type CapabilityId = (typeof capabilityIds)[number];

export type CapabilityKind = "pms" | "proposal_workspace" | "sandbox" | "http";

export type CapabilityDefinition = {
  id: CapabilityId;
  kind: CapabilityKind;
  risk: CapabilityRisk;
  constraints: readonly SafetyConstraintId[];
};

export const capabilityRegistry: Record<CapabilityId, CapabilityDefinition> = {
  pms_read: {
    id: "pms_read",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_workflow: {
    id: "pms_workflow",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_confirm: {
    id: "pms_confirm",
    kind: "pms",
    risk: capabilityRisks.pmsConfirm,
    constraints: ["tenant_scope_required", "pending_action_required", "typed_approval_required"]
  },
  proposal_read: {
    id: "proposal_read",
    kind: "proposal_workspace",
    risk: capabilityRisks.proposalRead,
    constraints: ["proposal_workspace_required"]
  },
  proposal_write: {
    id: "proposal_write",
    kind: "proposal_workspace",
    risk: capabilityRisks.proposalWrite,
    constraints: ["proposal_workspace_required"]
  },
  proposal_edit: {
    id: "proposal_edit",
    kind: "proposal_workspace",
    risk: capabilityRisks.proposalEdit,
    constraints: ["proposal_workspace_required"]
  },
  sandbox_read: {
    id: "sandbox_read",
    kind: "sandbox",
    risk: capabilityRisks.sandboxRead,
    constraints: ["sandbox_workspace_required"]
  },
  sandbox_write: {
    id: "sandbox_write",
    kind: "sandbox",
    risk: capabilityRisks.sandboxWrite,
    constraints: ["sandbox_workspace_required"]
  },
  sandbox_edit: {
    id: "sandbox_edit",
    kind: "sandbox",
    risk: capabilityRisks.sandboxEdit,
    constraints: ["sandbox_workspace_required"]
  },
  sandbox_bash: {
    id: "sandbox_bash",
    kind: "sandbox",
    risk: capabilityRisks.sandboxBash,
    constraints: ["sandbox_workspace_required"]
  },
  http_request: {
    id: "http_request",
    kind: "http",
    risk: capabilityRisks.httpRequest,
    constraints: ["http_default_deny"]
  }
};

export function getCapabilityDefinition(capabilityId: string): CapabilityDefinition | undefined {
  return capabilityRegistry[capabilityId as CapabilityId];
}
