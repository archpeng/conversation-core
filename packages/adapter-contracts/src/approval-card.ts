import { asRecord, requireLiteral, requireNonEmptyString, requireOptionalString } from "./field-checks.js";

export type PmsPendingActionRef = {
  type: "pms_pending_action";
  tenantId: string;
  pendingActionId: string;
  pendingActionRef?: string;
  cardPayloadRef?: string;
  quoteRef?: string;
  selectionCount?: number;
  action: "reservation_confirm";
  expiresAt?: string;
};

export type PmsApprovalCard = {
  type: "pms_pending_action_card";
  ref: PmsPendingActionRef;
  title: string;
  summary: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type PmsApprovalCardValidation =
  | { ok: true; value: PmsApprovalCard }
  | { ok: false; issues: string[] };

export function validatePmsApprovalCard(input: unknown): PmsApprovalCardValidation {
  const issues: string[] = [];
  const value = asRecord(input);

  if (!value) return { ok: false, issues: ["card must be an object"] };

  requireLiteral(value.type, "pms_pending_action_card", "type", issues);
  requireNonEmptyString(value.title, "title", issues);
  requireNonEmptyString(value.summary, "summary", issues);
  requireNonEmptyString(value.confirmLabel, "confirmLabel", issues);
  requireNonEmptyString(value.cancelLabel, "cancelLabel", issues);

  const ref = asRecord(value.ref);
  if (!ref) {
    issues.push("ref must be an object");
  } else {
    requireLiteral(ref.type, "pms_pending_action", "ref.type", issues);
    requireNonEmptyString(ref.tenantId, "ref.tenantId", issues);
    requireNonEmptyString(ref.pendingActionId, "ref.pendingActionId", issues);
    requireOptionalString(ref.pendingActionRef, "ref.pendingActionRef", issues);
    requireOptionalString(ref.cardPayloadRef, "ref.cardPayloadRef", issues);
    requireOptionalString(ref.quoteRef, "ref.quoteRef", issues);
    if (ref.selectionCount !== undefined && (typeof ref.selectionCount !== "number" || !Number.isInteger(ref.selectionCount) || ref.selectionCount < 1)) issues.push("ref.selectionCount must be a positive integer");
    requireLiteral(ref.action, "reservation_confirm", "ref.action", issues);
    requireOptionalString(ref.expiresAt, "ref.expiresAt", issues);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as PmsApprovalCard };
}

export function isPmsApprovalCard(input: unknown): input is PmsApprovalCard {
  return validatePmsApprovalCard(input).ok;
}
