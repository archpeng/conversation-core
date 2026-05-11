import { createHash } from "node:crypto";
import type {
  CreateReservationDraftInput,
  CreateReservationGroupDraftInput,
  CancelPendingActionInput,
  ConfirmPendingActionInput,
  PendingActionStatusInput,
  SearchAvailabilityInput,
  UpdateReservationDraftInput,
  UpdateReservationGroupDraftInput
} from "./schemas.js";

export function availabilityRequestBody(input: SearchAvailabilityInput): Record<string, unknown> {
  const { quantity, ...body } = input;
  return {
    ...body,
    startDate: input.checkInDate,
    endDate: input.checkOutDate,
    ...(quantity ? { count: quantity } : {}),
    ...(input.roomType ? { roomTypeKeyword: input.roomType } : {})
  };
}

export function propertyScopedRequestBody(operation: string, input: { propertyId?: string }): Record<string, unknown> {
  return {
    operation,
    ...(input.propertyId ? { propertyId: input.propertyId } : {})
  };
}

export function createReservationDraftRequestBody(input: CreateReservationDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationWorkflowRequestBody("pms.reservation.draft.create", input, now),
    slots: {
      roomId: input.roomId,
      guestDisplayName: input.guestName,
      arrivalDate: input.checkInDate,
      departureDate: input.checkOutDate,
      selectedCandidateRef: input.sourceEvidenceRef ? `${input.sourceEvidenceRef}:${input.roomId}` : undefined,
      ...(input.roomType ? { roomTypeKeyword: input.roomType } : {})
    },
    evidenceRefs: input.sourceEvidenceRef ? [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] : []
  };
}

export function updateReservationDraftRequestBody(input: UpdateReservationDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationWorkflowRequestBody("pms.reservation.draft.update", input, now),
    ...(Object.keys(input.patch).length > 0 ? { slots: input.patch } : {}),
    ...(input.sourceEvidenceRef ? { evidenceRefs: [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] } : {})
  };
}

export function createReservationGroupDraftRequestBody(input: CreateReservationGroupDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationGroupWorkflowRequestBody("pms.reservation.group_draft.create", input, now),
    slots: {
      guestDisplayName: input.guestName,
      arrivalDate: input.checkInDate,
      departureDate: input.checkOutDate,
      quantity: input.quantity,
      ...(input.roomType ? { roomTypeKeyword: input.roomType } : {})
    },
    evidenceRefs: input.sourceEvidenceRef ? [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] : []
  };
}

export function updateReservationGroupDraftRequestBody(input: UpdateReservationGroupDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationGroupWorkflowRequestBody("pms.reservation.group_draft.update", input, now),
    slots: { selections: input.selections },
    ...(input.sourceEvidenceRef ? { evidenceRefs: [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] } : {})
  };
}

export function reservationWorkflowRequestBody(operation: string, input: { tenantId: string; propertyId?: string; draftId?: string; draftRef?: string; quoteRef?: string }, now: () => Date): Record<string, unknown> {
  const requestedAt = now().toISOString();
  const fingerprint = workflowFingerprint(operation, input);
  return {
    operation,
    propertyId: input.propertyId ?? "property-small-hotel",
    actor: { type: "ai", id: "pms-agent-v2", displayName: "PMS Agent V2" },
    source: "api",
    clientToken: `pms-agent-v2-${operationHash(operation)}-${fingerprint.slice(0, 16)}`,
    requestFingerprint: `sha256:${fingerprint}`,
    correlationId: `corr-${fingerprint.slice(0, 24)}`,
    requestedAt,
    ...(input.draftRef ? { draftRef: input.draftRef } : {}),
    ...(input.draftId ? { draftId: input.draftId } : {}),
    ...(input.quoteRef ? { quoteRef: input.quoteRef } : {})
  };
}

export function reservationGroupWorkflowRequestBody(operation: string, input: { tenantId: string; propertyId?: string; groupDraftId?: string; groupDraftRef?: string; quoteRef?: string }, now: () => Date): Record<string, unknown> {
  const requestedAt = now().toISOString();
  const fingerprint = workflowFingerprint(operation, input);
  return {
    operation,
    propertyId: input.propertyId ?? "property-small-hotel",
    actor: { type: "ai", id: "pms-agent-v2", displayName: "PMS Agent V2" },
    source: "api",
    clientToken: `pms-agent-v2-${operationHash(operation)}-${fingerprint.slice(0, 16)}`,
    requestFingerprint: `sha256:${fingerprint}`,
    correlationId: `corr-${fingerprint.slice(0, 24)}`,
    requestedAt,
    ...(input.groupDraftRef ? { groupDraftRef: input.groupDraftRef } : {}),
    ...(input.groupDraftId ? { groupDraftId: input.groupDraftId } : {}),
    ...(input.quoteRef ? { quoteRef: input.quoteRef } : {})
  };
}

export function pendingActionStatusRequestBody(input: PendingActionStatusInput, now: () => Date): Record<string, unknown> {
  const requestedAt = now().toISOString();
  const pendingActionRef = input.pendingActionRef ?? input.pendingActionId;
  const fingerprint = workflowFingerprint("pms.pending_action.status", input);
  return {
    operation: "pms.pending_action.status",
    pendingActionRef,
    actor: { type: "ai", id: "pms-agent-v2", displayName: "PMS Agent V2" },
    scope: { propertyId: "property-small-hotel", channel: "typed_card" },
    clientToken: `pms-agent-v2-pending-status-${fingerprint.slice(0, 16)}`,
    requestFingerprint: `sha256:${fingerprint}`,
    correlationId: `corr-${fingerprint.slice(0, 24)}`,
    requestedAt,
    ...(input.cardPayloadRef ? { cardPayloadRef: input.cardPayloadRef } : {})
  };
}

export function confirmPendingActionRequestBody(input: ConfirmPendingActionInput, now: () => Date): Record<string, unknown> {
  return pendingActionCallbackRequestBody("pms.pending_action.confirm", input, now);
}

export function cancelPendingActionRequestBody(input: CancelPendingActionInput, now: () => Date): Record<string, unknown> {
  return {
    ...pendingActionCallbackRequestBody("pms.pending_action.cancel", input, now),
    reason: input.reason
  };
}

function pendingActionCallbackRequestBody(operation: string, input: ConfirmPendingActionInput, now: () => Date): Record<string, unknown> {
  const requestedAt = now().toISOString();
  const pendingActionRef = input.pendingActionRef ?? input.pendingActionId;
  const fingerprint = workflowFingerprint(operation, input);
  return {
    operation,
    pendingActionRef,
    actor: {
      type: input.actor.type,
      id: input.actor.id,
      ...(input.actor.displayName ? { displayName: input.actor.displayName } : {})
    },
    scope: { propertyId: input.propertyId ?? "property-small-hotel", channel: "typed_card" },
    clientToken: `pms-agent-v2-${operationHash(operation)}-${fingerprint.slice(0, 16)}`,
    requestFingerprint: `sha256:${fingerprint}`,
    correlationId: `corr-${fingerprint.slice(0, 24)}`,
    requestedAt,
    ...(input.cardPayloadRef ? { cardPayloadRef: input.cardPayloadRef } : {})
  };
}

function workflowFingerprint(operation: string, input: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, input })).digest("hex");
}

function operationHash(operation: string): string {
  return createHash("sha256").update(operation).digest("hex").slice(0, 8);
}
