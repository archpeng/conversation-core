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
  roomId?: string;
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
  const object = assertRecord(value, "reservation response");
  const idField = (typeof object.reservationId === "string" && object.reservationId.trim()) ? object.reservationId : object.reservationCode;
  const result: ReservationFact = {
    reservationId: assertText(idField, "reservationId"),
    status: assertText(object.status, "status")
  };
  if (typeof object.roomId === "string" && object.roomId.length > 0) result.roomId = object.roomId;
  return result;
}
