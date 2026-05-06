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
  GetReservationInput,
  GetRoomInput,
  HealthResult,
  PendingActionStatusFact,
  PendingActionStatusInput,
  PmsCapabilityManifest,
  PrepareReservationConfirmInput,
  ReservationConfirmPreparation,
  ReservationDraftFact,
  ReservationFact,
  ReservationQuoteFact,
  RoomAvailability,
  RoomFact,
  SearchAvailabilityInput,
  UpdateReservationDraftInput
} from "./schemas.js";
