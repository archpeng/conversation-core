import type {
  AvailabilitySearchResult,
  HotelProfileResult,
  PmsCapabilityManifest,
  RoomTypeCatalogResult
} from "./schemas.js";

export function capabilitySummary(value: PmsCapabilityManifest): string {
  return `PMS capability manifest returned ${value.capabilities.length} capabilities.`;
}

export function hotelProfileSummary(value: HotelProfileResult): string {
  const roomTypes = roomTypeCatalogParts(value.roomTypes);
  return `Hotel profile returned ${value.propertyName} (${value.propertyId}), timezone ${value.timeZone}, status ${value.status}, ${value.roomTotal} rooms.${roomTypes}`;
}

export function roomTypeCatalogSummary(value: RoomTypeCatalogResult): string {
  const roomTypes = roomTypeCatalogParts(value.roomTypes);
  return `Room type catalog returned ${value.roomTypes.length} active room types.${roomTypes}`;
}

export function availabilitySummary(value: AvailabilitySearchResult): string {
  const roomTypes = value.availableRoomTypes?.length
    ? ` Room types: ${value.availableRoomTypes.map((item) => `${item.roomType} ${item.count}`).join(", ")}.`
    : "";
  return `Availability search returned ${value.rooms.length} rooms.${roomTypes}`;
}

function roomTypeCatalogParts(roomTypes: readonly { displayName: string; roomCount: number }[]): string {
  return roomTypes.length
    ? ` Room types: ${roomTypes.map((item) => `${item.displayName} ${item.roomCount}`).join(", ")}.`
    : " No active room types are configured.";
}
