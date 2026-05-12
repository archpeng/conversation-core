import { asRecord, optionalStringArray, requireNonEmptyString, requireOptionalString, type Validation } from "./field-checks.js";
import { validateObjectRef, type ObjectRef } from "./object-ref.js";

export type RoomReadObject = {
  ref: ObjectRef & { kind: "room" };
  status: string;
  roomType: string;
  reservationRefs: string[];
  blockRefs: string[];
  evidenceRefs: string[];
};

export type ReservationReadObject = {
  ref: ObjectRef & { kind: "reservation" };
  status: string;
  roomId?: string;
  roomNumber?: string;
  roomType?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
  evidenceRefs: string[];
};

export type AvailabilityReadObject = {
  ref: ObjectRef & { kind: "availability" };
  checkInDate: string;
  checkOutDate: string;
  rooms: {
    roomId: string;
    roomType: string;
    roomNumber?: string;
    available: boolean;
  }[];
  availableRoomTypes?: { roomType: string; count: number }[];
  evidenceRefs: string[];
};

export function validateRoomObjectResponse(input: unknown): Validation<{ ok: true; object: RoomReadObject }> {
  return validateObjectResponse(input, parseRoomObject);
}

export function validateReservationObjectResponse(input: unknown): Validation<{ ok: true; object: ReservationReadObject }> {
  return validateObjectResponse(input, parseReservationObject);
}

export function validateAvailabilityObjectResponse(input: unknown): Validation<{ ok: true; object: AvailabilityReadObject }> {
  return validateObjectResponse(input, parseAvailabilityObject);
}

function validateObjectResponse<T>(input: unknown, parse: (input: unknown, issues: string[]) => T | undefined): Validation<{ ok: true; object: T }> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["response must be an object"] };
  if (value.ok !== true) issues.push("ok must be true");
  const object = parse(value.object, issues);
  if (issues.length > 0 || !object) return { ok: false, issues };
  return { ok: true, value: { ok: true, object } };
}

function parseRoomObject(input: unknown, issues: string[]): RoomReadObject | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push("object must be an object");
    return undefined;
  }
  const ref = validateObjectRef(value.ref, "object.ref");
  if (!ref.ok) issues.push(...ref.issues);
  requireNonEmptyString(value.status, "object.status", issues);
  requireNonEmptyString(value.roomType, "object.roomType", issues);
  const reservationRefs = optionalStringArray(value.reservationRefs, "object.reservationRefs", issues) ?? [];
  const blockRefs = optionalStringArray(value.blockRefs, "object.blockRefs", issues) ?? [];
  const evidenceRefs = optionalStringArray(value.evidenceRefs, "object.evidenceRefs", issues) ?? [];
  if (!ref.ok || ref.value.kind !== "room" || typeof value.status !== "string" || typeof value.roomType !== "string") return undefined;
  return { ref: ref.value as ObjectRef & { kind: "room" }, status: value.status, roomType: value.roomType, reservationRefs, blockRefs, evidenceRefs };
}

function parseReservationObject(input: unknown, issues: string[]): ReservationReadObject | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push("object must be an object");
    return undefined;
  }
  const ref = validateObjectRef(value.ref, "object.ref");
  if (!ref.ok) issues.push(...ref.issues);
  requireNonEmptyString(value.status, "object.status", issues);
  requireOptionalString(value.roomId, "object.roomId", issues);
  requireOptionalString(value.roomNumber, "object.roomNumber", issues);
  requireOptionalString(value.roomType, "object.roomType", issues);
  requireOptionalString(value.guestName, "object.guestName", issues);
  requireOptionalString(value.arrivalDate, "object.arrivalDate", issues);
  requireOptionalString(value.departureDate, "object.departureDate", issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, "object.evidenceRefs", issues) ?? [];
  if (!ref.ok || ref.value.kind !== "reservation" || typeof value.status !== "string") return undefined;
  return {
    ref: ref.value as ObjectRef & { kind: "reservation" },
    status: value.status,
    ...(typeof value.roomId === "string" ? { roomId: value.roomId } : {}),
    ...(typeof value.roomNumber === "string" ? { roomNumber: value.roomNumber } : {}),
    ...(typeof value.roomType === "string" ? { roomType: value.roomType } : {}),
    ...(typeof value.guestName === "string" ? { guestName: value.guestName } : {}),
    ...(typeof value.arrivalDate === "string" ? { arrivalDate: value.arrivalDate } : {}),
    ...(typeof value.departureDate === "string" ? { departureDate: value.departureDate } : {}),
    evidenceRefs
  };
}

function parseAvailabilityObject(input: unknown, issues: string[]): AvailabilityReadObject | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push("object must be an object");
    return undefined;
  }
  const ref = validateObjectRef(value.ref, "object.ref");
  if (!ref.ok) issues.push(...ref.issues);
  requireNonEmptyString(value.checkInDate, "object.checkInDate", issues);
  requireNonEmptyString(value.checkOutDate, "object.checkOutDate", issues);
  const rooms = parseAvailabilityRooms(value.rooms, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, "object.evidenceRefs", issues) ?? [];
  const availableRoomTypes = parseRoomTypeCounts(value.availableRoomTypes, issues);
  if (!ref.ok || ref.value.kind !== "availability" || typeof value.checkInDate !== "string" || typeof value.checkOutDate !== "string") return undefined;
  return {
    ref: ref.value as ObjectRef & { kind: "availability" },
    checkInDate: value.checkInDate,
    checkOutDate: value.checkOutDate,
    rooms,
    ...(availableRoomTypes ? { availableRoomTypes } : {}),
    evidenceRefs
  };
}

function parseAvailabilityRooms(input: unknown, issues: string[]): AvailabilityReadObject["rooms"] {
  if (!Array.isArray(input)) {
    issues.push("object.rooms must be an array");
    return [];
  }
  return input.flatMap((item, index) => {
    const value = asRecord(item);
    if (!value || typeof value.roomId !== "string" || typeof value.roomType !== "string" || typeof value.available !== "boolean") {
      issues.push(`object.rooms[${index}] is invalid`);
      return [];
    }
    return [{ roomId: value.roomId, roomType: value.roomType, available: value.available, ...(typeof value.roomNumber === "string" ? { roomNumber: value.roomNumber } : {}) }];
  });
}

function parseRoomTypeCounts(input: unknown, issues: string[]): AvailabilityReadObject["availableRoomTypes"] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    issues.push("object.availableRoomTypes must be an array when present");
    return undefined;
  }
  return input.flatMap((item, index) => {
    const value = asRecord(item);
    if (!value || typeof value.roomType !== "string" || typeof value.count !== "number") {
      issues.push(`object.availableRoomTypes[${index}] is invalid`);
      return [];
    }
    return [{ roomType: value.roomType, count: value.count }];
  });
}
