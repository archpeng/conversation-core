import { describe, expect, it } from "vitest";
import { prepareReservationGroupBooking, type GroupBookingPmsClient } from "../apps/agent-service/src/group-booking-workflow.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";

describe("group booking workflow executor", () => {
  it("selects rooms, updates the group draft, quotes, and prepares a confirmation card", async () => {
    const calls: string[] = [];
    const client: GroupBookingPmsClient = {
      roomTypeCatalog: async () => {
        calls.push("roomTypeCatalog");
        return createPmsEvidence({
          method: "roomTypeCatalog",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:00:00.000Z",
          summary: "catalog",
          data: { roomTypes: [{ roomTypeId: "room-type-garden-villa", code: "A", displayName: "花园别墅", roomCount: 6, status: "active" }] },
        });
      },
      searchAvailability: async () => {
        calls.push("searchAvailability");
        return createPmsEvidence({
          method: "searchAvailability",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:01:00.000Z",
          summary: "availability",
          data: {
            rooms: [
              { roomId: "room-A1", roomType: "花园别墅", available: true },
              { roomId: "room-A2", roomType: "花园别墅", available: true },
            ],
          },
        });
      },
      createReservationGroupDraft: async () => {
        calls.push("createReservationGroupDraft");
        return createPmsEvidence({
          method: "createReservationGroupDraft",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:02:00.000Z",
          summary: "created",
          data: { groupDraftRef: "group_1", status: "collectingSlots" },
        });
      },
      updateReservationGroupDraft: async (input) => {
        calls.push(`updateReservationGroupDraft:${input.selections.map((selection) => selection.roomId).join(",")}`);
        return createPmsEvidence({
          method: "updateReservationGroupDraft",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:03:00.000Z",
          summary: "updated",
          data: { groupDraftRef: "group_1", status: "quoteReady" },
        });
      },
      quoteReservationGroupDraft: async () => {
        calls.push("quoteReservationGroupDraft");
        return createPmsEvidence({
          method: "quoteReservationGroupDraft",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:04:00.000Z",
          summary: "quoted",
          data: { quoteRef: "quote_1", status: "pricingUnsupported" },
        });
      },
      prepareReservationGroupConfirm: async () => {
        calls.push("prepareReservationGroupConfirm");
        return createPmsEvidence({
          method: "prepareReservationGroupConfirm",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:05:00.000Z",
          summary: "prepared",
          data: { pendingActionId: "pending_1", pendingActionRef: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none", quoteRef: "quote_1", selectionCount: 2 },
        });
      },
    };

    const result = await prepareReservationGroupBooking({
      client,
      config: { defaultHotelId: "hotel_1", defaultPropertyId: "property-small-hotel" },
      request: {
        capabilityId: "pms_reservation_group_prepare_booking",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        guestName: "莉莉",
        checkInDate: "2026-05-12",
        checkOutDate: "2026-05-14",
        roomType: "花园别墅",
        quantity: 2,
      },
    });

    expect(result).toMatchObject({ source: { method: "prepareReservationGroupConfirm" }, data: { pendingActionId: "pending_1", selectionCount: 2 } });
    expect(calls).toEqual([
      "roomTypeCatalog",
      "searchAvailability",
      "createReservationGroupDraft",
      "updateReservationGroupDraft:room-A1,room-A2",
      "quoteReservationGroupDraft",
      "prepareReservationGroupConfirm",
    ]);
  });
});
