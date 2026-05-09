import type { SafetyConstraintId } from "./constraints.js";
import { capabilityRisks, type CapabilityRisk } from "./risk.js";

export const capabilityIds = [
  "pms_confirm",
  "pms_hotel_profile",
  "pms_room_type_catalog",
  "pms_availability_search",
  "pms_inventory_summary",
  "pms_room_reservation_context",
  "pms_reservation_lookup",
  "pms_get_room",
  "pms_today_arrivals",
  "pms_today_departures",
  "pms_pending_action_status",
  "pms_reservation_draft_create",
  "pms_reservation_draft_update",
  "pms_reservation_quote",
  "pms_reservation_prepare_confirm",
  "pms_reservation_group_draft_create",
  "pms_reservation_group_draft_update",
  "pms_reservation_group_quote",
  "pms_reservation_group_prepare_confirm",
  "pms_reservation_group_prepare_booking",
  "proposal_read",
  "proposal_write",
  "proposal_edit",
  "workspace_read",
  "workspace_write_proposal",
  "workspace_edit_proposal",
  "workspace_list_active_skills",
  "workspace_create_skill_proposal",
  "sandbox_read",
  "sandbox_write",
  "sandbox_edit",
  "sandbox_bash",
  "http_request"
] as const;

export type CapabilityId = (typeof capabilityIds)[number];

export type CapabilityKind = "pms" | "proposal_workspace" | "tenant_workspace" | "sandbox" | "http";

export type CapabilityDefinition = {
  id: CapabilityId;
  kind: CapabilityKind;
  risk: CapabilityRisk;
  constraints: readonly SafetyConstraintId[];
};

export const capabilityRegistry: Record<CapabilityId, CapabilityDefinition> = {
  pms_confirm: {
    id: "pms_confirm",
    kind: "pms",
    risk: capabilityRisks.pmsConfirm,
    constraints: ["tenant_scope_required", "pending_action_required", "typed_approval_required"]
  },
  pms_hotel_profile: {
    id: "pms_hotel_profile",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_room_type_catalog: {
    id: "pms_room_type_catalog",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_availability_search: {
    id: "pms_availability_search",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_inventory_summary: {
    id: "pms_inventory_summary",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_room_reservation_context: {
    id: "pms_room_reservation_context",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_lookup: {
    id: "pms_reservation_lookup",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_get_room: {
    id: "pms_get_room",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_today_arrivals: {
    id: "pms_today_arrivals",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_today_departures: {
    id: "pms_today_departures",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_pending_action_status: {
    id: "pms_pending_action_status",
    kind: "pms",
    risk: capabilityRisks.pmsRead,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_draft_create: {
    id: "pms_reservation_draft_create",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_draft_update: {
    id: "pms_reservation_draft_update",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_quote: {
    id: "pms_reservation_quote",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_prepare_confirm: {
    id: "pms_reservation_prepare_confirm",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_group_draft_create: {
    id: "pms_reservation_group_draft_create",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_group_draft_update: {
    id: "pms_reservation_group_draft_update",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_group_quote: {
    id: "pms_reservation_group_quote",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_group_prepare_confirm: {
    id: "pms_reservation_group_prepare_confirm",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
  },
  pms_reservation_group_prepare_booking: {
    id: "pms_reservation_group_prepare_booking",
    kind: "pms",
    risk: capabilityRisks.pmsWorkflow,
    constraints: ["tenant_scope_required"]
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
  workspace_read: {
    id: "workspace_read",
    kind: "tenant_workspace",
    risk: capabilityRisks.workspaceRead,
    constraints: ["tenant_scope_required", "tenant_workspace_required"]
  },
  workspace_write_proposal: {
    id: "workspace_write_proposal",
    kind: "tenant_workspace",
    risk: capabilityRisks.workspaceWriteProposal,
    constraints: ["tenant_scope_required", "tenant_workspace_required", "workspace_proposal_required", "workspace_reason_required"]
  },
  workspace_edit_proposal: {
    id: "workspace_edit_proposal",
    kind: "tenant_workspace",
    risk: capabilityRisks.workspaceEditProposal,
    constraints: ["tenant_scope_required", "tenant_workspace_required", "workspace_proposal_required", "workspace_reason_required"]
  },
  workspace_list_active_skills: {
    id: "workspace_list_active_skills",
    kind: "tenant_workspace",
    risk: capabilityRisks.workspaceListActiveSkills,
    constraints: ["tenant_scope_required", "tenant_workspace_required"]
  },
  workspace_create_skill_proposal: {
    id: "workspace_create_skill_proposal",
    kind: "tenant_workspace",
    risk: capabilityRisks.workspaceCreateSkillProposal,
    constraints: ["tenant_scope_required", "tenant_workspace_required", "workspace_proposal_required", "workspace_reason_required"]
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
