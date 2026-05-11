import type { PmsEvidence } from "./evidence.js";
import {
  cancelPendingActionRequestBody,
  confirmPendingActionRequestBody,
  createReservationDraftRequestBody,
  createReservationGroupDraftRequestBody,
  pendingActionStatusRequestBody,
  reservationGroupWorkflowRequestBody,
  reservationWorkflowRequestBody,
  updateReservationDraftRequestBody,
  updateReservationGroupDraftRequestBody
} from "./client-request-bodies.js";
import { type ClientOptions, requestEvidence, validateInput } from "./client-core.js";
import {
  parsePendingActionStatusFact,
  parsePendingActionCallbackFact,
  parseReservationConfirmPreparation,
  parseReservationDraftFact,
  parseReservationGroupConfirmPreparation,
  parseReservationGroupDraftFact,
  parseReservationGroupQuoteFact,
  parseReservationQuoteFact,
  validateCancelPendingActionInput,
  validateConfirmPendingActionInput,
  validateCreateReservationDraftInput,
  validateCreateReservationGroupDraftInput,
  validatePendingActionStatusInput,
  validatePrepareReservationConfirmInput,
  validatePrepareReservationGroupConfirmInput,
  validateQuoteReservationDraftInput,
  validateQuoteReservationGroupDraftInput,
  validateUpdateReservationDraftInput,
  validateUpdateReservationGroupDraftInput,
  type CancelPendingActionInput,
  type ConfirmPendingActionInput,
  type CreateReservationDraftInput,
  type CreateReservationGroupDraftInput,
  type PendingActionCallbackFact,
  type PendingActionStatusFact,
  type PendingActionStatusInput,
  type PrepareReservationConfirmInput,
  type PrepareReservationGroupConfirmInput,
  type QuoteReservationDraftInput,
  type QuoteReservationGroupDraftInput,
  type ReservationConfirmPreparation,
  type ReservationDraftFact,
  type ReservationGroupDraftFact,
  type ReservationGroupQuoteFact,
  type ReservationQuoteFact,
  type UpdateReservationDraftInput,
  type UpdateReservationGroupDraftInput
} from "./schemas.js";

export type PmsWorkflowClientMethods = {
  createReservationDraft(input: CreateReservationDraftInput): Promise<PmsEvidence<ReservationDraftFact>>;
  updateReservationDraft(input: UpdateReservationDraftInput): Promise<PmsEvidence<ReservationDraftFact>>;
  quoteReservationDraft(input: QuoteReservationDraftInput): Promise<PmsEvidence<ReservationQuoteFact>>;
  prepareReservationConfirm(input: PrepareReservationConfirmInput): Promise<PmsEvidence<ReservationConfirmPreparation>>;
  createReservationGroupDraft(input: CreateReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupDraftFact>>;
  updateReservationGroupDraft(input: UpdateReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupDraftFact>>;
  quoteReservationGroupDraft(input: QuoteReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupQuoteFact>>;
  prepareReservationGroupConfirm(input: PrepareReservationGroupConfirmInput): Promise<PmsEvidence<ReservationConfirmPreparation>>;
  pendingActionStatus(input: PendingActionStatusInput): Promise<PmsEvidence<PendingActionStatusFact>>;
  confirmPendingAction(input: ConfirmPendingActionInput): Promise<PmsEvidence<PendingActionCallbackFact>>;
  cancelPendingAction(input: CancelPendingActionInput): Promise<PmsEvidence<PendingActionCallbackFact>>;
};

export function createPmsWorkflowClientMethods(options: ClientOptions): PmsWorkflowClientMethods {
  return {
    createReservationDraft: (input) => {
      validateInput("createReservationDraft", () => validateCreateReservationDraftInput(input));
      return requestEvidence(options, "createReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/create", body: createReservationDraftRequestBody(input, options.now) }, parseReservationDraftFact, () => "Reservation draft evidence returned without production mutation.");
    },
    updateReservationDraft: (input) => {
      validateInput("updateReservationDraft", () => validateUpdateReservationDraftInput(input));
      return requestEvidence(options, "updateReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/update", body: updateReservationDraftRequestBody(input, options.now) }, parseReservationDraftFact, () => "Reservation draft update evidence returned without production mutation.");
    },
    quoteReservationDraft: (input) => {
      validateInput("quoteReservationDraft", () => validateQuoteReservationDraftInput(input));
      return requestEvidence(options, "quoteReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/quote", body: reservationWorkflowRequestBody("pms.reservation.quote", input, options.now) }, parseReservationQuoteFact, () => "Reservation quote facts returned from PMS Platform.");
    },
    prepareReservationConfirm: (input) => {
      validateInput("prepareReservationConfirm", () => validatePrepareReservationConfirmInput(input));
      return requestEvidence(options, "prepareReservationConfirm", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/prepare-confirm", body: reservationWorkflowRequestBody("pms.reservation.prepare_confirm", input, options.now) }, parseReservationConfirmPreparation, () => "Typed approval is required before PMS confirmation; no mutation executed.");
    },
    createReservationGroupDraft: (input) => {
      validateInput("createReservationGroupDraft", () => validateCreateReservationGroupDraftInput(input));
      return requestEvidence(options, "createReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/create", body: createReservationGroupDraftRequestBody(input, options.now) }, parseReservationGroupDraftFact, () => "Reservation group draft evidence returned without production mutation.");
    },
    updateReservationGroupDraft: (input) => {
      validateInput("updateReservationGroupDraft", () => validateUpdateReservationGroupDraftInput(input));
      return requestEvidence(options, "updateReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/update", body: updateReservationGroupDraftRequestBody(input, options.now) }, parseReservationGroupDraftFact, () => "Reservation group draft update evidence returned without production mutation.");
    },
    quoteReservationGroupDraft: (input) => {
      validateInput("quoteReservationGroupDraft", () => validateQuoteReservationGroupDraftInput(input));
      return requestEvidence(options, "quoteReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/quote", body: reservationGroupWorkflowRequestBody("pms.reservation.group_quote", input, options.now) }, parseReservationGroupQuoteFact, () => "Reservation group quote facts returned from PMS Platform.");
    },
    prepareReservationGroupConfirm: (input) => {
      validateInput("prepareReservationGroupConfirm", () => validatePrepareReservationGroupConfirmInput(input));
      return requestEvidence(options, "prepareReservationGroupConfirm", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/prepare-confirm", body: reservationGroupWorkflowRequestBody("pms.reservation.group_prepare_confirm", input, options.now) }, parseReservationGroupConfirmPreparation, () => "Typed group approval is required before PMS confirmation; no final reservation mutation executed.");
    },
    pendingActionStatus: (input) => {
      validateInput("pendingActionStatus", () => validatePendingActionStatusInput(input));
      return requestEvidence(options, "pendingActionStatus", input.tenantId, { method: "POST", route: "/v1/pms/pending-actions/status", body: pendingActionStatusRequestBody(input, options.now) }, parsePendingActionStatusFact, () => "Pending action status facts returned from PMS Platform.");
    },
    confirmPendingAction: (input) => {
      validateInput("confirmPendingAction", () => validateConfirmPendingActionInput(input));
      return requestEvidence(options, "confirmPendingAction", input.tenantId, { method: "POST", route: "/v1/pms/pending-actions/confirm", body: confirmPendingActionRequestBody(input, options.now) }, parsePendingActionCallbackFact, (fact) => `Pending action ${fact.pendingActionId} confirmed with ${fact.mutationStatus} mutation status.`);
    },
    cancelPendingAction: (input) => {
      validateInput("cancelPendingAction", () => validateCancelPendingActionInput(input));
      return requestEvidence(options, "cancelPendingAction", input.tenantId, { method: "POST", route: "/v1/pms/pending-actions/cancel", body: cancelPendingActionRequestBody(input, options.now) }, parsePendingActionCallbackFact, (fact) => `Pending action ${fact.pendingActionId} cancelled with ${fact.mutationStatus} mutation status.`);
    }
  };
}
