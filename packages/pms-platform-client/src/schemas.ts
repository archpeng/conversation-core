export type PmsCapabilityManifest = {
  capabilities: string[];
};

export type SearchAvailabilityInput = {
  tenantId: string;
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
};

export type RoomAvailability = {
  roomId: string;
  roomType: string;
  available: boolean;
  priceCents?: number;
};

export type AvailabilitySearchResult = {
  rooms: RoomAvailability[];
};

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
  reservationId: string;
};

export type ReservationFact = {
  reservationId: string;
  status: string;
  roomId?: string;
};

export type CreateReservationDraftInput = {
  tenantId: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
};

export type UpdateReservationDraftInput = {
  tenantId: string;
  draftId: string;
  patch: Record<string, unknown>;
};

export type ReservationDraftFact = {
  draftId: string;
  status: string;
};

export type QuoteReservationDraftInput = {
  tenantId: string;
  draftId: string;
};

export type ReservationQuoteFact = {
  quoteId: string;
  totalCents: number;
  currency: string;
};

export type PrepareReservationConfirmInput = {
  tenantId: string;
  draftId: string;
};

export type ReservationConfirmPreparation = {
  pendingActionId: string;
  confirmationMode: "typedCardOnly";
  mutationStatus: "none";
  expiresAt?: string;
};

export type PendingActionStatusInput = {
  tenantId: string;
  pendingActionId: string;
};

export type PendingActionStatusFact = {
  pendingActionId: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
};

export type HealthResult = {
  ok: boolean;
};

export function validateTenantScopedInput(input: { tenantId: string }): void {
  assertText(input.tenantId, "tenantId");
}

export function validateSearchAvailabilityInput(input: SearchAvailabilityInput): void {
  validateTenantScopedInput(input);
  assertText(input.hotelId, "hotelId");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
}

export function validateGetRoomInput(input: GetRoomInput): void {
  validateTenantScopedInput(input);
  assertText(input.roomId, "roomId");
}

export function validateGetReservationInput(input: GetReservationInput): void {
  validateTenantScopedInput(input);
  assertText(input.reservationId, "reservationId");
}

export function validateCreateReservationDraftInput(input: CreateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.roomId, "roomId");
  assertText(input.guestName, "guestName");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
}

export function validateUpdateReservationDraftInput(input: UpdateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.draftId, "draftId");
  assertRecord(input.patch, "patch");
}

export function validateQuoteReservationDraftInput(input: QuoteReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.draftId, "draftId");
}

export function validatePrepareReservationConfirmInput(input: PrepareReservationConfirmInput): void {
  validateTenantScopedInput(input);
  assertText(input.draftId, "draftId");
}

export function validatePendingActionStatusInput(input: PendingActionStatusInput): void {
  validateTenantScopedInput(input);
  assertText(input.pendingActionId, "pendingActionId");
}

export function parseHealthResult(value: unknown): HealthResult {
  const object = assertRecord(value, "health response");
  return { ok: object.ok === true };
}

export function parseCapabilityManifest(value: unknown): PmsCapabilityManifest {
  const object = assertRecord(value, "capabilities response");
  const capabilities = assertArray(object.capabilities, "capabilities").map((item, index) => assertText(item, `capabilities[${index}]`));
  return { capabilities };
}

export function parseAvailabilitySearchResult(value: unknown): AvailabilitySearchResult {
  const object = assertRecord(value, "availability response");
  const rooms = assertArray(object.rooms, "rooms").map((room, index) => {
    const item = assertRecord(room, `rooms[${index}]`);
    const parsed: RoomAvailability = {
      roomId: assertText(item.roomId, `rooms[${index}].roomId`),
      roomType: assertText(item.roomType, `rooms[${index}].roomType`),
      available: item.available === true
    };
    if (typeof item.priceCents === "number") parsed.priceCents = item.priceCents;
    return parsed;
  });
  return { rooms };
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
  const result: ReservationFact = {
    reservationId: assertText(object.reservationId, "reservationId"),
    status: assertText(object.status, "status")
  };
  if (typeof object.roomId === "string" && object.roomId.length > 0) result.roomId = object.roomId;
  return result;
}

export function parseReservationDraftFact(value: unknown): ReservationDraftFact {
  const object = assertRecord(value, "draft response");
  return {
    draftId: assertText(object.draftId, "draftId"),
    status: assertText(object.status, "status")
  };
}

export function parseReservationQuoteFact(value: unknown): ReservationQuoteFact {
  const object = assertRecord(value, "quote response");
  const totalCents = object.totalCents;
  if (typeof totalCents !== "number") throw new Error("totalCents must be a number");
  return {
    quoteId: assertText(object.quoteId, "quoteId"),
    totalCents,
    currency: assertText(object.currency, "currency")
  };
}

export function parseReservationConfirmPreparation(value: unknown): ReservationConfirmPreparation {
  const object = assertRecord(value, "prepare-confirm response");
  const result: ReservationConfirmPreparation = {
    pendingActionId: assertText(object.pendingActionId, "pendingActionId"),
    confirmationMode: assertLiteral(object.confirmationMode, "typedCardOnly", "confirmationMode"),
    mutationStatus: assertLiteral(object.mutationStatus, "none", "mutationStatus")
  };
  if (typeof object.expiresAt === "string" && object.expiresAt.length > 0) result.expiresAt = object.expiresAt;
  return result;
}

export function parsePendingActionStatusFact(value: unknown): PendingActionStatusFact {
  const object = assertRecord(value, "pending-action response");
  const status = object.status;
  if (status !== "pending" && status !== "confirmed" && status !== "cancelled" && status !== "expired") {
    throw new Error("status is invalid");
  }
  return {
    pendingActionId: assertText(object.pendingActionId, "pendingActionId"),
    status
  };
}

function assertLiteral<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) throw new Error(`${field} must be ${expected}`);
  return expected;
}

function assertArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function assertText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}
