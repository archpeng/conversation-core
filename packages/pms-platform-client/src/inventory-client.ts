import {
  inventorySummary as buildInventorySummary,
  parseInventorySummaryResult,
  parseRoomReservationContextResult,
  parseTodayArrivalsResult,
  parseTodayDeparturesResult,
  roomReservationContextSummary,
  todayArrivalsSummary,
  todayDeparturesSummary,
  validateInventorySummaryInput,
  validateRoomReservationContextInput,
  validateTodayArrivalsInput,
  validateTodayDeparturesInput,
  type InventorySummaryInput,
  type InventorySummaryResult,
  type RoomReservationContextInput,
  type RoomReservationContextResult,
  type TodayArrivalsInput,
  type TodayArrivalsResult,
  type TodayDeparturesInput,
  type TodayDeparturesResult
} from "./inventory-schemas.js";
import { parseReservationFact, validateGetReservationInput, type GetReservationInput, type ReservationFact } from "./schemas.js";
import { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod } from "./evidence.js";

type HttpMethod = "GET" | "POST";
type PmsRoute =
  | "/v1/pms/inventory/summary"
  | "/v1/pms/room/reservation-context"
  | "/v1/pms/arrivals/today"
  | "/v1/pms/departures/today"
  | "/v1/pms/reservations/get";

type RequestPlan = {
  method: HttpMethod;
  route: PmsRoute;
  body?: unknown;
};

export type PmsFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type PmsFetch = (url: string, init: { method: HttpMethod; headers: Record<string, string>; body?: string }) => Promise<PmsFetchResponse>;

export type ClientOptions = {
  baseUrl: string;
  fetch: PmsFetch;
  now: () => Date;
  authToken?: string;
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

function headers(authToken: string | undefined, body: unknown): Record<string, string> {
  return {
    accept: "application/json",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

async function requestOperational<T>(options: ClientOptions, request: RequestPlan, operation: string, parse: (value: unknown) => T): Promise<T> {
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

async function requestEvidence<T>(
  options: ClientOptions,
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
    fetchedAt: options.now().toISOString(),
    data,
    summary: summarize(data)
  });
}

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

export function inventorySummaryMethod(
  options: ClientOptions,
  input: InventorySummaryInput
): Promise<PmsEvidence<InventorySummaryResult>> {
  validateInput("inventorySummary", () => validateInventorySummaryInput(input));
  return requestEvidence(
    options,
    "inventorySummary",
    input.tenantId,
    {
      method: "POST",
      route: "/v1/pms/inventory/summary",
      body: {
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        startDate: input.startDate,
        horizonDays: inclusiveHorizonDays(input.startDate, input.endDate)
      }
    },
    parseInventorySummaryResult,
    buildInventorySummary
  );
}

function inclusiveHorizonDays(startDate: string, endDate: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((isoDateMs(endDate) - isoDateMs(startDate)) / dayMs) + 1;
}

function isoDateMs(value: string): number {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
}

export function roomReservationContextMethod(
  options: ClientOptions,
  input: RoomReservationContextInput
): Promise<PmsEvidence<RoomReservationContextResult>> {
  validateInput("roomReservationContext", () => validateRoomReservationContextInput(input));
  return requestEvidence(
    options,
    "roomReservationContext",
    input.tenantId,
    {
      method: "POST",
      route: "/v1/pms/room/reservation-context",
      body: input
    },
    parseRoomReservationContextResult,
    roomReservationContextSummary
  );
}

export function todayArrivalsMethod(
  options: ClientOptions,
  input: TodayArrivalsInput
): Promise<PmsEvidence<TodayArrivalsResult>> {
  validateInput("todayArrivals", () => validateTodayArrivalsInput(input));
  return requestEvidence(
    options,
    "todayArrivals",
    input.tenantId,
    {
      method: "POST",
      route: "/v1/pms/arrivals/today",
      body: {
        tenantId: input.tenantId,
        businessDate: input.businessDate
      }
    },
    parseTodayArrivalsResult,
    todayArrivalsSummary
  );
}

export function todayDeparturesMethod(
  options: ClientOptions,
  input: TodayDeparturesInput
): Promise<PmsEvidence<TodayDeparturesResult>> {
  validateInput("todayDepartures", () => validateTodayDeparturesInput(input));
  return requestEvidence(
    options,
    "todayDepartures",
    input.tenantId,
    {
      method: "POST",
      route: "/v1/pms/departures/today",
      body: {
        tenantId: input.tenantId,
        businessDate: input.businessDate
      }
    },
    parseTodayDeparturesResult,
    todayDeparturesSummary
  );
}

export function reservationLookupMethod(
  options: ClientOptions,
  input: GetReservationInput
): Promise<PmsEvidence<ReservationFact>> {
  validateInput("reservationLookup", () => validateGetReservationInput(input));
  return requestEvidence(
    options,
    "reservationLookup",
    input.tenantId,
    {
      method: "POST",
      route: "/v1/pms/reservations/get",
      body: input
    },
    parseReservationFact,
    () => "Reservation facts returned from PMS Platform."
  );
}
