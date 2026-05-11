import { validateAgentTask, type AgentTask } from "./agent-task.js";
import { asRecord, requireNonEmptyString, requireOptionalString, type Validation } from "./field-checks.js";

export type ReservationSingleDraftInput = {
  tenantId: string;
  propertyId: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type ReservationGroupDraftInput = {
  tenantId: string;
  propertyId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type ReservationDraftUpdateInput = {
  tenantId: string;
  draftRef?: string;
  draftId?: string;
  patch: Record<string, unknown>;
  sourceEvidenceRef?: string;
};

export type ReservationGroupUpdateInput = {
  tenantId: string;
  groupDraftRef?: string;
  groupDraftId?: string;
  selections: {
    roomId: string;
    selectedCandidateRef: string;
    roomTypeId?: string;
    roomType?: string;
  }[];
  sourceEvidenceRef?: string;
};

export type ReservationWorkflowRefInput = {
  tenantId: string;
  draftRef?: string;
  draftId?: string;
  groupDraftRef?: string;
  groupDraftId?: string;
  quoteRef?: string;
};

export type ReservationWorkflowResponse = {
  ok: true;
  task: AgentTask;
};

export function validateReservationSingleDraftInput(input: unknown): Validation<ReservationSingleDraftInput> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["input must be an object"] };
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireNonEmptyString(value.propertyId, "propertyId", issues);
  requireNonEmptyString(value.roomId, "roomId", issues);
  requireNonEmptyString(value.guestName, "guestName", issues);
  requireNonEmptyString(value.checkInDate, "checkInDate", issues);
  requireNonEmptyString(value.checkOutDate, "checkOutDate", issues);
  requireOptionalString(value.roomType, "roomType", issues);
  requireOptionalString(value.sourceEvidenceRef, "sourceEvidenceRef", issues);
  if (issues.length > 0 || !hasSingleDraftShape(value)) return { ok: false, issues };
  return { ok: true, value };
}

export function validateReservationGroupDraftInput(input: unknown): Validation<ReservationGroupDraftInput> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["input must be an object"] };
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireNonEmptyString(value.propertyId, "propertyId", issues);
  requireNonEmptyString(value.guestName, "guestName", issues);
  requireNonEmptyString(value.checkInDate, "checkInDate", issues);
  requireNonEmptyString(value.checkOutDate, "checkOutDate", issues);
  if (typeof value.quantity !== "number" || !Number.isInteger(value.quantity) || value.quantity < 2) issues.push("quantity must be an integer greater than one");
  requireOptionalString(value.roomType, "roomType", issues);
  requireOptionalString(value.sourceEvidenceRef, "sourceEvidenceRef", issues);
  if (issues.length > 0 || !hasGroupDraftShape(value)) return { ok: false, issues };
  return { ok: true, value };
}

export function validateReservationDraftUpdateInput(input: unknown): Validation<ReservationDraftUpdateInput> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["input must be an object"] };
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireOptionalString(value.draftRef, "draftRef", issues);
  requireOptionalString(value.draftId, "draftId", issues);
  if (!value.draftRef && !value.draftId) issues.push("draftRef or draftId is required");
  if (!asRecord(value.patch)) issues.push("patch must be an object");
  requireOptionalString(value.sourceEvidenceRef, "sourceEvidenceRef", issues);
  if (issues.length > 0 || !hasDraftUpdateShape(value)) return { ok: false, issues };
  return { ok: true, value };
}

export function validateReservationGroupUpdateInput(input: unknown): Validation<ReservationGroupUpdateInput> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["input must be an object"] };
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireOptionalString(value.groupDraftRef, "groupDraftRef", issues);
  requireOptionalString(value.groupDraftId, "groupDraftId", issues);
  if (!value.groupDraftRef && !value.groupDraftId) issues.push("groupDraftRef or groupDraftId is required");
  const selections = parseSelections(value.selections, issues);
  requireOptionalString(value.sourceEvidenceRef, "sourceEvidenceRef", issues);
  if (issues.length > 0 || !hasGroupUpdateShape(value, selections)) return { ok: false, issues };
  return {
    ok: true,
    value: {
      tenantId: value.tenantId,
      ...(typeof value.groupDraftRef === "string" ? { groupDraftRef: value.groupDraftRef } : {}),
      ...(typeof value.groupDraftId === "string" ? { groupDraftId: value.groupDraftId } : {}),
      selections,
      ...(typeof value.sourceEvidenceRef === "string" ? { sourceEvidenceRef: value.sourceEvidenceRef } : {})
    }
  };
}

export function validateReservationWorkflowRefInput(input: unknown): Validation<ReservationWorkflowRefInput> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["input must be an object"] };
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireOptionalString(value.draftRef, "draftRef", issues);
  requireOptionalString(value.draftId, "draftId", issues);
  requireOptionalString(value.groupDraftRef, "groupDraftRef", issues);
  requireOptionalString(value.groupDraftId, "groupDraftId", issues);
  requireOptionalString(value.quoteRef, "quoteRef", issues);
  if (issues.length > 0 || typeof value.tenantId !== "string") return { ok: false, issues };
  return {
    ok: true,
    value: {
      tenantId: value.tenantId,
      ...(typeof value.draftRef === "string" ? { draftRef: value.draftRef } : {}),
      ...(typeof value.draftId === "string" ? { draftId: value.draftId } : {}),
      ...(typeof value.groupDraftRef === "string" ? { groupDraftRef: value.groupDraftRef } : {}),
      ...(typeof value.groupDraftId === "string" ? { groupDraftId: value.groupDraftId } : {}),
      ...(typeof value.quoteRef === "string" ? { quoteRef: value.quoteRef } : {})
    }
  };
}

export function validateReservationWorkflowResponse(input: unknown): Validation<ReservationWorkflowResponse> {
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["response must be an object"] };
  const issues: string[] = [];
  if (value.ok !== true) issues.push("ok must be true");
  const task = validateAgentTask(value.task);
  if (!task.ok) issues.push(...task.issues.map((issue) => `task.${issue}`));
  if (issues.length > 0 || !task.ok) return { ok: false, issues };
  return { ok: true, value: { ok: true, task: task.value } };
}

function parseSelections(input: unknown, issues: string[]): ReservationGroupUpdateInput["selections"] {
  if (!Array.isArray(input) || input.length < 2) {
    issues.push("selections must contain at least two rooms");
    return [];
  }
  return input.flatMap((item, index) => {
    const value = asRecord(item);
    if (!value) {
      issues.push(`selections[${index}] must be an object`);
      return [];
    }
    requireNonEmptyString(value.roomId, `selections[${index}].roomId`, issues);
    requireNonEmptyString(value.selectedCandidateRef, `selections[${index}].selectedCandidateRef`, issues);
    requireOptionalString(value.roomTypeId, `selections[${index}].roomTypeId`, issues);
    requireOptionalString(value.roomType, `selections[${index}].roomType`, issues);
    if (typeof value.roomId !== "string" || typeof value.selectedCandidateRef !== "string") return [];
    return [{
      roomId: value.roomId,
      selectedCandidateRef: value.selectedCandidateRef,
      ...(typeof value.roomTypeId === "string" ? { roomTypeId: value.roomTypeId } : {}),
      ...(typeof value.roomType === "string" ? { roomType: value.roomType } : {})
    }];
  });
}

function hasSingleDraftShape(value: Record<string, unknown>): value is ReservationSingleDraftInput {
  return typeof value.tenantId === "string" && typeof value.propertyId === "string" && typeof value.roomId === "string" && typeof value.guestName === "string" && typeof value.checkInDate === "string" && typeof value.checkOutDate === "string";
}

function hasGroupDraftShape(value: Record<string, unknown>): value is ReservationGroupDraftInput {
  return typeof value.tenantId === "string" && typeof value.propertyId === "string" && typeof value.guestName === "string" && typeof value.checkInDate === "string" && typeof value.checkOutDate === "string" && typeof value.quantity === "number";
}

function hasDraftUpdateShape(value: Record<string, unknown>): value is ReservationDraftUpdateInput {
  return typeof value.tenantId === "string" && Boolean(value.draftRef || value.draftId) && Boolean(asRecord(value.patch));
}

function hasGroupUpdateShape(value: Record<string, unknown>, selections: readonly unknown[]): value is ReservationGroupUpdateInput {
  return typeof value.tenantId === "string" && Boolean(value.groupDraftRef || value.groupDraftId) && selections.length >= 2;
}
