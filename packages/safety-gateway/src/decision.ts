import type { ActorProfile, SafetyConstraintId, WorkspaceKind } from "./constraints.js";
import type { CapabilityDefinition, CapabilityId } from "./capability-registry.js";
import type { RiskLevel } from "./risk.js";

export type ToolRiskLevel = RiskLevel;

export type ToolRequest = {
  capabilityId: string;
  actor: {
    profile: ActorProfile;
    id?: string;
  };
  tenantId?: string;
  workspace?: {
    kind: WorkspaceKind;
    path?: string;
  };
  pendingActionId?: string;
  target?: string;
  roomId?: string;
  draftId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  quantity?: number;
  guestName?: string;
  content?: string;
  operation?: string;
  reason?: string;
  sourceEpisodeRefs?: readonly string[];
  riskLevel?: ToolRiskLevel;
};

export type SafetyDecisionOutcome = "allow" | "deny" | "require_approval";

export type SafetyDecisionReason = {
  code: string;
  message: string;
  capabilityId?: CapabilityId;
  riskLevel?: RiskLevel;
  constraintId?: SafetyConstraintId;
};

export type SafetyDecision = {
  outcome: SafetyDecisionOutcome;
  request: ToolRequest;
  capability?: CapabilityDefinition;
  reasons: readonly SafetyDecisionReason[];
  audit: RedactedDecisionSummary;
};

export type RedactedDecisionSummary = {
  capabilityId: string;
  actorProfile: ActorProfile;
  outcome: SafetyDecisionOutcome;
  workspaceKind: WorkspaceKind;
  hasTenantScope: boolean;
  hasPendingAction: boolean;
  targetKind: "none" | "redacted";
};

export function summarizeDecisionRequest(request: ToolRequest, outcome: SafetyDecisionOutcome): RedactedDecisionSummary {
  return {
    capabilityId: request.capabilityId,
    actorProfile: request.actor.profile,
    outcome,
    workspaceKind: request.workspace?.kind ?? "none",
    hasTenantScope: hasText(request.tenantId),
    hasPendingAction: hasText(request.pendingActionId),
    targetKind: hasText(request.target) || hasText(request.workspace?.path) ? "redacted" : "none"
  };
}

export function buildDecision(
  outcome: SafetyDecisionOutcome,
  request: ToolRequest,
  reasons: readonly SafetyDecisionReason[],
  capability?: CapabilityDefinition
): SafetyDecision {
  return {
    outcome,
    request,
    capability,
    reasons,
    audit: summarizeDecisionRequest(request, outcome)
  };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
