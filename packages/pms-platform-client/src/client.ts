import { createHash } from "node:crypto";
import { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod } from "./evidence.js";
import {
  parseAvailabilitySearchResult,
  parseCapabilityManifest,
  parseHealthResult,
  parsePendingActionStatusFact,
  parseReservationConfirmPreparation,
  parseReservationDraftFact,
  parseReservationFact,
  parseReservationGroupConfirmPreparation,
  parseReservationGroupDraftFact,
  parseReservationGroupQuoteFact,
  parseReservationQuoteFact,
  parseRoomFact,
  validateCreateReservationDraftInput,
  validateCreateReservationGroupDraftInput,
  validateGetReservationInput,
  validateGetRoomInput,
  validatePendingActionStatusInput,
  validatePrepareReservationConfirmInput,
  validatePrepareReservationGroupConfirmInput,
  validateQuoteReservationGroupDraftInput,
  validateQuoteReservationDraftInput,
  validateSearchAvailabilityInput,
  validateTenantScopedInput,
  validateUpdateReservationDraftInput,
  validateUpdateReservationGroupDraftInput,
  type AvailabilitySearchResult,
  type CreateReservationDraftInput,
  type CreateReservationGroupDraftInput,
  type GetReservationInput,
  type GetRoomInput,
  type HealthResult,
  type PendingActionStatusFact,
  type PendingActionStatusInput,
  type PmsCapabilityManifest,
  type PrepareReservationConfirmInput,
  type PrepareReservationGroupConfirmInput,
  type QuoteReservationGroupDraftInput,
  type QuoteReservationDraftInput,
  type ReservationConfirmPreparation,
  type ReservationDraftFact,
  type ReservationFact,
  type ReservationGroupDraftFact,
  type ReservationGroupQuoteFact,
  type ReservationQuoteFact,
  type RoomFact,
  type SearchAvailabilityInput,
  type UpdateReservationDraftInput,
  type UpdateReservationGroupDraftInput
} from "./schemas.js";

type HttpMethod = "GET" | "POST";
type PmsRoute =
  | "/health"
  | "/v1/pms/capabilities/manifest"
  | "/v1/pms/availability/search"
  | "/v1/pms/room"
  | "/v1/pms/reservations/get"
  | "/v1/pms/reservation-drafts/create"
  | "/v1/pms/reservation-drafts/update"
  | "/v1/pms/reservation-drafts/quote"
  | "/v1/pms/reservation-drafts/prepare-confirm"
  | "/v1/pms/reservation-group-drafts/create"
  | "/v1/pms/reservation-group-drafts/update"
  | "/v1/pms/reservation-group-drafts/quote"
  | "/v1/pms/reservation-group-drafts/prepare-confirm"
  | "/v1/pms/pending-actions/status";

type RequestPlan = {
  method: HttpMethod;
  route: PmsRoute;
  body?: unknown;
};

export type PmsFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export type PmsFetch = (url: string, init: { method: HttpMethod; headers: Record<string, string>; body?: string }) => Promise<PmsFetchResponse>;

export type PmsPlatformClientOptions = {
  baseUrl: string;
  fetch: PmsFetch;
  now?: () => Date;
  authToken?: string;
};

export type PmsPlatformClient = {
  health(): Promise<HealthResult>;
  capabilitiesManifest(input: { tenantId: string }): Promise<PmsEvidence<PmsCapabilityManifest>>;
  searchAvailability(input: SearchAvailabilityInput): Promise<PmsEvidence<AvailabilitySearchResult>>;
  getRoom(input: GetRoomInput): Promise<PmsEvidence<RoomFact>>;
  getReservation(input: GetReservationInput): Promise<PmsEvidence<ReservationFact>>;
  createReservationDraft(input: CreateReservationDraftInput): Promise<PmsEvidence<ReservationDraftFact>>;
  updateReservationDraft(input: UpdateReservationDraftInput): Promise<PmsEvidence<ReservationDraftFact>>;
  quoteReservationDraft(input: QuoteReservationDraftInput): Promise<PmsEvidence<ReservationQuoteFact>>;
  prepareReservationConfirm(input: PrepareReservationConfirmInput): Promise<PmsEvidence<ReservationConfirmPreparation>>;
  createReservationGroupDraft(input: CreateReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupDraftFact>>;
  updateReservationGroupDraft(input: UpdateReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupDraftFact>>;
  quoteReservationGroupDraft(input: QuoteReservationGroupDraftInput): Promise<PmsEvidence<ReservationGroupQuoteFact>>;
  prepareReservationGroupConfirm(input: PrepareReservationGroupConfirmInput): Promise<PmsEvidence<ReservationConfirmPreparation>>;
  pendingActionStatus(input: PendingActionStatusInput): Promise<PmsEvidence<PendingActionStatusFact>>;
};

export class PmsPlatformClientError extends Error {
  readonly operation: string;
  readonly status?: number;
  readonly causeCode: "transport_error" | "http_error" | "invalid_response" | "invalid_input";

  constructor(input: { operation: string; causeCode: PmsPlatformClientError["causeCode"]; status?: number; reason: string }) {
    super(`PMS ${input.operation} failed: ${input.reason}`);
    this.name = "PmsPlatformClientError";
    this.operation = input.operation;
    this.status = input.status;
    this.causeCode = input.causeCode;
  }
}

export function createPmsPlatformClient(options: PmsPlatformClientOptions): PmsPlatformClient {
  const now = options.now ?? (() => new Date());

  return {
    health: () => requestOperational(options, { method: "GET", route: "/health" }, "health", parseHealthResult),
    capabilitiesManifest: (input) => {
      validateInput("capabilitiesManifest", () => validateTenantScopedInput(input));
      return requestEvidence(options, now, "capabilitiesManifest", input.tenantId, { method: "GET", route: "/v1/pms/capabilities/manifest" }, parseCapabilityManifest, capabilitySummary);
    },
    searchAvailability: (input) => {
      validateInput("searchAvailability", () => validateSearchAvailabilityInput(input));
      return requestEvidence(options, now, "searchAvailability", input.tenantId, { method: "POST", route: "/v1/pms/availability/search", body: availabilityRequestBody(input) }, parseAvailabilitySearchResult, availabilitySummary);
    },
    getRoom: (input) => {
      validateInput("getRoom", () => validateGetRoomInput(input));
      return requestEvidence(options, now, "getRoom", input.tenantId, { method: "POST", route: "/v1/pms/room", body: input }, parseRoomFact, () => "Room facts returned from PMS Platform.");
    },
    getReservation: (input) => {
      validateInput("getReservation", () => validateGetReservationInput(input));
      return requestEvidence(options, now, "getReservation", input.tenantId, { method: "POST", route: "/v1/pms/reservations/get", body: input }, parseReservationFact, () => "Reservation facts returned from PMS Platform.");
    },
    createReservationDraft: (input) => {
      validateInput("createReservationDraft", () => validateCreateReservationDraftInput(input));
      return requestEvidence(options, now, "createReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/create", body: createReservationDraftRequestBody(input, now) }, parseReservationDraftFact, () => "Reservation draft evidence returned without production mutation.");
    },
    updateReservationDraft: (input) => {
      validateInput("updateReservationDraft", () => validateUpdateReservationDraftInput(input));
      return requestEvidence(options, now, "updateReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/update", body: updateReservationDraftRequestBody(input, now) }, parseReservationDraftFact, () => "Reservation draft update evidence returned without production mutation.");
    },
    quoteReservationDraft: (input) => {
      validateInput("quoteReservationDraft", () => validateQuoteReservationDraftInput(input));
      return requestEvidence(options, now, "quoteReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/quote", body: reservationWorkflowRequestBody("pms.reservation.quote", input, now) }, parseReservationQuoteFact, () => "Reservation quote facts returned from PMS Platform.");
    },
    prepareReservationConfirm: (input) => {
      validateInput("prepareReservationConfirm", () => validatePrepareReservationConfirmInput(input));
      return requestEvidence(options, now, "prepareReservationConfirm", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/prepare-confirm", body: reservationWorkflowRequestBody("pms.reservation.prepare_confirm", input, now) }, parseReservationConfirmPreparation, () => "Typed approval is required before PMS confirmation; no mutation executed.");
    },
    createReservationGroupDraft: (input) => {
      validateInput("createReservationGroupDraft", () => validateCreateReservationGroupDraftInput(input));
      return requestEvidence(options, now, "createReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/create", body: createReservationGroupDraftRequestBody(input, now) }, parseReservationGroupDraftFact, () => "Reservation group draft evidence returned without production mutation.");
    },
    updateReservationGroupDraft: (input) => {
      validateInput("updateReservationGroupDraft", () => validateUpdateReservationGroupDraftInput(input));
      return requestEvidence(options, now, "updateReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/update", body: updateReservationGroupDraftRequestBody(input, now) }, parseReservationGroupDraftFact, () => "Reservation group draft update evidence returned without production mutation.");
    },
    quoteReservationGroupDraft: (input) => {
      validateInput("quoteReservationGroupDraft", () => validateQuoteReservationGroupDraftInput(input));
      return requestEvidence(options, now, "quoteReservationGroupDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/quote", body: reservationGroupWorkflowRequestBody("pms.reservation.group_quote", input, now) }, parseReservationGroupQuoteFact, () => "Reservation group quote facts returned from PMS Platform.");
    },
    prepareReservationGroupConfirm: (input) => {
      validateInput("prepareReservationGroupConfirm", () => validatePrepareReservationGroupConfirmInput(input));
      return requestEvidence(options, now, "prepareReservationGroupConfirm", input.tenantId, { method: "POST", route: "/v1/pms/reservation-group-drafts/prepare-confirm", body: reservationGroupWorkflowRequestBody("pms.reservation.group_prepare_confirm", input, now) }, parseReservationGroupConfirmPreparation, () => "Typed group approval is required before PMS confirmation; no final reservation mutation executed.");
    },
    pendingActionStatus: (input) => {
      validateInput("pendingActionStatus", () => validatePendingActionStatusInput(input));
      return requestEvidence(options, now, "pendingActionStatus", input.tenantId, { method: "POST", route: "/v1/pms/pending-actions/status", body: pendingActionStatusRequestBody(input, now) }, parsePendingActionStatusFact, () => "Pending action status facts returned from PMS Platform.");
    }
  };
}

async function requestEvidence<T>(
  options: PmsPlatformClientOptions,
  now: () => Date,
  operation: PmsEvidenceMethod,
  tenantId: string,
  request: RequestPlan,
  parse: (value: unknown) => T,
  summarize: (value: T) => string
): Promise<PmsEvidence<T>> {
  const data = await requestOperational(options, request, operation, parse);
  return createPmsEvidence({
    method: operation,
    tenantId,
    fetchedAt: now().toISOString(),
    data,
    summary: summarize(data)
  });
}

async function requestOperational<T>(options: PmsPlatformClientOptions, request: RequestPlan, operation: string, parse: (value: unknown) => T): Promise<T> {
  let response: PmsFetchResponse;
  try {
    response = await options.fetch(urlFor(options.baseUrl, request.route), {
      method: request.method,
      headers: headers(options.authToken, request.body),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) })
    });
  } catch {
    throw new PmsPlatformClientError({ operation, causeCode: "transport_error", reason: "transport unavailable" });
  }

  if (!response.ok) {
    throw new PmsPlatformClientError({ operation, causeCode: "http_error", status: response.status, reason: `platform returned HTTP ${response.status}` });
  }

  try {
    return parse(await response.json());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid response";
    throw new PmsPlatformClientError({ operation, causeCode: "invalid_response", reason });
  }
}

function validateInput(operation: string, validate: () => void): void {
  try {
    validate();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid input";
    throw new PmsPlatformClientError({ operation, causeCode: "invalid_input", reason });
  }
}

function urlFor(baseUrl: string, route: PmsRoute): string {
  return `${baseUrl.replace(/\/$/, "")}${route}`;
}

function availabilityRequestBody(input: SearchAvailabilityInput): Record<string, unknown> {
  const { quantity, ...body } = input;
  return {
    ...body,
    startDate: input.checkInDate,
    endDate: input.checkOutDate,
    ...(quantity ? { count: quantity } : {}),
    ...(input.roomType ? { roomTypeKeyword: input.roomType } : {})
  };
}

function createReservationDraftRequestBody(input: CreateReservationDraftInput, now: () => Date): Record<string, unknown> {
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

function updateReservationDraftRequestBody(input: UpdateReservationDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationWorkflowRequestBody("pms.reservation.draft.update", input, now),
    ...(Object.keys(input.patch).length > 0 ? { slots: input.patch } : {}),
    ...(input.sourceEvidenceRef ? { evidenceRefs: [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] } : {})
  };
}

function createReservationGroupDraftRequestBody(input: CreateReservationGroupDraftInput, now: () => Date): Record<string, unknown> {
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

function updateReservationGroupDraftRequestBody(input: UpdateReservationGroupDraftInput, now: () => Date): Record<string, unknown> {
  return {
    ...reservationGroupWorkflowRequestBody("pms.reservation.group_draft.update", input, now),
    slots: { selections: input.selections },
    ...(input.sourceEvidenceRef ? { evidenceRefs: [{ source: "availabilitySearch", refId: input.sourceEvidenceRef }] } : {})
  };
}

function reservationWorkflowRequestBody(operation: string, input: { tenantId: string; propertyId?: string; draftId?: string; draftRef?: string; quoteRef?: string }, now: () => Date): Record<string, unknown> {
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

function reservationGroupWorkflowRequestBody(operation: string, input: { tenantId: string; propertyId?: string; groupDraftId?: string; groupDraftRef?: string; quoteRef?: string }, now: () => Date): Record<string, unknown> {
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

function pendingActionStatusRequestBody(input: PendingActionStatusInput, now: () => Date): Record<string, unknown> {
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

function workflowFingerprint(operation: string, input: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, input })).digest("hex");
}

function operationHash(operation: string): string {
  return createHash("sha256").update(operation).digest("hex").slice(0, 8);
}

function headers(authToken: string | undefined, body: unknown): Record<string, string> {
  return {
    accept: "application/json",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

function capabilitySummary(value: PmsCapabilityManifest): string {
  return `PMS capability manifest returned ${value.capabilities.length} capabilities.`;
}

function availabilitySummary(value: AvailabilitySearchResult): string {
  return `Availability search returned ${value.rooms.length} rooms.`;
}
