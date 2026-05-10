import { describe, expect, it } from "vitest";
import { prepareReservationBooking, type SingleBookingPmsClient } from "../apps/agent-service/src/single-booking-workflow.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";

describe("single booking workflow executor", () => {
  it("selects the requested room number, creates a draft, quotes it, and prepares a confirmation card", async () => {
    const calls: string[] = [];
    const client = singleBookingClient(calls);

    const result = await prepareReservationBooking({
      client,
      config: { defaultHotelId: "property-small-hotel", defaultPropertyId: "property-small-hotel" },
      request: {
        capabilityId: "pms_reservation_prepare_booking",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "洞穴",
        roomNumber: "d2",
        quantity: 1,
      },
    });

    expect(result).toMatchObject({ source: { method: "prepareReservationConfirm" }, data: { pendingActionId: "pending_single_1" } });
    expect(calls).toEqual([
      "roomTypeCatalog",
      "searchAvailability:秘境洞穴",
      "createReservationDraft:room-D2:秘境洞穴",
      "quoteReservationDraft:draft_single_1",
      "prepareReservationConfirm:draft_single_1:quote_single_1",
    ]);
  });

  it("auto-selects the first available room when no room number is specified", async () => {
    const calls: string[] = [];
    const client = singleBookingClient(calls);

    const result = await prepareReservationBooking({
      client,
      config: { defaultHotelId: "property-small-hotel", defaultPropertyId: "property-small-hotel" },
      request: {
        capabilityId: "pms_reservation_prepare_booking",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "秘境洞穴",
        roomId: "DEFAULT",
        roomNumber: "未指定",
      },
    });

    expect(result).toMatchObject({ source: { method: "prepareReservationConfirm" } });
    expect(calls).toContain("createReservationDraft:room-D1:秘境洞穴");
  });

  it("rejects a requested room number that is not currently available", async () => {
    const result = await prepareReservationBooking({
      client: singleBookingClient([]),
      config: { defaultHotelId: "property-small-hotel", defaultPropertyId: "property-small-hotel" },
      request: {
        capabilityId: "pms_reservation_prepare_booking",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "秘境洞穴",
        roomNumber: "D9",
      },
    });

    expect(result).toMatchObject({
      kind: "pms_workflow_rejected",
      errors: [{ code: "RESERVATION_ROOM_UNAVAILABLE", field: "roomNumber" }],
    });
    expect(result.summary).toContain("D9");
    expect(result.summary).toContain("D1");
    expect(result.summary).toContain("D2");
  });

  it("rejects room types that are not configured in the catalog", async () => {
    const result = await prepareReservationBooking({
      client: singleBookingClient([]),
      config: { defaultHotelId: "property-small-hotel", defaultPropertyId: "property-small-hotel" },
      request: {
        capabilityId: "pms_reservation_prepare_booking",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "大床房",
      },
    });

    expect(result).toMatchObject({
      kind: "pms_workflow_rejected",
      errors: [{ code: "RESERVATION_ROOM_TYPE_NOT_CONFIGURED", field: "roomType" }],
    });
    expect(result.summary).toContain("花园别墅");
    expect(result.summary).toContain("秘境洞穴");
  });
});

function singleBookingClient(calls: string[]): SingleBookingPmsClient {
  return {
    roomTypeCatalog: async () => {
      calls.push("roomTypeCatalog");
      return createPmsEvidence({
        method: "roomTypeCatalog",
        tenantId: "tenant_1",
        fetchedAt: "2026-05-06T12:00:00.000Z",
        summary: "catalog",
        data: {
          roomTypes: [
            { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
            { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" },
          ],
        },
      });
    },
    searchAvailability: async (input) => {
      calls.push(`searchAvailability:${input.roomType ?? "all"}`);
      return createPmsEvidence({
        method: "searchAvailability",
        tenantId: "tenant_1",
        fetchedAt: "2026-05-06T12:01:00.000Z",
        summary: "availability",
        data: {
          rooms: [
            { roomId: "room-D1", roomNumber: "D1", roomTypeId: "room-type-cave", roomType: "秘境洞穴", available: true },
            { roomId: "room-D2", roomNumber: "D2", roomTypeId: "room-type-cave", roomType: "秘境洞穴", available: true },
          ],
        },
      });
    },
    createReservationDraft: async (input) => {
      calls.push(`createReservationDraft:${input.roomId}:${input.roomType ?? "none"}`);
      return createPmsEvidence({
        method: "createReservationDraft",
        tenantId: "tenant_1",
        fetchedAt: "2026-05-06T12:02:00.000Z",
        summary: "draft",
        data: { draftRef: "draft_single_1", status: "collectingSlots" },
      });
    },
    quoteReservationDraft: async (input) => {
      calls.push(`quoteReservationDraft:${input.draftRef ?? input.draftId ?? "missing"}`);
      return createPmsEvidence({
        method: "quoteReservationDraft",
        tenantId: "tenant_1",
        fetchedAt: "2026-05-06T12:03:00.000Z",
        summary: "quote",
        data: { quoteRef: "quote_single_1", status: "pricingUnsupported" },
      });
    },
    prepareReservationConfirm: async (input) => {
      calls.push(`prepareReservationConfirm:${input.draftRef ?? input.draftId ?? "missing"}:${input.quoteRef ?? "missing"}`);
      return createPmsEvidence({
        method: "prepareReservationConfirm",
        tenantId: "tenant_1",
        fetchedAt: "2026-05-06T12:04:00.000Z",
        summary: "prepared",
        data: {
          pendingActionId: "pending_single_1",
          pendingActionRef: "pending_single_1",
          confirmationMode: "typedCardOnly",
          mutationStatus: "none",
          quoteRef: input.quoteRef,
          selectionCount: 1,
        },
      });
    },
  };
}
