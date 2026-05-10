import type { PmsEvidence } from "./evidence.js";
import { availabilityRequestBody, propertyScopedRequestBody } from "./client-request-bodies.js";
import { availabilitySummary, capabilitySummary, hotelProfileSummary, roomTypeCatalogSummary } from "./client-summaries.js";
import { type ClientOptions, requestEvidence, requestOperational, validateInput } from "./client-core.js";
import {
  parseAvailabilitySearchResult,
  parseCapabilityManifest,
  parseHealthResult,
  parseHotelProfileResult,
  parseReservationFact,
  parseRoomFact,
  parseRoomTypeCatalogResult,
  validateGetReservationInput,
  validateGetRoomInput,
  validateHotelProfileInput,
  validateRoomTypeCatalogInput,
  validateSearchAvailabilityInput,
  validateTenantScopedInput,
  type AvailabilitySearchResult,
  type GetReservationInput,
  type GetRoomInput,
  type HealthResult,
  type HotelProfileInput,
  type HotelProfileResult,
  type PmsCapabilityManifest,
  type ReservationFact,
  type RoomFact,
  type RoomTypeCatalogInput,
  type RoomTypeCatalogResult,
  type SearchAvailabilityInput
} from "./schemas.js";

export type PmsReadClientMethods = {
  health(): Promise<HealthResult>;
  capabilitiesManifest(input: { tenantId: string }): Promise<PmsEvidence<PmsCapabilityManifest>>;
  hotelProfile(input: HotelProfileInput): Promise<PmsEvidence<HotelProfileResult>>;
  roomTypeCatalog(input: RoomTypeCatalogInput): Promise<PmsEvidence<RoomTypeCatalogResult>>;
  searchAvailability(input: SearchAvailabilityInput): Promise<PmsEvidence<AvailabilitySearchResult>>;
  getRoom(input: GetRoomInput): Promise<PmsEvidence<RoomFact>>;
  getReservation(input: GetReservationInput): Promise<PmsEvidence<ReservationFact>>;
};

export function createPmsReadClientMethods(options: ClientOptions): PmsReadClientMethods {
  return {
    health: () => requestOperational(options, { method: "GET", route: "/health" }, "health", parseHealthResult),
    capabilitiesManifest: (input) => {
      validateInput("capabilitiesManifest", () => validateTenantScopedInput(input));
      return requestEvidence(options, "capabilitiesManifest", input.tenantId, { method: "GET", route: "/v1/pms/capabilities/manifest" }, parseCapabilityManifest, capabilitySummary);
    },
    hotelProfile: (input) => {
      validateInput("hotelProfile", () => validateHotelProfileInput(input));
      return requestEvidence(options, "hotelProfile", input.tenantId, { method: "POST", route: "/v1/pms/hotel/profile", body: propertyScopedRequestBody("pms_hotel_profile", input) }, parseHotelProfileResult, hotelProfileSummary);
    },
    roomTypeCatalog: (input) => {
      validateInput("roomTypeCatalog", () => validateRoomTypeCatalogInput(input));
      return requestEvidence(options, "roomTypeCatalog", input.tenantId, { method: "POST", route: "/v1/pms/room-types/catalog", body: propertyScopedRequestBody("pms_room_type_catalog", input) }, parseRoomTypeCatalogResult, roomTypeCatalogSummary);
    },
    searchAvailability: (input) => {
      validateInput("searchAvailability", () => validateSearchAvailabilityInput(input));
      return requestEvidence(options, "searchAvailability", input.tenantId, { method: "POST", route: "/v1/pms/availability/search", body: availabilityRequestBody(input) }, parseAvailabilitySearchResult, availabilitySummary);
    },
    getRoom: (input) => {
      validateInput("getRoom", () => validateGetRoomInput(input));
      return requestEvidence(options, "getRoom", input.tenantId, { method: "POST", route: "/v1/pms/room", body: input }, parseRoomFact, () => "Room facts returned from PMS Platform.");
    },
    getReservation: (input) => {
      validateInput("getReservation", () => validateGetReservationInput(input));
      return requestEvidence(options, "getReservation", input.tenantId, { method: "POST", route: "/v1/pms/reservations/get", body: input }, parseReservationFact, () => "Reservation facts returned from PMS Platform.");
    }
  };
}
