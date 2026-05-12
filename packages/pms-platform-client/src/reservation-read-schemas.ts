import { assertRecord, assertText } from "./schema-assertions.js";
import { validateTenantScopedInput } from "./tenant-schemas.js";

export type GetRoomInput = {
  tenantId: string;
  roomId: string;
};

export type RoomFact = {
  roomId: string;
  roomType: string;
  status: string;
};

export type GetReservationInput = {
  tenantId: string;
  reservationId?: string;
  reservationCode?: string;
};

export type ReservationFact = {
  reservationId: string;
  status: string;
  reservationCode?: string;
  roomId?: string;
  roomNumber?: string;
  roomType?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
};

export function validateGetRoomInput(input: GetRoomInput): void {
  validateTenantScopedInput(input);
  assertText(input.roomId, "roomId");
}

export function validateGetReservationInput(input: GetReservationInput): void {
  validateTenantScopedInput(input);
  const id = input.reservationId;
  const code = input.reservationCode;
  if (!id && !code) throw new Error("reservationId or reservationCode is required");
  if (id !== undefined && id !== null) {
    assertText(id, "reservationId");
  }
  if (code !== undefined && code !== null) {
    assertText(code, "reservationCode");
  }
}

export function parseRoomFact(value: unknown): RoomFact {
  const object = assertRecord(value, "room response");
  return {
    roomId: assertText(object.roomId, "roomId"),
    roomType: assertText(object.roomType, "roomType"),
    status: assertText(object.status, "status")
  };
}

export function parseReservationFact(value: unknown): ReservationFact {
  const object = reservationObject(value);
  const idField = (typeof object.reservationId === "string" && object.reservationId.trim()) ? object.reservationId : object.reservationCode;
  const result: ReservationFact = {
    reservationId: assertText(idField, "reservationId"),
    status: assertText(object.status, "status")
  };
  const reservationCode = optionalText(object.reservationCode);
  if (reservationCode) result.reservationCode = reservationCode;
  if (typeof object.roomId === "string" && object.roomId.length > 0) result.roomId = object.roomId;
  const roomNumber = optionalText(object.roomNumber);
  if (roomNumber) result.roomNumber = roomNumber;
  const roomType = optionalText(object.roomType);
  if (roomType) result.roomType = roomType;
  const guestName = optionalText(object.guestName ?? object.guestDisplayName);
  if (guestName) result.guestName = guestName;
  const arrivalDate = optionalText(object.arrivalDate);
  if (arrivalDate) result.arrivalDate = arrivalDate;
  const departureDate = optionalText(object.departureDate);
  if (departureDate) result.departureDate = departureDate;
  return result;
}

export function reservationFactSummary(value: ReservationFact): string {
  const code = value.reservationCode ?? value.reservationId;
  const guest = value.guestName ? ` guest ${value.guestName}` : "";
  const room = value.roomNumber ?? value.roomId;
  const roomText = room ? ` room ${room}${value.roomType ? ` ${value.roomType}` : ""}` : "";
  const dates = value.arrivalDate && value.departureDate ? ` dates ${value.arrivalDate} to ${value.departureDate}` : "";
  return `Reservation ${code}:${guest}${roomText}${dates} status ${value.status}.`;
}

function reservationObject(value: unknown): Record<string, unknown> {
  const object = assertRecord(value, "reservation response");
  const readModel = object.readModel;
  if (!readModel || typeof readModel !== "object" || Array.isArray(readModel)) return object;
  return assertRecord(readModel, "reservation readModel");
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
