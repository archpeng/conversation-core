import { createPmsReadClientMethods, type PmsReadClientMethods } from "./client-read-methods.js";
import { createPmsWorkflowClientMethods, type PmsWorkflowClientMethods } from "./client-workflow-methods.js";
import {
  inventorySummaryMethod,
  reservationLookupMethod,
  roomReservationContextMethod,
  todayArrivalsMethod,
  todayDeparturesMethod
} from "./inventory-client.js";
import type { PmsEvidence } from "./evidence.js";
import type {
  InventorySummaryInput,
  InventorySummaryResult,
  RoomReservationContextInput,
  RoomReservationContextResult,
  TodayArrivalsInput,
  TodayArrivalsResult,
  TodayDeparturesInput,
  TodayDeparturesResult
} from "./inventory-schemas.js";
import type { GetReservationInput, ReservationFact } from "./schemas.js";
import type { ClientOptions, PmsPlatformClientOptions } from "./client-core.js";

export {
  isPmsWorkflowRejectedResult,
  PmsPlatformClientError,
  PmsPlatformRejectedError,
  workflowRejectionSummary,
  type PmsFetch,
  type PmsFetchResponse,
  type PmsPlatformApiError,
  type PmsPlatformClientOptions,
  type PmsWorkflowRejectedResult
} from "./client-core.js";

export type PmsInventoryClientMethods = {
  inventorySummary(input: InventorySummaryInput): Promise<PmsEvidence<InventorySummaryResult>>;
  roomReservationContext(input: RoomReservationContextInput): Promise<PmsEvidence<RoomReservationContextResult>>;
  todayArrivals(input: TodayArrivalsInput): Promise<PmsEvidence<TodayArrivalsResult>>;
  todayDepartures(input: TodayDeparturesInput): Promise<PmsEvidence<TodayDeparturesResult>>;
  reservationLookup(input: GetReservationInput): Promise<PmsEvidence<ReservationFact>>;
};

export type PmsPlatformClient =
  & PmsReadClientMethods
  & PmsWorkflowClientMethods
  & PmsInventoryClientMethods;

export function createPmsPlatformClient(options: PmsPlatformClientOptions): PmsPlatformClient {
  const clientOptions: ClientOptions = {
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    now: options.now ?? (() => new Date()),
    authToken: options.authToken
  };

  return {
    ...createPmsReadClientMethods(clientOptions),
    ...createPmsWorkflowClientMethods(clientOptions),
    inventorySummary: (input) => inventorySummaryMethod(clientOptions, input),
    roomReservationContext: (input) => roomReservationContextMethod(clientOptions, input),
    todayArrivals: (input) => todayArrivalsMethod(clientOptions, input),
    todayDepartures: (input) => todayDeparturesMethod(clientOptions, input),
    reservationLookup: (input) => reservationLookupMethod(clientOptions, input)
  };
}
