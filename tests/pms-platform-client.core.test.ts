import { describe, expect, it } from "vitest";
import {
  createPmsPlatformClient,
  PmsPlatformClientError,
  PmsPlatformRejectedError
} from "../packages/pms-platform-client/src/index.js";
import { fakeFetch, type FetchCall } from "./pms-platform-client.helpers.js";

describe("PMS Platform client core evidence", () => {
  it("wraps every PMS fact method in evidence", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local/",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-06T12:00:00.000Z"),
      authToken: "secret-token"
    });

    const manifest = await client.capabilitiesManifest({ tenantId: "tenant_1" });
    const profile = await client.hotelProfile({ tenantId: "tenant_1", propertyId: "property-small-hotel" });
    const catalog = await client.roomTypeCatalog({ tenantId: "tenant_1", propertyId: "property-small-hotel" });
    const availability = await client.searchAvailability({ tenantId: "tenant_1", hotelId: "hotel_1", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });
    const room = await client.getRoom({ tenantId: "tenant_1", roomId: "room_1" });
    const reservation = await client.getReservation({ tenantId: "tenant_1", reservationId: "res_1" });
    const createdDraft = await client.createReservationDraft({ tenantId: "tenant_1", roomId: "room_1", guestName: "Guest", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });
    const updatedDraft = await client.updateReservationDraft({ tenantId: "tenant_1", draftId: "draft_1", patch: { guestName: "Guest Two" } });
    const quote = await client.quoteReservationDraft({ tenantId: "tenant_1", draftId: "draft_1" });
    const prepareConfirm = await client.prepareReservationConfirm({ tenantId: "tenant_1", draftId: "draft_1" });
    const pendingStatus = await client.pendingActionStatus({ tenantId: "tenant_1", pendingActionId: "pending_1" });
    const confirm = await client.confirmPendingAction({ tenantId: "tenant_1", pendingActionId: "pending_1", cardPayloadRef: "card_1", actor: { type: "human", id: "staff_1" } });
    const cancel = await client.cancelPendingAction({ tenantId: "tenant_1", pendingActionId: "pending_1", cardPayloadRef: "card_1", actor: { type: "human", id: "staff_1" }, reason: "wrong guest" });

    for (const evidence of [manifest, profile, catalog, availability, room, reservation, createdDraft, updatedDraft, quote, prepareConfirm, pendingStatus, confirm, cancel]) {
      expect(evidence.evidenceRef).toMatch(/^pms_ev_tenant_1_/);
      expect(evidence.fetchedAt).toBe("2026-05-06T12:00:00.000Z");
      expect(evidence.source.system).toBe("pms-platform");
      expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
      expect(evidence.summary).not.toContain("secret-token");
    }

    expect(profile.data).toMatchObject({ propertyId: "property-small-hotel", propertyName: "PMS 小型酒店样板", roomTotal: 13 });
    expect(profile.summary).toContain("13 rooms");
    expect(catalog.data.roomTypes).toEqual([
      { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
      { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
      { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
    ]);
    expect(availability.data.rooms).toEqual([]);
    expect(availability.summary).toBe("Availability search returned 0 rooms.");
    expect(calls[3].body).toMatchObject({ checkInDate: "2026-05-06", checkOutDate: "2026-05-07", startDate: "2026-05-06", endDate: "2026-05-07" });
    expect(prepareConfirm.data).toMatchObject({ pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(pendingStatus.data).toEqual({ pendingActionId: "pending_1", status: "pending" });
    expect(confirm.data).toMatchObject({ pendingActionId: "pending_1", status: "confirmed", mutationStatus: "committed", auditRefs: ["audit_pending_confirm_1"], reservationCode: "RES-001" });
    expect(cancel.data).toMatchObject({ pendingActionId: "pending_1", status: "cancelled", mutationStatus: "none", auditRefs: ["audit_pending_cancel_1"] });
    expect(calls.map((call) => call.url)).toEqual([
      "https://pms.local/v1/pms/capabilities/manifest",
      "https://pms.local/v1/pms/hotel/profile",
      "https://pms.local/v1/pms/room-types/catalog",
      "https://pms.local/v1/pms/availability/search",
      "https://pms.local/v1/pms/room",
      "https://pms.local/v1/pms/reservations/get",
      "https://pms.local/v1/pms/reservation-drafts/create",
      "https://pms.local/v1/pms/reservation-drafts/update",
      "https://pms.local/v1/pms/reservation-drafts/quote",
      "https://pms.local/v1/pms/reservation-drafts/prepare-confirm",
      "https://pms.local/v1/pms/pending-actions/status",
      "https://pms.local/v1/pms/pending-actions/confirm",
      "https://pms.local/v1/pms/pending-actions/cancel"
    ]);
  });

  it("accepts current pms-platform local availability envelopes", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          operation: "pms_availability_search",
          readModel: {
            candidates: [
              { roomId: "room-A1", roomNumber: "A1", propertyId: "property-small-hotel", roomTypeId: "room-type-garden-villa", roomType: "花园别墅", availableDates: ["2026-05-06"], sourceRefs: ["inventory:room-A1"] }
            ]
          }
        })
      }),
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const evidence = await client.searchAvailability({ tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });

    expect(evidence.data.rooms).toEqual([{
      roomId: "room-A1",
      roomNumber: "A1",
      roomTypeId: "room-type-garden-villa",
      roomType: "花园别墅",
      available: true,
      availableDates: ["2026-05-06"],
      sourceRefs: ["inventory:room-A1"]
    }]);
  });

  it("keeps the client method set typed and MVP-only", () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    expect(Object.keys(client).sort()).toEqual([
      "cancelPendingAction",
      "capabilitiesManifest",
      "confirmPendingAction",
      "createReservationDraft",
      "createReservationGroupDraft",
      "getReservation",
      "getRoom",
      "health",
      "hotelProfile",
      "inventorySummary",
      "pendingActionStatus",
      "prepareReservationConfirm",
      "prepareReservationGroupConfirm",
      "quoteReservationDraft",
      "quoteReservationGroupDraft",
      "reservationLookup",
      "roomReservationContext",
      "roomTypeCatalog",
      "searchAvailability",
      "todayArrivals",
      "todayDepartures",
      "updateReservationDraft",
      "updateReservationGroupDraft"
    ]);
    expect("request" in client).toBe(false);
  });

  it("returns health without treating it as PMS fact evidence", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    expect(await client.health()).toEqual({ ok: true });
  });

  it("redacts actionable PMS errors", async () => {
    const httpErrorClient = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({ ok: false, status: 503, json: async () => ({ secret: "raw-platform-secret" }) })
    });
    const invalidResponseClient = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ roomId: "room_secret_1", roomType: "deluxe", status: "" }) })
    });

    await expect(httpErrorClient.getRoom({ tenantId: "tenant_1", roomId: "room_secret_1" })).rejects.toMatchObject({
      name: "PmsPlatformClientError",
      operation: "getRoom",
      causeCode: "http_error",
      status: 503
    });
    await expect(invalidResponseClient.getRoom({ tenantId: "tenant_1", roomId: "room_secret_1" })).rejects.toMatchObject({
      name: "PmsPlatformClientError",
      operation: "getRoom",
      causeCode: "invalid_response"
    });

    for (const action of [
      () => httpErrorClient.getRoom({ tenantId: "tenant_1", roomId: "room_secret_1" }),
      () => invalidResponseClient.getRoom({ tenantId: "tenant_1", roomId: "room_secret_1" })
    ]) {
      try {
        await action();
      } catch (error) {
        expect(error).toBeInstanceOf(PmsPlatformClientError);
        expect(String(error)).toContain("PMS getRoom failed");
        expect(String(error)).not.toContain("room_secret_1");
        expect(String(error)).not.toContain("raw-platform-secret");
      }
    }
  });

  it("parses structured workflow rejections instead of treating them as invalid responses", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: false,
          operation: "pms.reservation.group_quote",
          status: "rejected",
          mutationStatus: "none",
          groupDraft: { groupDraftRef: "group_1", status: "collectingSlots", missingSlots: ["roomSelections"] },
          errors: [{ code: "RESERVATION_GROUP_DRAFT_MISSING_REQUIRED_SLOTS", message: "Reservation group draft is missing required slots.", field: "missingSlots" }],
        }),
      }),
    });

    await expect(client.quoteReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: "group_1" }))
      .rejects.toMatchObject({
        name: "PmsPlatformRejectedError",
        result: {
          operation: "pms.reservation.group_quote",
          errors: [{ code: "RESERVATION_GROUP_DRAFT_MISSING_REQUIRED_SLOTS" }],
          missingSlots: ["roomSelections"],
          summary: "草稿缺少房间选择，无法报价。 缺失项：roomSelections。",
        },
      });
    await expect(client.quoteReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: "group_1" }))
      .rejects.toBeInstanceOf(PmsPlatformRejectedError);
  });
});
