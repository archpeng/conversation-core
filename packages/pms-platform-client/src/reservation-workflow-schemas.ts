import { assertLiteral, assertRecord, assertText, isPlainRecord } from "./schema-assertions.js";
import { validateTenantScopedInput } from "./tenant-schemas.js";

export type CreateReservationDraftInput = {
  tenantId: string;
  propertyId?: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type UpdateReservationDraftInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
  patch: Record<string, unknown>;
  sourceEvidenceRef?: string;
};

export type ReservationDraftFact = {
  draftId?: string;
  draftRef?: string;
  status: string;
};

export type QuoteReservationDraftInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
};

export type ReservationQuoteFact = {
  quoteId?: string;
  quoteRef?: string;
  totalCents?: number;
  currency?: string;
  status?: string;
};

export type PrepareReservationConfirmInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
  quoteRef?: string;
};

export type ReservationConfirmPreparation = {
  pendingActionId: string;
  pendingActionRef?: string;
  confirmationMode: "typedCardOnly";
  mutationStatus: "none";
  quoteRef?: string;
  cardPayloadRef?: string;
  selectionCount?: number;
  status?: string;
  expiresAt?: string;
};

export type ReservationGroupRoomSelection = {
  roomId: string;
  selectedCandidateRef: string;
  roomTypeId?: string;
  roomType?: string;
};

export type CreateReservationGroupDraftInput = {
  tenantId: string;
  propertyId?: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type UpdateReservationGroupDraftInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
  selections: readonly ReservationGroupRoomSelection[];
  sourceEvidenceRef?: string;
};

export type ReservationGroupDraftFact = {
  groupDraftId?: string;
  groupDraftRef?: string;
  status: string;
};

export type QuoteReservationGroupDraftInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
};

export type ReservationGroupQuoteFact = {
  quoteRef?: string;
  status?: string;
};

export type PrepareReservationGroupConfirmInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
  quoteRef?: string;
};

export type PendingActionStatusInput = {
  tenantId: string;
  pendingActionId?: string;
  pendingActionRef?: string;
  cardPayloadRef?: string;
};

export type PendingActionStatusFact = {
  pendingActionId: string;
  status: "pending" | "awaitingConfirmation" | "confirmed" | "cancelled" | "expired";
};

export function validateCreateReservationDraftInput(input: CreateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.roomId, "roomId");
  assertText(input.guestName, "guestName");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
}

export function validateUpdateReservationDraftInput(input: UpdateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
  assertRecord(input.patch, "patch");
}

export function validateQuoteReservationDraftInput(input: QuoteReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
}

export function validatePrepareReservationConfirmInput(input: PrepareReservationConfirmInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
}

export function validateCreateReservationGroupDraftInput(input: CreateReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.guestName, "guestName");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
  if (!Number.isInteger(input.quantity) || input.quantity < 2) throw new Error("quantity must be an integer greater than one");
}

export function validateUpdateReservationGroupDraftInput(input: UpdateReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
  if (!Array.isArray(input.selections) || input.selections.length < 2) throw new Error("selections must contain at least two rooms");
  input.selections.forEach((selection, index) => {
    assertText(selection.roomId, `selections[${index}].roomId`);
    assertText(selection.selectedCandidateRef, `selections[${index}].selectedCandidateRef`);
  });
}

export function validateQuoteReservationGroupDraftInput(input: QuoteReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
}

export function validatePrepareReservationGroupConfirmInput(input: PrepareReservationGroupConfirmInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
  assertText(input.quoteRef, "quoteRef");
}

export function validatePendingActionStatusInput(input: PendingActionStatusInput): void {
  validateTenantScopedInput(input);
  assertText(input.pendingActionId ?? input.pendingActionRef, "pendingActionId");
}

export function parseReservationDraftFact(value: unknown): ReservationDraftFact {
  const object = assertRecord(value, "draft response");
  if (typeof object.draftId === "string" && object.draftId.trim()) {
    return { draftId: object.draftId, status: assertText(object.status, "status") };
  }
  const draft = assertRecord(object.draft, "draft");
  return {
    draftRef: assertText(draft.draftRef, "draft.draftRef"),
    ...(typeof draft.draftId === "string" && draft.draftId.trim() ? { draftId: draft.draftId } : {}),
    status: assertText(draft.status, "draft.status")
  };
}

export function parseReservationQuoteFact(value: unknown): ReservationQuoteFact {
  const object = assertRecord(value, "quote response");
  if (typeof object.quoteId === "string" && object.quoteId.trim()) {
    const parsed: ReservationQuoteFact = { quoteId: object.quoteId };
    if (typeof object.totalCents === "number") parsed.totalCents = object.totalCents;
    if (typeof object.currency === "string" && object.currency.trim()) parsed.currency = object.currency;
    return parsed;
  }
  const draft = assertRecord(object.draft, "draft");
  const quote = assertRecord(draft.quote, "draft.quote");
  return {
    quoteRef: assertText(quote.quoteRef, "draft.quote.quoteRef"),
    ...(typeof quote.status === "string" && quote.status.trim() ? { status: quote.status } : {})
  };
}

export function parseReservationConfirmPreparation(value: unknown): ReservationConfirmPreparation {
  const object = assertRecord(value, "prepare-confirm response");
  if (typeof object.pendingActionId === "string" && object.pendingActionId.trim()) {
    const result: ReservationConfirmPreparation = {
      pendingActionId: object.pendingActionId,
      pendingActionRef: object.pendingActionId,
      confirmationMode: assertLiteral(object.confirmationMode, "typedCardOnly", "confirmationMode"),
      mutationStatus: assertLiteral(object.mutationStatus, "none", "mutationStatus")
    };
    if (typeof object.expiresAt === "string" && object.expiresAt.length > 0) result.expiresAt = object.expiresAt;
    if (typeof object.selectionCount === "number") result.selectionCount = object.selectionCount;
    return result;
  }
  const draft = assertRecord(object.draft, "draft");
  const pendingAction = assertRecord(draft.pendingAction, "draft.pendingAction");
  const result: ReservationConfirmPreparation = {
    pendingActionId: assertText(pendingAction.pendingActionRef, "draft.pendingAction.pendingActionRef"),
    pendingActionRef: assertText(pendingAction.pendingActionRef, "draft.pendingAction.pendingActionRef"),
    confirmationMode: assertLiteral(pendingAction.confirmationMode, "typedCardOnly", "draft.pendingAction.confirmationMode"),
    mutationStatus: assertLiteral(pendingAction.mutationStatus, "none", "draft.pendingAction.mutationStatus")
  };
  if (typeof pendingAction.expiresAt === "string" && pendingAction.expiresAt.length > 0) result.expiresAt = pendingAction.expiresAt;
  if (typeof pendingAction.quoteRef === "string" && pendingAction.quoteRef.trim()) result.quoteRef = pendingAction.quoteRef;
  if (typeof pendingAction.cardPayloadRef === "string" && pendingAction.cardPayloadRef.trim()) result.cardPayloadRef = pendingAction.cardPayloadRef;
  if (typeof pendingAction.selectionCount === "number") result.selectionCount = pendingAction.selectionCount;
  if (typeof pendingAction.status === "string" && pendingAction.status.trim()) result.status = pendingAction.status;
  return result;
}

export function parseReservationGroupDraftFact(value: unknown): ReservationGroupDraftFact {
  const object = assertRecord(value, "group draft response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  return {
    groupDraftRef: assertText(groupDraft.groupDraftRef, "groupDraft.groupDraftRef"),
    ...(typeof groupDraft.groupDraftId === "string" && groupDraft.groupDraftId.trim() ? { groupDraftId: groupDraft.groupDraftId } : {}),
    status: assertText(groupDraft.status, "groupDraft.status")
  };
}

export function parseReservationGroupQuoteFact(value: unknown): ReservationGroupQuoteFact {
  const object = assertRecord(value, "group quote response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  const quote = assertRecord(groupDraft.quote, "groupDraft.quote");
  return {
    quoteRef: assertText(quote.quoteRef, "groupDraft.quote.quoteRef"),
    ...(typeof quote.status === "string" && quote.status.trim() ? { status: quote.status } : {})
  };
}

export function parseReservationGroupConfirmPreparation(value: unknown): ReservationConfirmPreparation {
  const object = assertRecord(value, "group prepare-confirm response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  const pendingAction = assertRecord(groupDraft.pendingAction, "groupDraft.pendingAction");
  const pendingActionRef = assertText(pendingAction.pendingActionRef, "groupDraft.pendingAction.pendingActionRef");
  const result: ReservationConfirmPreparation = {
    pendingActionId: pendingActionRef,
    pendingActionRef,
    confirmationMode: assertLiteral(pendingAction.confirmationMode, "typedCardOnly", "groupDraft.pendingAction.confirmationMode"),
    mutationStatus: assertLiteral(pendingAction.mutationStatus, "none", "groupDraft.pendingAction.mutationStatus")
  };
  if (typeof pendingAction.expiresAt === "string" && pendingAction.expiresAt.length > 0) result.expiresAt = pendingAction.expiresAt;
  if (typeof pendingAction.quoteRef === "string" && pendingAction.quoteRef.trim()) result.quoteRef = pendingAction.quoteRef;
  if (typeof pendingAction.cardPayloadRef === "string" && pendingAction.cardPayloadRef.trim()) result.cardPayloadRef = pendingAction.cardPayloadRef;
  if (typeof pendingAction.selectionCount === "number") result.selectionCount = pendingAction.selectionCount;
  if (typeof pendingAction.status === "string" && pendingAction.status.trim()) result.status = pendingAction.status;
  return result;
}

export function parsePendingActionStatusFact(value: unknown): PendingActionStatusFact {
  const object = assertRecord(value, "pending-action response");
  const pendingAction = isPlainRecord(object.pendingAction) ? object.pendingAction : object;
  const status = pendingAction.status;
  if (status !== "pending" && status !== "awaitingConfirmation" && status !== "confirmed" && status !== "cancelled" && status !== "expired") {
    throw new Error("status is invalid");
  }
  return {
    pendingActionId: assertText(pendingAction.pendingActionId ?? pendingAction.pendingActionRef, "pendingActionId"),
    status
  };
}

function assertDraftIdentifier(input: { draftId?: string; draftRef?: string }): void {
  assertText(input.draftId ?? input.draftRef, "draftId");
}

function assertGroupDraftIdentifier(input: { groupDraftId?: string; groupDraftRef?: string }): void {
  assertText(input.groupDraftId ?? input.groupDraftRef, "groupDraftId");
}
