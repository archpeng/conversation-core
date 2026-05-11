import { asRecord, optionalStringArray, requireNonEmptyString, requireOneOf, requireOptionalBoolean, requireOptionalString, type Validation } from "./field-checks.js";
import { parseObjectRefs, type ObjectRef } from "./object-ref.js";

export const mutationStatuses = ["none", "draftOnly", "awaitingConfirmation", "committed", "rejected", "expired", "failed"] as const;
export const confirmationModes = ["none", "typedCardOnly", "managerApproval", "external"] as const;
export const actionKinds = ["primary", "secondary", "danger"] as const;

export type MutationStatus = (typeof mutationStatuses)[number];
export type ConfirmationMode = (typeof confirmationModes)[number];
export type ActionCardActionKind = (typeof actionKinds)[number];

export type ActionCardAction = {
  id: string;
  label: string;
  kind: ActionCardActionKind;
  disabled?: boolean;
  confirmationRequired?: boolean;
};

export type ActionCardOperationRef = {
  type: "pmsPendingAction";
  tenantId: string;
  pendingActionId: string;
  pendingActionRef?: string;
  cardPayloadRef: string;
  action: "reservation_confirm";
};

export type ActionCard = {
  id: string;
  title: string;
  summary: string;
  mutationStatus: MutationStatus;
  confirmationMode: ConfirmationMode;
  evidenceRefs?: string[];
  auditRefs?: string[];
  objectRefs?: ObjectRef[];
  operationRef?: ActionCardOperationRef;
  actions: ActionCardAction[];
};

export function validateActionCard(input: unknown): Validation<ActionCard> {
  const issues: string[] = [];
  const value = parseActionCard(input, "actionCard", issues);
  if (issues.length > 0 || !value) return { ok: false, issues };
  return { ok: true, value };
}

export function parseActionCards(input: unknown, field: string, issues: string[]): ActionCard[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }
  const cards: ActionCard[] = [];
  for (const [index, item] of input.entries()) {
    const card = parseActionCard(item, `${field}[${index}]`, issues);
    if (card) cards.push(card);
  }
  return cards;
}

function parseActionCard(input: unknown, field: string, issues: string[]): ActionCard | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object`);
    return undefined;
  }
  requireNonEmptyString(value.id, `${field}.id`, issues);
  requireNonEmptyString(value.title, `${field}.title`, issues);
  requireNonEmptyString(value.summary, `${field}.summary`, issues);
  requireOneOf(value.mutationStatus, mutationStatuses, `${field}.mutationStatus`, issues);
  requireOneOf(value.confirmationMode, confirmationModes, `${field}.confirmationMode`, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, `${field}.evidenceRefs`, issues);
  const auditRefs = optionalStringArray(value.auditRefs, `${field}.auditRefs`, issues);
  const objectRefs = parseObjectRefs(value.objectRefs, `${field}.objectRefs`, issues);
  const operationRef = parseOperationRef(value.operationRef, `${field}.operationRef`, issues);
  const actions = parseActions(value.actions, `${field}.actions`, issues);
  if (!canBuildActionCard(value, actions)) return undefined;
  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    mutationStatus: value.mutationStatus as MutationStatus,
    confirmationMode: value.confirmationMode as ConfirmationMode,
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(auditRefs ? { auditRefs } : {}),
    ...(objectRefs ? { objectRefs } : {}),
    ...(operationRef ? { operationRef } : {}),
    actions
  };
}

function parseOperationRef(input: unknown, field: string, issues: string[]): ActionCardOperationRef | undefined {
  if (input === undefined) return undefined;
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object when present`);
    return undefined;
  }
  requireOneOf(value.type, ["pmsPendingAction"], `${field}.type`, issues);
  requireNonEmptyString(value.tenantId, `${field}.tenantId`, issues);
  requireNonEmptyString(value.pendingActionId, `${field}.pendingActionId`, issues);
  requireOptionalString(value.pendingActionRef, `${field}.pendingActionRef`, issues);
  requireNonEmptyString(value.cardPayloadRef, `${field}.cardPayloadRef`, issues);
  requireOneOf(value.action, ["reservation_confirm"], `${field}.action`, issues);
  if (!canBuildOperationRef(value)) return undefined;
  return {
    type: "pmsPendingAction",
    tenantId: value.tenantId,
    pendingActionId: value.pendingActionId,
    ...(typeof value.pendingActionRef === "string" ? { pendingActionRef: value.pendingActionRef } : {}),
    cardPayloadRef: value.cardPayloadRef,
    action: "reservation_confirm"
  };
}

function parseActions(input: unknown, field: string, issues: string[]): ActionCardAction[] {
  if (!Array.isArray(input) || input.length === 0) {
    issues.push(`${field} must be a non-empty array`);
    return [];
  }
  return input.flatMap((item, index) => {
    const value = asRecord(item);
    if (!value) {
      issues.push(`${field}[${index}] must be an object`);
      return [];
    }
    requireNonEmptyString(value.id, `${field}[${index}].id`, issues);
    requireNonEmptyString(value.label, `${field}[${index}].label`, issues);
    requireOneOf(value.kind, actionKinds, `${field}[${index}].kind`, issues);
    requireOptionalBoolean(value.disabled, `${field}[${index}].disabled`, issues);
    requireOptionalBoolean(value.confirmationRequired, `${field}[${index}].confirmationRequired`, issues);
    if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.kind !== "string" || !actionKinds.includes(value.kind as ActionCardActionKind)) return [];
    return [{
      id: value.id,
      label: value.label,
      kind: value.kind as ActionCardActionKind,
      ...(typeof value.disabled === "boolean" ? { disabled: value.disabled } : {}),
      ...(typeof value.confirmationRequired === "boolean" ? { confirmationRequired: value.confirmationRequired } : {})
    }];
  });
}

function canBuildOperationRef(value: Record<string, unknown>): value is Record<string, string> {
  return value.type === "pmsPendingAction"
    && typeof value.tenantId === "string"
    && value.tenantId.trim().length > 0
    && typeof value.pendingActionId === "string"
    && value.pendingActionId.trim().length > 0
    && typeof value.cardPayloadRef === "string"
    && value.cardPayloadRef.trim().length > 0
    && value.action === "reservation_confirm";
}

function canBuildActionCard(value: Record<string, unknown>, actions: readonly ActionCardAction[]): value is Record<string, string> {
  return typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.summary === "string"
    && typeof value.mutationStatus === "string"
    && typeof value.confirmationMode === "string"
    && mutationStatuses.includes(value.mutationStatus as MutationStatus)
    && confirmationModes.includes(value.confirmationMode as ConfirmationMode)
    && actions.length > 0;
}
