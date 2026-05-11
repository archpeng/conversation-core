import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import { createSafetyAuditEvent, decideToolRequest, type SafetyAuditSink, type SafetyDecision, type ToolRequest } from "@pms-agent-v2/safety-gateway";

export type RuntimeSafetyGatewayInput = {
  auditSink?: SafetyAuditSink;
};

export function createRuntimeSafetyGateway(input: RuntimeSafetyGatewayInput = {}): SafetyGatewayPort {
  const safetyDecisions = new WeakMap<GatedDecision, SafetyDecision>();
  let fallbackSequence = 0;

  return {
    decide(request: GatedToolRequest): GatedDecision {
      const decision = decideToolRequest(toSafetyToolRequest(request));
      const gatedDecision = toGatedDecision(decision);
      safetyDecisions.set(gatedDecision, decision);
      return gatedDecision;
    },
    audit(decision: GatedDecision) {
      const safetyDecision = safetyDecisions.get(decision);
      if (!safetyDecision) return { id: fallbackAuditId(decision, ++fallbackSequence) };
      const event = createSafetyAuditEvent(safetyDecision);
      input.auditSink?.append(event);
      return { id: event.id };
    }
  };
}

function toSafetyToolRequest(request: GatedToolRequest): ToolRequest {
  return {
    capabilityId: request.capabilityId,
    actor: request.actor,
    tenantId: request.tenantId,
    workspace: request.workspace,
    pendingActionId: request.pendingActionId,
    pendingActionRef: request.pendingActionRef,
    cardPayloadRef: request.cardPayloadRef,
    target: request.target,
    roomId: request.roomId,
    roomNumber: request.roomNumber,
    draftId: request.draftId,
    draftRef: request.draftRef,
    groupDraftId: request.groupDraftId,
    groupDraftRef: request.groupDraftRef,
    quoteId: request.quoteId,
    quoteRef: request.quoteRef,
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    startDate: request.startDate,
    endDate: request.endDate,
    businessDate: request.businessDate,
    reservationCode: request.reservationCode,
    dateContext: request.dateContext,
    roomType: request.roomType,
    roomTypeText: request.roomTypeText,
    sourceEvidenceRef: request.sourceEvidenceRef,
    selectedCandidateRef: request.selectedCandidateRef,
    quantity: request.quantity,
    guestName: request.guestName,
    content: request.content,
    operation: request.operation,
    reason: request.reason,
    sourceEpisodeRefs: request.sourceEpisodeRefs,
    riskLevel: request.riskLevel
  };
}

function toGatedDecision(decision: SafetyDecision): GatedDecision {
  return {
    outcome: decision.outcome,
    reasons: decision.reasons.map((reason) => ({ code: reason.code })),
    audit: {
      capabilityId: decision.audit.capabilityId
    }
  };
}

function fallbackAuditId(decision: GatedDecision, sequence: number): string {
  const reason = decision.reasons[0]?.code ?? "none";
  return `audit_fallback_${sequence}_${decision.outcome}_${decision.audit.capabilityId}_${reason}`;
}
