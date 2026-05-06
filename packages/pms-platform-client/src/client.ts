import { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod } from "./evidence.js";
import {
  parseAvailabilitySearchResult,
  parseCapabilityManifest,
  parseHealthResult,
  parsePendingActionStatusFact,
  parseReservationConfirmPreparation,
  parseReservationDraftFact,
  parseReservationFact,
  parseReservationQuoteFact,
  parseRoomFact,
  validateCreateReservationDraftInput,
  validateGetReservationInput,
  validateGetRoomInput,
  validatePendingActionStatusInput,
  validatePrepareReservationConfirmInput,
  validateQuoteReservationDraftInput,
  validateSearchAvailabilityInput,
  validateTenantScopedInput,
  validateUpdateReservationDraftInput,
  type AvailabilitySearchResult,
  type CreateReservationDraftInput,
  type GetReservationInput,
  type GetRoomInput,
  type HealthResult,
  type PendingActionStatusFact,
  type PendingActionStatusInput,
  type PmsCapabilityManifest,
  type PrepareReservationConfirmInput,
  type QuoteReservationDraftInput,
  type ReservationConfirmPreparation,
  type ReservationDraftFact,
  type ReservationFact,
  type ReservationQuoteFact,
  type RoomFact,
  type SearchAvailabilityInput,
  type UpdateReservationDraftInput
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
      return requestEvidence(options, now, "createReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/create", body: input }, parseReservationDraftFact, () => "Reservation draft evidence returned without production mutation.");
    },
    updateReservationDraft: (input) => {
      validateInput("updateReservationDraft", () => validateUpdateReservationDraftInput(input));
      return requestEvidence(options, now, "updateReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/update", body: input }, parseReservationDraftFact, () => "Reservation draft update evidence returned without production mutation.");
    },
    quoteReservationDraft: (input) => {
      validateInput("quoteReservationDraft", () => validateQuoteReservationDraftInput(input));
      return requestEvidence(options, now, "quoteReservationDraft", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/quote", body: input }, parseReservationQuoteFact, () => "Reservation quote facts returned from PMS Platform.");
    },
    prepareReservationConfirm: (input) => {
      validateInput("prepareReservationConfirm", () => validatePrepareReservationConfirmInput(input));
      return requestEvidence(options, now, "prepareReservationConfirm", input.tenantId, { method: "POST", route: "/v1/pms/reservation-drafts/prepare-confirm", body: input }, parseReservationConfirmPreparation, () => "Typed approval is required before PMS confirmation; no mutation executed.");
    },
    pendingActionStatus: (input) => {
      validateInput("pendingActionStatus", () => validatePendingActionStatusInput(input));
      return requestEvidence(options, now, "pendingActionStatus", input.tenantId, { method: "POST", route: "/v1/pms/pending-actions/status", body: input }, parsePendingActionStatusFact, () => "Pending action status facts returned from PMS Platform.");
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
  return {
    ...input,
    startDate: input.checkInDate,
    endDate: input.checkOutDate,
    ...(input.roomType ? { roomTypeKeyword: input.roomType } : {})
  };
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
