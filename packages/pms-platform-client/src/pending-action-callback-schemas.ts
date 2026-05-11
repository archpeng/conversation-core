import { assertRecord, assertText, isPlainRecord } from "./schema-assertions.js";
import {
  validatePendingActionStatusInput,
  type PendingActionStatusFact,
  type PendingActionStatusInput
} from "./reservation-workflow-schemas.js";

export type PendingActionCallbackActor = {
  type: "human" | "ai";
  id: string;
  displayName?: string;
};

export type PendingActionCallbackInput = PendingActionStatusInput & {
  propertyId?: string;
  actor: PendingActionCallbackActor;
};

export type ConfirmPendingActionInput = PendingActionCallbackInput;

export type CancelPendingActionInput = PendingActionCallbackInput & {
  reason: string;
};

export type PendingActionCallbackFact = PendingActionStatusFact & {
  mutationStatus: "none" | "deferred" | "committed";
  idempotencyStatus: string;
  auditRefs?: string[];
  reservationCode?: string;
};

export function validateConfirmPendingActionInput(input: ConfirmPendingActionInput): void {
  validatePendingActionStatusInput(input);
  validatePendingActionCallbackActor(input.actor);
}

export function validateCancelPendingActionInput(input: CancelPendingActionInput): void {
  validateConfirmPendingActionInput(input);
  assertText(input.reason, "reason");
}

export function parsePendingActionCallbackFact(value: unknown): PendingActionCallbackFact {
  const object = assertRecord(value, "pending-action callback response");
  const pendingAction = assertRecord(object.pendingAction, "pendingAction");
  const status = pendingAction.status;
  const mutationStatus = object.mutationStatus;
  if (status !== "pending" && status !== "awaitingConfirmation" && status !== "confirmed" && status !== "cancelled" && status !== "expired") {
    throw new Error("pendingAction.status is invalid");
  }
  if (mutationStatus !== "none" && mutationStatus !== "deferred" && mutationStatus !== "committed") {
    throw new Error("mutationStatus is invalid");
  }
  const reservation = isPlainRecord(object.reservation) ? object.reservation : undefined;
  const result: PendingActionCallbackFact = {
    pendingActionId: assertText(pendingAction.pendingActionRef ?? pendingAction.pendingActionId, "pendingActionId"),
    status,
    mutationStatus,
    idempotencyStatus: assertText(object.idempotencyStatus, "idempotencyStatus")
  };
  const auditRefs = parseAuditRefs(pendingAction.auditRefs);
  if (auditRefs.length > 0) result.auditRefs = auditRefs;
  if (typeof reservation?.reservationCode === "string" && reservation.reservationCode.trim()) result.reservationCode = reservation.reservationCode;
  return result;
}

function validatePendingActionCallbackActor(actor: PendingActionCallbackActor): void {
  const value = assertRecord(actor, "actor");
  if (value.type !== "human" && value.type !== "ai") throw new Error("actor.type is invalid");
  assertText(value.id, "actor.id");
  if (value.displayName !== undefined) assertText(value.displayName, "actor.displayName");
}

function parseAuditRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isPlainRecord(item)) return [];
    return typeof item.auditId === "string" && item.auditId.trim() ? [item.auditId] : [];
  });
}
