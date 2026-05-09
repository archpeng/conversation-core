import { runGatedTool, type GatedToolExecutor, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "./run-gated-tool.js";

export type GatedPmsCapabilityInput<T> = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  capabilityId: string;
  target?: string;
  roomId?: string;
  draftId?: string;
  draftRef?: string;
  groupDraftId?: string;
  groupDraftRef?: string;
  quoteId?: string;
  quoteRef?: string;
  pendingActionId?: string;
  pendingActionRef?: string;
  cardPayloadRef?: string;
  checkInDate?: string;
  checkOutDate?: string;
  startDate?: string;
  endDate?: string;
  businessDate?: string;
  reservationCode?: string;
  dateContext?: string;
  roomType?: string;
  roomTypeText?: string;
  sourceEvidenceRef?: string;
  selectedCandidateRef?: string;
  quantity?: number;
  selections?: GatedToolRequest["selections"];
  guestName?: string;
  executor: GatedToolExecutor<T>;
};

export type GatedPmsSafeReadInput<T> = GatedPmsCapabilityInput<T>;
export type GatedPmsWorkflowStepInput<T> = GatedPmsCapabilityInput<T>;

export function gatedPmsSafeRead<T>(input: GatedPmsSafeReadInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: pmsCapabilityRequest(input),
    executor: input.executor
  });
}

export function gatedPmsWorkflowStep<T>(input: GatedPmsWorkflowStepInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: pmsCapabilityRequest(input),
    executor: input.executor
  });
}

function pmsCapabilityRequest<T>(input: GatedPmsCapabilityInput<T>): GatedToolRequest {
  return {
    capabilityId: input.capabilityId,
    actor: input.actor,
    tenantId: input.tenantId,
    target: input.target,
    roomId: input.roomId,
    draftId: input.draftId,
    draftRef: input.draftRef,
    groupDraftId: input.groupDraftId,
    groupDraftRef: input.groupDraftRef,
    quoteId: input.quoteId,
    quoteRef: input.quoteRef,
    pendingActionId: input.pendingActionId,
    pendingActionRef: input.pendingActionRef,
    cardPayloadRef: input.cardPayloadRef,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    startDate: input.startDate,
    endDate: input.endDate,
    businessDate: input.businessDate,
    reservationCode: input.reservationCode,
    dateContext: input.dateContext,
    roomType: input.roomType,
    roomTypeText: input.roomTypeText,
    sourceEvidenceRef: input.sourceEvidenceRef,
    selectedCandidateRef: input.selectedCandidateRef,
    quantity: input.quantity,
    selections: input.selections,
    guestName: input.guestName
  };
}
