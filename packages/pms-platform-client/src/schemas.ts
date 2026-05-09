export type PmsCapabilityManifest = {
  capabilities: string[];
};

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
  roomType: string;
  available: boolean;
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

export type HotelProfileInput = {
  tenantId: string;
  propertyId?: string;
};

export type RoomTypeCatalogInput = {
  tenantId: string;
  propertyId?: string;
};

export type RoomTypeCatalogItem = {
  roomTypeId: string;
  code: string;
  displayName: string;
  roomCount: number;
  status: string;
};

export type RoomTypeCatalogResult = {
  propertyId?: string;
  roomTypes: RoomTypeCatalogItem[];
};

export type HotelProfileResult = {
  propertyId: string;
  propertyName: string;
  timeZone: string;
  status: string;
  roomTotal: number;
  roomTypes: RoomTypeCatalogItem[];
  address?: string;
  phone?: string;
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
  reservationId?: string;
  reservationCode?: string;
};

export type ReservationFact = {
  reservationId: string;
  status: string;
  roomId?: string;
};

export type CreateReservationDraftInput = {
  tenantId: string;
  propertyId?: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type UpdateReservationDraftInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
  patch: Record<string, unknown>;
  sourceEvidenceRef?: string;
};

export type ReservationDraftFact = {
  draftId?: string;
  draftRef?: string;
  status: string;
};

export type QuoteReservationDraftInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
};

export type ReservationQuoteFact = {
  quoteId?: string;
  quoteRef?: string;
  totalCents?: number;
  currency?: string;
  status?: string;
};

export type PrepareReservationConfirmInput = {
  tenantId: string;
  draftId?: string;
  draftRef?: string;
  quoteRef?: string;
};

export type ReservationConfirmPreparation = {
  pendingActionId: string;
  pendingActionRef?: string;
  confirmationMode: "typedCardOnly";
  mutationStatus: "none";
  quoteRef?: string;
  cardPayloadRef?: string;
  selectionCount?: number;
  status?: string;
  expiresAt?: string;
};

export type ReservationGroupRoomSelection = {
  roomId: string;
  selectedCandidateRef: string;
  roomTypeId?: string;
  roomType?: string;
};

export type CreateReservationGroupDraftInput = {
  tenantId: string;
  propertyId?: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  roomType?: string;
  sourceEvidenceRef?: string;
};

export type UpdateReservationGroupDraftInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
  selections: readonly ReservationGroupRoomSelection[];
  sourceEvidenceRef?: string;
};

export type ReservationGroupDraftFact = {
  groupDraftId?: string;
  groupDraftRef?: string;
  status: string;
};

export type QuoteReservationGroupDraftInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
};

export type ReservationGroupQuoteFact = {
  quoteRef?: string;
  status?: string;
};

export type PrepareReservationGroupConfirmInput = {
  tenantId: string;
  groupDraftId?: string;
  groupDraftRef?: string;
  quoteRef?: string;
};

export type PendingActionStatusInput = {
  tenantId: string;
  pendingActionId?: string;
  pendingActionRef?: string;
  cardPayloadRef?: string;
};

export type PendingActionStatusFact = {
  pendingActionId: string;
  status: "pending" | "awaitingConfirmation" | "confirmed" | "cancelled" | "expired";
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
  if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity < 1)) throw new Error("quantity must be a positive integer");
}

export function validateHotelProfileInput(input: HotelProfileInput): void {
  validateTenantScopedInput(input);
  if (input.propertyId !== undefined) assertText(input.propertyId, "propertyId");
}

export function validateRoomTypeCatalogInput(input: RoomTypeCatalogInput): void {
  validateTenantScopedInput(input);
  if (input.propertyId !== undefined) assertText(input.propertyId, "propertyId");
}

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

export function validateCreateReservationDraftInput(input: CreateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.roomId, "roomId");
  assertText(input.guestName, "guestName");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
}

export function validateUpdateReservationDraftInput(input: UpdateReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
  assertRecord(input.patch, "patch");
}

export function validateQuoteReservationDraftInput(input: QuoteReservationDraftInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
}

export function validatePrepareReservationConfirmInput(input: PrepareReservationConfirmInput): void {
  validateTenantScopedInput(input);
  assertDraftIdentifier(input);
}

export function validateCreateReservationGroupDraftInput(input: CreateReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertText(input.guestName, "guestName");
  assertText(input.checkInDate, "checkInDate");
  assertText(input.checkOutDate, "checkOutDate");
  if (!Number.isInteger(input.quantity) || input.quantity < 2) throw new Error("quantity must be an integer greater than one");
}

export function validateUpdateReservationGroupDraftInput(input: UpdateReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
  if (!Array.isArray(input.selections) || input.selections.length < 2) throw new Error("selections must contain at least two rooms");
  input.selections.forEach((selection, index) => {
    assertText(selection.roomId, `selections[${index}].roomId`);
    assertText(selection.selectedCandidateRef, `selections[${index}].selectedCandidateRef`);
  });
}

export function validateQuoteReservationGroupDraftInput(input: QuoteReservationGroupDraftInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
}

export function validatePrepareReservationGroupConfirmInput(input: PrepareReservationGroupConfirmInput): void {
  validateTenantScopedInput(input);
  assertGroupDraftIdentifier(input);
  assertText(input.quoteRef, "quoteRef");
}

export function validatePendingActionStatusInput(input: PendingActionStatusInput): void {
  validateTenantScopedInput(input);
  assertText(input.pendingActionId ?? input.pendingActionRef, "pendingActionId");
}

export function parseHealthResult(value: unknown): HealthResult {
  const object = assertRecord(value, "health response");
  return { ok: object.ok === true };
}

export function parseCapabilityManifest(value: unknown): PmsCapabilityManifest {
  const object = assertRecord(value, "capabilities response");
  const source = isPlainRecord(object.manifest) ? object.manifest : object;
  const rawCapabilities = assertArray(source.capabilities, "capabilities");
  const capabilities = rawCapabilities.map((item, index) => {
    if (typeof item === "string") return assertText(item, `capabilities[${index}]`);
    const record = assertRecord(item, `capabilities[${index}]`);
    return assertText(record.name ?? record.operation, `capabilities[${index}].name`);
  });
  return { capabilities };
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
        return {
          roomId: assertText(item.roomId, `candidates[${index}].roomId`),
          roomType: typeof item.roomType === "string" && item.roomType.trim() ? item.roomType : "unknown",
          available: true
        };
      })
    );
  }

  throw new Error("availability response must contain rooms or readModel.candidates");
}

export function parseHotelProfileResult(value: unknown): HotelProfileResult {
  const object = assertRecord(value, "hotel profile response");
  const source = isPlainRecord(object.readModel) ? object.readModel : object;
  const result: HotelProfileResult = {
    propertyId: assertText(source.propertyId, "readModel.propertyId"),
    propertyName: assertText(source.propertyName, "readModel.propertyName"),
    timeZone: assertText(source.timeZone, "readModel.timeZone"),
    status: assertText(source.status, "readModel.status"),
    roomTotal: assertNonNegativeInteger(source.roomTotal, "readModel.roomTotal"),
    roomTypes: parseRoomTypeCatalogItems(source.roomTypes, "readModel.roomTypes")
  };
  if (typeof source.address === "string" && source.address.trim()) result.address = source.address;
  if (typeof source.phone === "string" && source.phone.trim()) result.phone = source.phone;
  return result;
}

export function parseRoomTypeCatalogResult(value: unknown): RoomTypeCatalogResult {
  const object = assertRecord(value, "room type catalog response");
  const source = isPlainRecord(object.readModel) ? object.readModel : object;
  return {
    ...(typeof source.propertyId === "string" && source.propertyId.trim() ? { propertyId: source.propertyId } : {}),
    roomTypes: parseRoomTypeCatalogItems(source.roomTypes, "readModel.roomTypes")
  };
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
    if (typeof item.priceCents === "number") parsed.priceCents = item.priceCents;
    return parsed;
  });
}

function parseRoomTypeCatalogItems(value: unknown, field: string): RoomTypeCatalogItem[] {
  return assertArray(value, field).map((item, index) => {
    const record = assertRecord(item, `${field}[${index}]`);
    return {
      roomTypeId: assertText(record.roomTypeId, `${field}[${index}].roomTypeId`),
      code: assertText(record.code, `${field}[${index}].code`),
      displayName: assertText(record.displayName, `${field}[${index}].displayName`),
      roomCount: assertNonNegativeInteger(record.roomCount, `${field}[${index}].roomCount`),
      status: assertText(record.status, `${field}[${index}].status`)
    };
  });
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

export function parseReservationDraftFact(value: unknown): ReservationDraftFact {
  const object = assertRecord(value, "draft response");
  if (typeof object.draftId === "string" && object.draftId.trim()) {
    return { draftId: object.draftId, status: assertText(object.status, "status") };
  }
  const draft = assertRecord(object.draft, "draft");
  return {
    draftRef: assertText(draft.draftRef, "draft.draftRef"),
    ...(typeof draft.draftId === "string" && draft.draftId.trim() ? { draftId: draft.draftId } : {}),
    status: assertText(draft.status, "draft.status")
  };
}

export function parseReservationQuoteFact(value: unknown): ReservationQuoteFact {
  const object = assertRecord(value, "quote response");
  if (typeof object.quoteId === "string" && object.quoteId.trim()) {
    const parsed: ReservationQuoteFact = { quoteId: object.quoteId };
    if (typeof object.totalCents === "number") parsed.totalCents = object.totalCents;
    if (typeof object.currency === "string" && object.currency.trim()) parsed.currency = object.currency;
    return parsed;
  }
  const draft = assertRecord(object.draft, "draft");
  const quote = assertRecord(draft.quote, "draft.quote");
  return {
    quoteRef: assertText(quote.quoteRef, "draft.quote.quoteRef"),
    ...(typeof quote.status === "string" && quote.status.trim() ? { status: quote.status } : {})
  };
}

export function parseReservationConfirmPreparation(value: unknown): ReservationConfirmPreparation {
  const object = assertRecord(value, "prepare-confirm response");
  if (typeof object.pendingActionId === "string" && object.pendingActionId.trim()) {
    const result: ReservationConfirmPreparation = {
      pendingActionId: object.pendingActionId,
      pendingActionRef: object.pendingActionId,
      confirmationMode: assertLiteral(object.confirmationMode, "typedCardOnly", "confirmationMode"),
      mutationStatus: assertLiteral(object.mutationStatus, "none", "mutationStatus")
    };
    if (typeof object.expiresAt === "string" && object.expiresAt.length > 0) result.expiresAt = object.expiresAt;
    return result;
  }
  const draft = assertRecord(object.draft, "draft");
  const pendingAction = assertRecord(draft.pendingAction, "draft.pendingAction");
  const result: ReservationConfirmPreparation = {
    pendingActionId: assertText(pendingAction.pendingActionRef, "draft.pendingAction.pendingActionRef"),
    pendingActionRef: assertText(pendingAction.pendingActionRef, "draft.pendingAction.pendingActionRef"),
    confirmationMode: assertLiteral(pendingAction.confirmationMode, "typedCardOnly", "draft.pendingAction.confirmationMode"),
    mutationStatus: assertLiteral(pendingAction.mutationStatus, "none", "draft.pendingAction.mutationStatus")
  };
  if (typeof pendingAction.expiresAt === "string" && pendingAction.expiresAt.length > 0) result.expiresAt = pendingAction.expiresAt;
  if (typeof pendingAction.quoteRef === "string" && pendingAction.quoteRef.trim()) result.quoteRef = pendingAction.quoteRef;
  if (typeof pendingAction.cardPayloadRef === "string" && pendingAction.cardPayloadRef.trim()) result.cardPayloadRef = pendingAction.cardPayloadRef;
  if (typeof pendingAction.status === "string" && pendingAction.status.trim()) result.status = pendingAction.status;
  return result;
}

export function parseReservationGroupDraftFact(value: unknown): ReservationGroupDraftFact {
  const object = assertRecord(value, "group draft response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  return {
    groupDraftRef: assertText(groupDraft.groupDraftRef, "groupDraft.groupDraftRef"),
    ...(typeof groupDraft.groupDraftId === "string" && groupDraft.groupDraftId.trim() ? { groupDraftId: groupDraft.groupDraftId } : {}),
    status: assertText(groupDraft.status, "groupDraft.status")
  };
}

export function parseReservationGroupQuoteFact(value: unknown): ReservationGroupQuoteFact {
  const object = assertRecord(value, "group quote response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  const quote = assertRecord(groupDraft.quote, "groupDraft.quote");
  return {
    quoteRef: assertText(quote.quoteRef, "groupDraft.quote.quoteRef"),
    ...(typeof quote.status === "string" && quote.status.trim() ? { status: quote.status } : {})
  };
}

export function parseReservationGroupConfirmPreparation(value: unknown): ReservationConfirmPreparation {
  const object = assertRecord(value, "group prepare-confirm response");
  const groupDraft = assertRecord(object.groupDraft, "groupDraft");
  const pendingAction = assertRecord(groupDraft.pendingAction, "groupDraft.pendingAction");
  const pendingActionRef = assertText(pendingAction.pendingActionRef, "groupDraft.pendingAction.pendingActionRef");
  const result: ReservationConfirmPreparation = {
    pendingActionId: pendingActionRef,
    pendingActionRef,
    confirmationMode: assertLiteral(pendingAction.confirmationMode, "typedCardOnly", "groupDraft.pendingAction.confirmationMode"),
    mutationStatus: assertLiteral(pendingAction.mutationStatus, "none", "groupDraft.pendingAction.mutationStatus")
  };
  if (typeof pendingAction.expiresAt === "string" && pendingAction.expiresAt.length > 0) result.expiresAt = pendingAction.expiresAt;
  if (typeof pendingAction.quoteRef === "string" && pendingAction.quoteRef.trim()) result.quoteRef = pendingAction.quoteRef;
  if (typeof pendingAction.cardPayloadRef === "string" && pendingAction.cardPayloadRef.trim()) result.cardPayloadRef = pendingAction.cardPayloadRef;
  if (typeof pendingAction.selectionCount === "number") result.selectionCount = pendingAction.selectionCount;
  if (typeof pendingAction.status === "string" && pendingAction.status.trim()) result.status = pendingAction.status;
  return result;
}

export function parsePendingActionStatusFact(value: unknown): PendingActionStatusFact {
  const object = assertRecord(value, "pending-action response");
  const pendingAction = isPlainRecord(object.pendingAction) ? object.pendingAction : object;
  const status = pendingAction.status;
  if (status !== "pending" && status !== "awaitingConfirmation" && status !== "confirmed" && status !== "cancelled" && status !== "expired") {
    throw new Error("status is invalid");
  }
  return {
    pendingActionId: assertText(pendingAction.pendingActionId ?? pendingAction.pendingActionRef, "pendingActionId"),
    status
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertLiteral<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) throw new Error(`${field} must be ${expected}`);
  return expected;
}

function assertArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

export function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

export function assertText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

function assertNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function assertDraftIdentifier(input: { draftId?: string; draftRef?: string }): void {
  assertText(input.draftId ?? input.draftRef, "draftId");
}

function assertGroupDraftIdentifier(input: { groupDraftId?: string; groupDraftRef?: string }): void {
  assertText(input.groupDraftId ?? input.groupDraftRef, "groupDraftId");
}
