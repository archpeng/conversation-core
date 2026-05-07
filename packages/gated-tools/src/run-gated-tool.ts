export type GatedToolOutcome = "allow" | "deny" | "require_approval";

export type GatedToolRequest = {
  capabilityId: string;
  actor: {
    profile: "customer" | "staff" | "admin" | "internal";
    id?: string;
  };
  tenantId?: string;
  workspace?: {
    kind: "none" | "proposal" | "sandbox" | "tenant_workspace";
    path?: string;
  };
  pendingActionId?: string;
  target?: string;
  roomId?: string;
  draftId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  roomTypeText?: string;
  quantity?: number;
  selections?: readonly {
    roomId: string;
    selectedCandidateRef: string;
    roomTypeId?: string;
    roomType?: string;
  }[];
  guestName?: string;
  content?: string;
  operation?: string;
  reason?: string;
  sourceEpisodeRefs?: readonly string[];
  riskLevel?: "low" | "medium" | "high" | "critical";
};

export type GatedDecision = {
  outcome: GatedToolOutcome;
  reasons: readonly { code: string }[];
  audit: {
    capabilityId: string;
  };
};

export type GatedAuditEvent = {
  id: string;
};

export type SafetyGatewayPort = {
  decide(request: GatedToolRequest): GatedDecision;
  audit(decision: GatedDecision): GatedAuditEvent;
};

export type GatedToolExecutor<T> = (input: {
  request: GatedToolRequest;
  decision: GatedDecision;
  auditId: string;
}) => T | Promise<T>;

export type GatedToolResult<T> =
  | { outcome: "allow"; auditId: string; value: T; decision: GatedDecision }
  | { outcome: "deny"; auditId: string; decision: GatedDecision }
  | { outcome: "require_approval"; auditId: string; decision: GatedDecision };

export type RunGatedToolInput<T> = {
  gateway: SafetyGatewayPort;
  request: GatedToolRequest;
  executor: GatedToolExecutor<T>;
};

export async function runGatedTool<T>(input: RunGatedToolInput<T>): Promise<GatedToolResult<T>> {
  const decision = input.gateway.decide(input.request);
  const auditEvent = input.gateway.audit(decision);

  if (decision.outcome === "deny") {
    return { outcome: "deny", auditId: auditEvent.id, decision };
  }

  if (decision.outcome === "require_approval") {
    return { outcome: "require_approval", auditId: auditEvent.id, decision };
  }

  const value = await input.executor({ request: input.request, decision, auditId: auditEvent.id });
  return { outcome: "allow", auditId: auditEvent.id, value, decision };
}
