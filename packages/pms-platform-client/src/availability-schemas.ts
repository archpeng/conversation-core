import { assertRecord, assertText, isPlainRecord, textArray } from "./schema-assertions.js";
import { validateTenantScopedInput } from "./tenant-schemas.js";

export type SearchAvailabilityInput = {
  tenantId: string;
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  quantity?: number;
};

export type RoomAvailability = {
  roomId: string;
  roomNumber?: string;
  roomTypeId?: string;
  roomType: string;
  available: boolean;
  availableDates?: string[];
  sourceRefs?: string[];
  priceCents?: number;
};

export type RoomTypeAvailabilitySummary = {
  roomType: string;
  count: number;
};

export type AvailabilitySearchResult = {
  rooms: RoomAvailability[];
  availableRoomTypes?: RoomTypeAvailabilitySummary[];
};

export function validateSearchAvailabilityInput(input: SearchAvailabilityInput): void {
  validateTenantScopedInput(input);
  assertText(input.hotelId, "hotelId");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
  if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity < 1)) throw new Error("quantity must be a positive integer");
}

export function parseAvailabilitySearchResult(value: unknown): AvailabilitySearchResult {
  const object = assertRecord(value, "availability response");
  if (Array.isArray(object.rooms)) return availabilityResult(parseRooms(object.rooms));

  const readModel = isPlainRecord(object.readModel) ? object.readModel : undefined;
  const candidates = Array.isArray(readModel?.candidates) ? readModel.candidates : undefined;
  if (candidates) {
    return availabilityResult(
      candidates.map((candidate: unknown, index: number) => {
        const item = assertRecord(candidate, `candidates[${index}]`);
        const availableDates = textArray(item.availableDates);
        const sourceRefs = textArray(item.sourceRefs);
        return {
          roomId: assertText(item.roomId, `candidates[${index}].roomId`),
          ...(typeof item.roomNumber === "string" && item.roomNumber.trim() ? { roomNumber: item.roomNumber } : {}),
          ...(typeof item.roomTypeId === "string" && item.roomTypeId.trim() ? { roomTypeId: item.roomTypeId } : {}),
          roomType: typeof item.roomType === "string" && item.roomType.trim() ? item.roomType : "unknown",
          available: true,
          ...(availableDates.length > 0 ? { availableDates } : {}),
          ...(sourceRefs.length > 0 ? { sourceRefs } : {})
        };
      })
    );
  }

  throw new Error("availability response must contain rooms or readModel.candidates");
}

function availabilityResult(rooms: RoomAvailability[]): AvailabilitySearchResult {
  return {
    rooms,
    availableRoomTypes: roomTypeCounts(rooms)
  };
}

export function roomTypeCounts(rooms: readonly Pick<RoomAvailability, "roomType">[]): RoomTypeAvailabilitySummary[] {
  const counts = new Map<string, number>();
  for (const room of rooms) {
    const roomType = room.roomType.trim() || "unknown";
    counts.set(roomType, (counts.get(roomType) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([roomType, count]) => ({ roomType, count }))
    .sort((left, right) => left.roomType.localeCompare(right.roomType));
}

function parseRooms(rooms: unknown[]): RoomAvailability[] {
  return rooms.map((room, index) => {
    const item = assertRecord(room, `rooms[${index}]`);
    const parsed: RoomAvailability = {
      roomId: assertText(item.roomId, `rooms[${index}].roomId`),
      roomType: assertText(item.roomType, `rooms[${index}].roomType`),
      available: item.available === true
    };
    if (typeof item.roomNumber === "string" && item.roomNumber.trim()) parsed.roomNumber = item.roomNumber;
    if (typeof item.roomTypeId === "string" && item.roomTypeId.trim()) parsed.roomTypeId = item.roomTypeId;
    const availableDates = textArray(item.availableDates);
    if (availableDates.length > 0) parsed.availableDates = availableDates;
    const sourceRefs = textArray(item.sourceRefs);
    if (sourceRefs.length > 0) parsed.sourceRefs = sourceRefs;
    if (typeof item.priceCents === "number") parsed.priceCents = item.priceCents;
    return parsed;
  });
}
