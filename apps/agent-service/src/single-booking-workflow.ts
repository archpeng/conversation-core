import type { GatedToolRequest } from "@pms-agent-v2/gated-tools";
import type {
  PmsEvidence,
  PmsPlatformClient,
  PmsWorkflowRejectedResult,
  ReservationConfirmPreparation,
  ReservationDraftFact,
  RoomAvailability,
  RoomTypeCatalogItem,
} from "@pms-agent-v2/pms-platform-client";

export type SingleBookingWorkflowConfig = {
  defaultHotelId: string;
  defaultPropertyId: string;
};

export type SingleBookingPmsClient = {
  roomTypeCatalog: PmsPlatformClient["roomTypeCatalog"];
  searchAvailability: PmsPlatformClient["searchAvailability"];
  createReservationDraft: PmsPlatformClient["createReservationDraft"];
  quoteReservationDraft: PmsPlatformClient["quoteReservationDraft"];
  prepareReservationConfirm: PmsPlatformClient["prepareReservationConfirm"];
};

export async function prepareReservationBooking(input: {
  client: SingleBookingPmsClient;
  config: SingleBookingWorkflowConfig;
  request: GatedToolRequest;
}): Promise<PmsEvidence<ReservationConfirmPreparation> | PmsWorkflowRejectedResult> {
  const tenantId = input.request.tenantId ?? "default-tenant";
  const guestName = normalizedText(input.request.guestName);
  const checkInDate = normalizedText(input.request.checkInDate);
  const checkOutDate = normalizedText(input.request.checkOutDate);
  const requestedRoomType = normalizedText(input.request.roomType ?? input.request.roomTypeText);
  const requestedRoomId = normalizedRoomIdentifier(input.request.roomId);
  const requestedRoomNumber = normalizedRoomIdentifier(input.request.roomNumber);
  const missingSlots = missingRequiredSlots({ guestName, checkInDate, checkOutDate });
  if (missingSlots.length > 0) {
    return rejected(
      "RESERVATION_BOOKING_MISSING_REQUIRED_SLOTS",
      `缺少创建预订确认卡所需信息：${missingSlots.join("、")}。`,
      "missingSlots",
      missingSlots,
    );
  }
  if (!guestName || !checkInDate || !checkOutDate) {
    return rejected("RESERVATION_BOOKING_MISSING_REQUIRED_SLOTS", "缺少创建预订确认卡所需信息。", "missingSlots");
  }

  if (input.request.quantity !== undefined && input.request.quantity !== 1) {
    return rejected(
      "RESERVATION_SINGLE_WORKFLOW_QUANTITY_UNSUPPORTED",
      "单房预订确认卡只支持 1 间房；多间房请使用多房预订流程。",
      "quantity",
    );
  }

  const catalog = await input.client.roomTypeCatalog({
    tenantId,
    propertyId: input.config.defaultPropertyId,
  });
  const roomTypeMatch = requestedRoomType ? matchCatalogRoomType(catalog.data.roomTypes, requestedRoomType) : { status: "not_requested" as const };
  if (roomTypeMatch.status === "missing") {
    return rejected(
      "RESERVATION_ROOM_TYPE_NOT_CONFIGURED",
      `本酒店未配置房型“${requestedRoomType}”。可选房型：${configuredRoomTypes(catalog.data.roomTypes)}。`,
      "roomType",
    );
  }
  if (roomTypeMatch.status === "ambiguous") {
    return rejected(
      "RESERVATION_ROOM_TYPE_AMBIGUOUS",
      `房型“${requestedRoomType}”匹配到多个配置：${configuredRoomTypes(roomTypeMatch.matches)}。请指定一个完整房型。`,
      "roomType",
    );
  }
  if (!requestedRoomType && !requestedRoomId && !requestedRoomNumber) {
    return rejected(
      "RESERVATION_ROOM_SELECTION_REQUIRED",
      `请先提供房型或房号。可选房型：${configuredRoomTypes(catalog.data.roomTypes)}。`,
      "roomType",
    );
  }

  const matchedRoomType = roomTypeMatch.status === "matched" ? roomTypeMatch.roomType : undefined;
  const availability = await input.client.searchAvailability({
    tenantId,
    hotelId: input.config.defaultHotelId,
    checkInDate,
    checkOutDate,
    quantity: 1,
    ...(matchedRoomType ? { roomType: matchedRoomType.displayName } : {}),
  });
  const selectedRoom = selectRoom(availability.data.rooms, {
    matchedRoomType,
    requestedRoomId,
    requestedRoomNumber,
  });
  if (!selectedRoom) {
    return rejected(
      requestedRoomId || requestedRoomNumber ? "RESERVATION_ROOM_UNAVAILABLE" : "RESERVATION_NO_AVAILABLE_ROOM",
      unavailableMessage({
        checkInDate,
        checkOutDate,
        requestedRoomType,
        requestedRoomId,
        requestedRoomNumber,
        availableRooms: matchingAvailableRooms(availability.data.rooms, matchedRoomType),
      }),
      requestedRoomId || requestedRoomNumber ? "roomNumber" : "roomType",
    );
  }

  const roomType = selectedRoomType(selectedRoom, matchedRoomType);
  const created = await input.client.createReservationDraft({
    tenantId,
    propertyId: input.config.defaultPropertyId,
    roomId: selectedRoom.roomId,
    guestName,
    checkInDate,
    checkOutDate,
    ...(roomType ? { roomType } : {}),
    sourceEvidenceRef: availability.evidenceRef,
  });
  const draftIdentifier = reservationDraftIdentifier(created.data);
  if (!draftIdentifier) {
    return rejected(
      "RESERVATION_DRAFT_IDENTIFIER_MISSING",
      "PMS 已创建草稿证据，但未返回可用于报价的草稿编号。",
      "draftRef",
    );
  }

  const quote = await input.client.quoteReservationDraft({ tenantId, ...draftIdentifier });
  const quoteRef = normalizedText(quote.data.quoteRef ?? quote.data.quoteId);
  if (!quoteRef) {
    return rejected(
      "RESERVATION_QUOTE_IDENTIFIER_MISSING",
      "PMS 已创建草稿，但未返回可用于发确认卡的报价编号。",
      "quoteRef",
    );
  }

  return input.client.prepareReservationConfirm({ tenantId, ...draftIdentifier, quoteRef });
}

type CatalogMatch =
  | { status: "matched"; roomType: RoomTypeCatalogItem }
  | { status: "ambiguous"; matches: RoomTypeCatalogItem[] }
  | { status: "missing" };

function matchCatalogRoomType(roomTypes: readonly RoomTypeCatalogItem[], requestedRoomType: string): CatalogMatch {
  const activeRoomTypes = roomTypes.filter((roomType) => roomType.status === "active");
  const needle = normalizeForMatch(requestedRoomType);
  const exact = activeRoomTypes.find((roomType) =>
    normalizeForMatch(roomType.displayName) === needle
    || normalizeForMatch(roomType.code) === needle
    || normalizeForMatch(roomType.roomTypeId) === needle
  );
  if (exact) return { status: "matched", roomType: exact };

  const contains = activeRoomTypes.filter((roomType) =>
    normalizeForMatch(roomType.displayName).includes(needle)
    || normalizeForMatch(roomType.code).includes(needle)
    || normalizeForMatch(roomType.roomTypeId).includes(needle)
  );
  if (contains.length === 1 && contains[0]) return { status: "matched", roomType: contains[0] };
  if (contains.length > 1) return { status: "ambiguous", matches: contains };
  return { status: "missing" };
}

function selectRoom(
  rooms: readonly RoomAvailability[],
  input: {
    matchedRoomType?: RoomTypeCatalogItem;
    requestedRoomId?: string;
    requestedRoomNumber?: string;
  },
): RoomAvailability | undefined {
  const candidates = matchingAvailableRooms(rooms, input.matchedRoomType);
  if (input.requestedRoomId) {
    return candidates.find((room) => normalizeForMatch(room.roomId) === normalizeForMatch(input.requestedRoomId));
  }
  if (input.requestedRoomNumber) {
    return candidates.find((room) =>
      normalizeForMatch(room.roomNumber) === normalizeForMatch(input.requestedRoomNumber)
      || normalizeForMatch(room.roomId) === normalizeForMatch(input.requestedRoomNumber)
    );
  }
  return candidates[0];
}

function matchingAvailableRooms(rooms: readonly RoomAvailability[], matchedRoomType?: RoomTypeCatalogItem): RoomAvailability[] {
  return rooms.filter((room) => {
    if (!room.available) return false;
    if (!matchedRoomType) return true;
    return normalizeForMatch(room.roomType) === normalizeForMatch(matchedRoomType.displayName)
      || normalizeForMatch(room.roomTypeId) === normalizeForMatch(matchedRoomType.roomTypeId);
  });
}

function selectedRoomType(room: RoomAvailability, matchedRoomType: RoomTypeCatalogItem | undefined): string | undefined {
  if (matchedRoomType) return matchedRoomType.displayName;
  const roomType = normalizedText(room.roomType);
  return roomType && roomType !== "unknown" ? roomType : undefined;
}

function reservationDraftIdentifier(data: ReservationDraftFact): { draftRef: string } | { draftId: string } | undefined {
  const draftRef = normalizedText(data.draftRef);
  if (draftRef) return { draftRef };
  const draftId = normalizedText(data.draftId);
  return draftId ? { draftId } : undefined;
}

function unavailableMessage(input: {
  checkInDate: string;
  checkOutDate: string;
  requestedRoomType?: string;
  requestedRoomId?: string;
  requestedRoomNumber?: string;
  availableRooms: readonly RoomAvailability[];
}): string {
  const dateText = `${input.checkInDate} 至 ${input.checkOutDate}`;
  const roomText = input.requestedRoomNumber ?? input.requestedRoomId;
  const availableText = input.availableRooms.map(roomLabel).filter(Boolean).join("、") || "无";
  if (roomText) {
    return `房间“${roomText}”在 ${dateText} 期间不可订或不属于指定房型。当前可订房间：${availableText}。`;
  }
  return `房型“${input.requestedRoomType ?? "未指定"}”在 ${dateText} 期间当前无可订房间。`;
}

function roomLabel(room: RoomAvailability): string {
  return room.roomNumber ?? room.roomId;
}

function configuredRoomTypes(roomTypes: readonly RoomTypeCatalogItem[]): string {
  return roomTypes.map((roomType) => roomType.displayName).join("、") || "无";
}

function missingRequiredSlots(input: { guestName?: string; checkInDate?: string; checkOutDate?: string }): string[] {
  return [
    input.guestName ? undefined : "guestName",
    input.checkInDate ? undefined : "checkInDate",
    input.checkOutDate ? undefined : "checkOutDate",
  ].filter((item): item is string => Boolean(item));
}

function rejected(code: string, message: string, field: string, missingSlots?: string[]): PmsWorkflowRejectedResult {
  return {
    kind: "pms_workflow_rejected",
    origin: "pms-agent-v2",
    operation: "pms.reservation.prepare_booking",
    status: "rejected",
    mutationStatus: "none",
    errors: [{ code, message, field }],
    ...(missingSlots ? { missingSlots } : {}),
    summary: message,
  };
}

function normalizedText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function normalizedRoomIdentifier(value: string | undefined): string | undefined {
  const text = normalizedText(value);
  if (!text) return undefined;
  return placeholderRoomIdentifierValues.has(normalizeForMatch(text)) ? undefined : text;
}

function normalizeForMatch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

const placeholderRoomIdentifierValues = new Set(["default", "none", "n/a", "na", "未指定", "不指定", "无", "没有", "任意", "自动"]);
