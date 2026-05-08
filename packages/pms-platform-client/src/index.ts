export {
  createPmsPlatformClient,
  PmsPlatformClientError,
  type PmsFetch,
  type PmsFetchResponse,
  type PmsPlatformClient,
  type PmsPlatformClientOptions
} from "./client.js";

export { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod, type PmsEvidenceScope, type PmsEvidenceSource } from "./evidence.js";

export type {
  AvailabilitySearchResult,
  CreateReservationDraftInput,
  CreateReservationGroupDraftInput,
  GetReservationInput,
  GetRoomInput,
  HealthResult,
  PendingActionStatusFact,
  PendingActionStatusInput,
  PmsCapabilityManifest,
  PrepareReservationConfirmInput,
  PrepareReservationGroupConfirmInput,
  QuoteReservationGroupDraftInput,
  ReservationConfirmPreparation,
  ReservationDraftFact,
  ReservationFact,
  ReservationGroupDraftFact,
  ReservationGroupQuoteFact,
  ReservationGroupRoomSelection,
  ReservationQuoteFact,
  RoomAvailability,
  RoomFact,
  SearchAvailabilityInput,
  UpdateReservationDraftInput,
  UpdateReservationGroupDraftInput
} from "./schemas.js";

export type {
  InventorySummaryInput,
  InventorySummaryResult,
  RoomReservationContextInput,
  RoomReservationContextResult,
  TodayArrivalsInput,
  TodayArrivalsResult,
  TodayDeparturesInput,
  TodayDeparturesResult
} from "./inventory-schemas.js";

export {
  inventorySummary,
  roomReservationContextSummary,
  todayArrivalsSummary,
  todayDeparturesSummary,
  parseInventorySummaryResult,
  parseRoomReservationContextResult,
  parseTodayArrivalsResult,
  parseTodayDeparturesResult,
  validateInventorySummaryInput,
  validateRoomReservationContextInput,
  validateTodayArrivalsInput,
  validateTodayDeparturesInput
} from "./inventory-schemas.js";

