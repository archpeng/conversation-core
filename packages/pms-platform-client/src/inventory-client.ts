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
import type { PmsEvidence } from "./evidence.js";
import { requestEvidence, validateInput, type ClientOptions } from "./client-core.js";

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
    buildInventorySummary,
    { parseWorkflowRejection: false }
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
    roomReservationContextSummary,
    { parseWorkflowRejection: false }
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
    todayArrivalsSummary,
    { parseWorkflowRejection: false }
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
    todayDeparturesSummary,
    { parseWorkflowRejection: false }
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
    () => "Reservation facts returned from PMS Platform.",
    { parseWorkflowRejection: false }
  );
}
