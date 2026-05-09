import type { GatedToolRequest } from "@pms-agent-v2/gated-tools";
import type {
  PmsEvidence,
  PmsPlatformClient,
  PmsWorkflowRejectedResult,
  ReservationConfirmPreparation,
  RoomAvailability,
  RoomTypeCatalogItem,
} from "@pms-agent-v2/pms-platform-client";

export type GroupBookingWorkflowConfig = {
  defaultHotelId: string;
  defaultPropertyId: string;
};

export type GroupBookingPmsClient = {
  roomTypeCatalog: PmsPlatformClient["roomTypeCatalog"];
  searchAvailability: PmsPlatformClient["searchAvailability"];
  createReservationGroupDraft: PmsPlatformClient["createReservationGroupDraft"];
  updateReservationGroupDraft: PmsPlatformClient["updateReservationGroupDraft"];
  quoteReservationGroupDraft: PmsPlatformClient["quoteReservationGroupDraft"];
  prepareReservationGroupConfirm: PmsPlatformClient["prepareReservationGroupConfirm"];
};

export async function prepareReservationGroupBooking(input: {
  client: GroupBookingPmsClient;
  config: GroupBookingWorkflowConfig;
  request: GatedToolRequest;
}): Promise<PmsEvidence<ReservationConfirmPreparation> | PmsWorkflowRejectedResult> {
  const tenantId = input.request.tenantId ?? "default-tenant";
  const guestName = requiredText(input.request.guestName, "pms_workflow_guest_required");
  const checkInDate = requiredText(input.request.checkInDate, "pms_workflow_check_in_required");
  const checkOutDate = requiredText(input.request.checkOutDate, "pms_workflow_check_out_required");
  const requestedRoomType = requiredText(input.request.roomType, "pms_workflow_room_type_required");
  const quantity = requiredQuantity(input.request.quantity);

  const catalog = await input.client.roomTypeCatalog({
    tenantId,
    propertyId: input.config.defaultPropertyId,
  });
  const matchedRoomType = findCatalogRoomType(catalog.data.roomTypes, requestedRoomType);
  if (!matchedRoomType) {
    return rejected(
      "RESERVATION_ROOM_TYPE_NOT_CONFIGURED",
      `本酒店未配置房型“${requestedRoomType}”。可选房型：${configuredRoomTypes(catalog.data.roomTypes)}。`,
      "roomType",
    );
  }

  const availability = await input.client.searchAvailability({
    tenantId,
    hotelId: input.config.defaultHotelId,
    checkInDate,
    checkOutDate,
    roomType: matchedRoomType.displayName,
    quantity,
  });
  const selectedRooms = selectAvailableRooms(availability.data.rooms, matchedRoomType.displayName, quantity);
  if (selectedRooms.length < quantity) {
    return rejected(
      "RESERVATION_ROOM_UNAVAILABLE",
      `${matchedRoomType.displayName} 在 ${checkInDate} 至 ${checkOutDate} 期间当前只可订 ${selectedRooms.length} 间，无法准备 ${quantity} 间预订确认卡。`,
      "quantity",
    );
  }

  const created = await input.client.createReservationGroupDraft({
    tenantId,
    propertyId: input.config.defaultPropertyId,
    guestName,
    checkInDate,
    checkOutDate,
    quantity,
    roomType: matchedRoomType.displayName,
    sourceEvidenceRef: availability.evidenceRef,
  });
  const groupDraftRef = requiredText(created.data.groupDraftRef, "pms_workflow_group_draft_required");
  await input.client.updateReservationGroupDraft({
    tenantId,
    groupDraftRef,
    sourceEvidenceRef: availability.evidenceRef,
    selections: selectedRooms.map((room) => ({
      roomId: room.roomId,
      selectedCandidateRef: `${availability.evidenceRef}:${room.roomId}`,
      roomType: room.roomType || matchedRoomType.displayName,
    })),
  });
  const quote = await input.client.quoteReservationGroupDraft({ tenantId, groupDraftRef });
  const quoteRef = requiredText(quote.data.quoteRef, "pms_workflow_quote_required");
  return input.client.prepareReservationGroupConfirm({ tenantId, groupDraftRef, quoteRef });
}

function findCatalogRoomType(roomTypes: readonly RoomTypeCatalogItem[], requestedRoomType: string): RoomTypeCatalogItem | undefined {
  const needle = requestedRoomType.trim().toLocaleLowerCase();
  return roomTypes.find((roomType) =>
    roomType.displayName.toLocaleLowerCase() === needle
    || roomType.code.toLocaleLowerCase() === needle
    || roomType.roomTypeId.toLocaleLowerCase() === needle
  );
}

function configuredRoomTypes(roomTypes: readonly RoomTypeCatalogItem[]): string {
  return roomTypes.map((roomType) => roomType.displayName).join("、") || "无";
}

function selectAvailableRooms(rooms: readonly RoomAvailability[], roomType: string, quantity: number): RoomAvailability[] {
  const normalizedRoomType = roomType.trim().toLocaleLowerCase();
  return rooms
    .filter((room) => room.available && room.roomType.trim().toLocaleLowerCase() === normalizedRoomType)
    .slice(0, quantity);
}

function rejected(code: string, message: string, field: string): PmsWorkflowRejectedResult {
  return {
    kind: "pms_workflow_rejected",
    origin: "pms-agent-v2",
    operation: "pms.reservation.group_prepare_booking",
    status: "rejected",
    mutationStatus: "none",
    errors: [{ code, message, field }],
    summary: message,
  };
}

function requiredQuantity(value: number | undefined): number {
  if (Number.isInteger(value) && value !== undefined && value > 1) return value;
  throw new Error("pms_workflow_quantity_required");
}

function requiredText(value: string | undefined, message: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(message);
}
