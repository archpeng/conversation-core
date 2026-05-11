export {
  createPmsPlatformClient,
  PmsPlatformClientError,
  PmsPlatformRejectedError,
  isPmsWorkflowRejectedResult,
  workflowRejectionSummary,
  type PmsFetch,
  type PmsFetchResponse,
  type PmsPlatformApiError,
  type PmsPlatformClient,
  type PmsPlatformClientOptions,
  type PmsWorkflowRejectedResult
} from "./client.js";

export { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod, type PmsEvidenceScope, type PmsEvidenceSource } from "./evidence.js";

export type {
  AvailabilitySearchResult,
  CancelPendingActionInput,
  ConfirmPendingActionInput,
  CreateReservationDraftInput,
  CreateReservationGroupDraftInput,
  GetReservationInput,
  GetRoomInput,
  HealthResult,
  HotelProfileInput,
  HotelProfileResult,
  PendingActionCallbackActor,
  PendingActionCallbackFact,
  PendingActionCallbackInput,
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
  RoomTypeCatalogInput,
  RoomTypeCatalogItem,
  RoomTypeCatalogResult,
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
