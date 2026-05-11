import { assertRecord, assertText, isPlainRecord } from "./schema-assertions.js";
import { validateTenantScopedInput } from "./tenant-schemas.js";
import type { PendingActionCallbackActor } from "./pending-action-callback-schemas.js";

export const pmsTypedOperationKinds = [
  "check_in",
  "check_out",
  "housekeeping_done",
  "housekeeping_inspection",
  "housekeeping_rework",
  "maintenance_report",
  "maintenance_done",
  "maintenance_restore_sellable"
] as const;

export type PmsTypedOperationKind = (typeof pmsTypedOperationKinds)[number];

export type ExecuteTypedOperationInput = {
  tenantId: string;
  propertyId?: string;
  operation: PmsTypedOperationKind;
  targetRef: string;
  cardPayloadRef: string;
  actor: PendingActionCallbackActor;
};

export type TypedOperationFact = {
  operation: PmsTypedOperationKind;
  targetRef: string;
  status: "confirmed" | "rejected" | "expired" | "failed";
  mutationStatus: "none" | "deferred" | "committed";
  idempotencyStatus: string;
  auditRefs?: string[];
};

export function validateExecuteTypedOperationInput(input: ExecuteTypedOperationInput): void {
  validateTenantScopedInput(input);
  if (!pmsTypedOperationKinds.includes(input.operation)) throw new Error("operation is invalid");
  assertText(input.targetRef, "targetRef");
  assertText(input.cardPayloadRef, "cardPayloadRef");
  const actor = assertRecord(input.actor, "actor");
  if (actor.type !== "human" && actor.type !== "ai") throw new Error("actor.type is invalid");
  assertText(actor.id, "actor.id");
  if (actor.displayName !== undefined) assertText(actor.displayName, "actor.displayName");
}

export function parseTypedOperationFact(operation: PmsTypedOperationKind, targetRef: string, value: unknown): TypedOperationFact {
  const object = assertRecord(value, "typed operation response");
  const status = parseStatus(object.status);
  const mutationStatus = parseMutationStatus(object.mutationStatus);
  const idempotencyStatus = typeof object.idempotencyStatus === "string" && object.idempotencyStatus.trim() ? object.idempotencyStatus : status;
  const auditRefs = parseAuditRefs(object.auditRefs ?? (isPlainRecord(object.audit) ? object.audit.refs : undefined));
  return {
    operation,
    targetRef,
    status,
    mutationStatus,
    idempotencyStatus,
    ...(auditRefs.length > 0 ? { auditRefs } : {})
  };
}

function parseStatus(value: unknown): TypedOperationFact["status"] {
  if (value === "confirmed" || value === "committed" || value === "ok") return "confirmed";
  if (value === "rejected" || value === "cancelled") return "rejected";
  if (value === "expired") return "expired";
  return "failed";
}

function parseMutationStatus(value: unknown): TypedOperationFact["mutationStatus"] {
  if (value === "committed") return "committed";
  if (value === "deferred") return "deferred";
  return "none";
}

function parseAuditRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item];
    if (!isPlainRecord(item)) return [];
    return typeof item.auditId === "string" && item.auditId.trim() ? [item.auditId] : [];
  });
}
