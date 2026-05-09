import { describe, expect, it } from "vitest";
import {
  createPmsPlatformClient,
  PmsPlatformClientError,
  type PmsFetch
} from "../packages/pms-platform-client/src/index.js";

describe("PMS Platform client evidence", () => {
  it("wraps every PMS fact method in evidence", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local/",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-06T12:00:00.000Z"),
      authToken: "secret-token"
    });

    const manifest = await client.capabilitiesManifest({ tenantId: "tenant_1" });
    const availability = await client.searchAvailability({ tenantId: "tenant_1", hotelId: "hotel_1", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });
    const room = await client.getRoom({ tenantId: "tenant_1", roomId: "room_1" });
    const reservation = await client.getReservation({ tenantId: "tenant_1", reservationId: "res_1" });
    const createdDraft = await client.createReservationDraft({ tenantId: "tenant_1", roomId: "room_1", guestName: "Guest", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });
    const updatedDraft = await client.updateReservationDraft({ tenantId: "tenant_1", draftId: "draft_1", patch: { guestName: "Guest Two" } });
    const quote = await client.quoteReservationDraft({ tenantId: "tenant_1", draftId: "draft_1" });
    const prepareConfirm = await client.prepareReservationConfirm({ tenantId: "tenant_1", draftId: "draft_1" });
    const pendingStatus = await client.pendingActionStatus({ tenantId: "tenant_1", pendingActionId: "pending_1" });

    for (const evidence of [manifest, availability, room, reservation, createdDraft, updatedDraft, quote, prepareConfirm, pendingStatus]) {
      expect(evidence.evidenceRef).toMatch(/^pms_ev_tenant_1_/);
      expect(evidence.fetchedAt).toBe("2026-05-06T12:00:00.000Z");
      expect(evidence.source.system).toBe("pms-platform");
      expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
      expect(evidence.summary).not.toContain("secret-token");
    }

    expect(availability.data.rooms).toEqual([]);
    expect(availability.summary).toBe("Availability search returned 0 rooms.");
    expect(calls[1].body).toMatchObject({ checkInDate: "2026-05-06", checkOutDate: "2026-05-07", startDate: "2026-05-06", endDate: "2026-05-07" });
    expect(prepareConfirm.data).toMatchObject({ pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(pendingStatus.data).toEqual({ pendingActionId: "pending_1", status: "pending" });
    expect(calls.map((call) => call.url)).toEqual([
      "https://pms.local/v1/pms/capabilities/manifest",
      "https://pms.local/v1/pms/availability/search",
      "https://pms.local/v1/pms/room",
      "https://pms.local/v1/pms/reservations/get",
      "https://pms.local/v1/pms/reservation-drafts/create",
      "https://pms.local/v1/pms/reservation-drafts/update",
      "https://pms.local/v1/pms/reservation-drafts/quote",
      "https://pms.local/v1/pms/reservation-drafts/prepare-confirm",
      "https://pms.local/v1/pms/pending-actions/status"
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
              { roomId: "room-A1", roomNumber: "A1", propertyId: "property-small-hotel", roomType: "花园别墅" }
            ]
          }
        })
      }),
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const evidence = await client.searchAvailability({ tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-06", checkOutDate: "2026-05-07" });

    expect(evidence.data.rooms).toEqual([{ roomId: "room-A1", roomType: "花园别墅", available: true }]);
  });

  it("accepts current pms-platform local reservation workflow envelopes", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        if (url.endsWith("/v1/pms/reservation-drafts/create")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.create", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) };
        }
        if (url.endsWith("/v1/pms/reservation-drafts/quote")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.quote", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], quote: { quoteRef: "quote-ref-1", status: "pricingUnsupported" } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.prepare_confirm", mutationStatus: "none", draft: { draftRef: "draft_ref_1", status: "awaitingConfirmation", missingSlots: [], evidenceRefs: [], pendingAction: { pendingActionRef: "pending-action-ref-1", cardPayloadRef: "card-payload-ref-1", quoteRef: "quote-ref-1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation" } } }) };
        }
        throw new Error(`unexpected route ${url}`);
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const draft = await client.createReservationDraft({ tenantId: "tenant_1", propertyId: "property-small-hotel", roomId: "room-A1", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", sourceEvidenceRef: "pms_ev_1" });
    const quote = await client.quoteReservationDraft({ tenantId: "tenant_1", draftRef: draft.data.draftRef });
    const prepared = await client.prepareReservationConfirm({ tenantId: "tenant_1", draftRef: draft.data.draftRef, quoteRef: quote.data.quoteRef });

    expect(draft.data).toEqual({ draftRef: "draft_ref_1", status: "collectingSlots" });
    expect(quote.data).toEqual({ quoteRef: "quote-ref-1", status: "pricingUnsupported" });
    expect(prepared.data).toMatchObject({ pendingActionId: "pending-action-ref-1", cardPayloadRef: "card-payload-ref-1", quoteRef: "quote-ref-1", confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.draft.create",
      propertyId: "property-small-hotel",
      actor: { type: "ai", id: "pms-agent-v2" },
      source: "api",
      slots: { roomId: "room-A1", guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", selectedCandidateRef: "pms_ev_1:room-A1" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
    expect(calls[1].body).toMatchObject({ operation: "pms.reservation.quote", draftRef: "draft_ref_1" });
    expect(calls[2].body).toMatchObject({ operation: "pms.reservation.prepare_confirm", draftRef: "draft_ref_1", quoteRef: "quote-ref-1" });
  });

  it("maps draft update patches to current pms-platform slot update envelopes", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.update", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) };
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const updated = await client.updateReservationDraft({
      tenantId: "tenant_1",
      draftRef: "draft_ref_1",
      patch: { roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" },
      sourceEvidenceRef: "pms_ev_1"
    });

    expect(updated.data).toEqual({ draftRef: "draft_ref_1", status: "collectingSlots" });
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.draft.update",
      draftRef: "draft_ref_1",
      slots: { roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
  });

  it("accepts current pms-platform local reservation group workflow envelopes", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        if (url.endsWith("/v1/pms/reservation-group-drafts/create")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.create", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "collectingSlots", missingSlots: ["roomSelections"], evidenceRefs: [] } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/update")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.update", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], slots: { selections: [{ roomId: "room-A1" }, { roomId: "room-A2" }] } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/quote")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_quote", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", quote: { quoteRef: "group_quote_ref_1", status: "pricingUnsupported" } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/prepare-confirm")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_prepare_confirm", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "awaitingConfirmation", pendingAction: { pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation", selectionCount: 2 } } }) };
        }
        throw new Error(`unexpected route ${url}`);
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const draft = await client.createReservationGroupDraft({ tenantId: "tenant_1", propertyId: "property-small-hotel", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, roomType: "suite", sourceEvidenceRef: "pms_ev_1" });
    const updated = await client.updateReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef, selections: [{ roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1", roomType: "suite" }, { roomId: "room-A2", selectedCandidateRef: "pms_ev_1:room-A2", roomType: "suite" }], sourceEvidenceRef: "pms_ev_1" });
    const quote = await client.quoteReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef });
    const prepared = await client.prepareReservationGroupConfirm({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef, quoteRef: quote.data.quoteRef });

    expect(draft.data).toEqual({ groupDraftRef: "group_draft_ref_1", status: "collectingSlots" });
    expect(updated.data).toEqual({ groupDraftRef: "group_draft_ref_1", status: "quoteReady" });
    expect(quote.data).toEqual({ quoteRef: "group_quote_ref_1", status: "pricingUnsupported" });
    expect(prepared.data).toMatchObject({ pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", selectionCount: 2, confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(calls.map((call) => call.url)).toEqual([
      "https://pms.local/v1/pms/reservation-group-drafts/create",
      "https://pms.local/v1/pms/reservation-group-drafts/update",
      "https://pms.local/v1/pms/reservation-group-drafts/quote",
      "https://pms.local/v1/pms/reservation-group-drafts/prepare-confirm"
    ]);
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.group_draft.create",
      slots: { guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", quantity: 2, roomTypeKeyword: "suite" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
    expect(calls[1].body).toMatchObject({
      operation: "pms.reservation.group_draft.update",
      groupDraftRef: "group_draft_ref_1",
      slots: { selections: [{ roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" }, { roomId: "room-A2", selectedCandidateRef: "pms_ev_1:room-A2" }] }
    });
    expect(calls[2].body).toMatchObject({ operation: "pms.reservation.group_quote", groupDraftRef: "group_draft_ref_1" });
    expect(calls[3].body).toMatchObject({ operation: "pms.reservation.group_prepare_confirm", groupDraftRef: "group_draft_ref_1", quoteRef: "group_quote_ref_1" });
  });

  it("keeps the client method set typed and MVP-only", () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    expect(Object.keys(client).sort()).toEqual([
      "capabilitiesManifest",
      "createReservationDraft",
      "createReservationGroupDraft",
      "getReservation",
      "getRoom",
      "health",
      "inventorySummary",
      "pendingActionStatus",
      "prepareReservationConfirm",
      "prepareReservationGroupConfirm",
      "quoteReservationDraft",
      "quoteReservationGroupDraft",
      "reservationLookup",
      "roomReservationContext",
      "searchAvailability",
      "todayArrivals",
      "todayDepartures",
      "updateReservationDraft",
      "updateReservationGroupDraft"
    ]);
    expect("request" in client).toBe(false);
    expect("confirmPendingAction" in client).toBe(false);
    expect("cancelPendingAction" in client).toBe(false);
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

  it("wraps inventorySummary in evidence with parsed result", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.inventorySummary({
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      startDate: "2026-05-09",
      endDate: "2026-05-10"
    });

    expect(evidence.source.method).toBe("inventorySummary");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(calls[0].body).toEqual({
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      startDate: "2026-05-09",
      horizonDays: 2
    });
    expect(evidence.summary).toContain("Inventory for");
    expect(evidence.summary).toContain("10 total rooms across 2 dates");
    expect(evidence.data.dates).toHaveLength(2);
    expect(evidence.data.dates[0]).toEqual({
      date: "2026-05-09",
      total: 10,
      available: 5,
      reserved: 3,
      blocked: 1,
      occupied: 1
    });
  });

  it("wraps roomReservationContext in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.roomReservationContext({
      tenantId: "tenant_1",
      roomId: "room_1"
    });

    expect(evidence.source.method).toBe("roomReservationContext");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("Room room_1: current status occupied, associated with 3 reservation(s)/block(s).");
    expect(evidence.data).toEqual({
      roomId: "room_1",
      currentStatus: "occupied",
      reservationRefs: ["res_ref_1", "res_ref_2"],
      blockRefs: ["block_ref_1"]
    });
  });

  it("wraps todayArrivals in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.todayArrivals({
      tenantId: "tenant_1",
      businessDate: "2026-05-09"
    });

    expect(evidence.source.method).toBe("todayArrivals");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("RES-001, RES-002");
    expect(evidence.data.arrivals).toHaveLength(2);
    expect(evidence.data.arrivals[0]).toEqual({
      reservationCode: "RES-001",
      roomId: "room_1",
      guestName: "Alice",
      status: "checkedIn"
    });
  });

  it("wraps todayDepartures in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.todayDepartures({
      tenantId: "tenant_1",
      businessDate: "2026-05-09"
    });

    expect(evidence.source.method).toBe("todayDepartures");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("RES-003");
    expect(evidence.data.departures).toHaveLength(1);
    expect(evidence.data.departures[0]).toEqual({
      reservationCode: "RES-003",
      roomId: "room_3",
      guestName: "Charlie",
      status: "checkedOut"
    });
  });

  it("supports reservationLookup by reservationCode", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.reservationLookup({
      tenantId: "tenant_1",
      reservationCode: "RES-001"
    });

    expect(evidence.source.method).toBe("reservationLookup");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.data).toMatchObject({ reservationId: "res_1" });
    expect(calls[calls.length - 1].body).toMatchObject({ tenantId: "tenant_1", reservationCode: "RES-001" });
  });

  it("rejects invalid inventorySummary input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    const invalidInputs = [
      { tenantId: "t", propertyId: "p", startDate: "invalid", endDate: "2026-05-10" },
      {} satisfies Partial<Record<string, unknown>>
    ];

    for (const invalid of invalidInputs) {
      try {
        await client.inventorySummary(invalid as never);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toMatchObject({
          name: "PmsPlatformClientError",
          operation: "inventorySummary",
          causeCode: "invalid_input"
        });
      }
    }
  });

  it("rejects invalid roomReservationContext input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    try {
      await client.roomReservationContext({} as never);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "roomReservationContext",
        causeCode: "invalid_input"
      });
    }
  });

  it("rejects invalid todayArrivals and todayDepartures input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    try {
      await client.todayArrivals({} as never);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayArrivals",
        causeCode: "invalid_input"
      });
    }
    try {
      await client.todayDepartures({} as never);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayDepartures",
        causeCode: "invalid_input"
      });
    }
  });

  it("returns HTTP error for new inventory endpoints", async () => {
    const errorClient = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({ ok: false, status: 503, json: async () => ({}) })
    });

    try {
      await errorClient.inventorySummary({
        tenantId: "tenant_1",
        propertyId: "property_small_hotel",
        startDate: "2026-05-09",
        endDate: "2026-05-10"
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "inventorySummary",
        causeCode: "http_error",
        status: 503
      });
    }
    try {
      await errorClient.todayArrivals({
        tenantId: "tenant_1",
        businessDate: "2026-05-09"
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayArrivals",
        causeCode: "http_error",
        status: 503
      });
    }
  });
});

function fakeFetch(calls: Array<{ url: string; method: string; body?: unknown }>): PmsFetch {
  return async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const body = responseFor(url);
    return { ok: true, status: 200, json: async () => body };
  };
}

function responseFor(url: string): unknown {
  if (url.endsWith("/health")) return { ok: true };
  if (url.endsWith("/v1/pms/capabilities/manifest")) return { capabilities: ["availability", "drafts", "pending_actions"] };
  if (url.endsWith("/v1/pms/availability/search")) return { rooms: [] };
  if (url.endsWith("/v1/pms/room")) return { roomId: "room_1", roomType: "deluxe", status: "available" };
  if (url.endsWith("/v1/pms/reservations/get")) return { reservationId: "res_1", status: "draft", roomId: "room_1" };
  if (url.endsWith("/v1/pms/reservation-drafts/create")) return { draftId: "draft_1", status: "created" };
  if (url.endsWith("/v1/pms/reservation-drafts/update")) return { draftId: "draft_1", status: "updated" };
  if (url.endsWith("/v1/pms/reservation-drafts/quote")) return { quoteId: "quote_1", totalCents: 12800, currency: "CNY" };
  if (url.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) return { pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" };
  if (url.endsWith("/v1/pms/pending-actions/status")) return { pendingActionId: "pending_1", status: "pending" };
  if (url.endsWith("/v1/pms/inventory/summary")) return {
    readModel: {
      summaries: [
        { businessDate: "2026-05-09", totalRooms: 4, availableRooms: 2, reservedRooms: 1, blockedRooms: 1, occupiedRooms: 0 },
        { businessDate: "2026-05-09", totalRooms: 6, availableRooms: 3, reservedRooms: 2, blockedRooms: 0, occupiedRooms: 1 },
        { businessDate: "2026-05-10", totalRooms: 4, availableRooms: 2, reservedRooms: 1, blockedRooms: 1, occupiedRooms: 0 },
        { businessDate: "2026-05-10", totalRooms: 6, availableRooms: 2, reservedRooms: 3, blockedRooms: 0, occupiedRooms: 1 }
      ]
    }
  };
  if (url.endsWith("/v1/pms/room/reservation-context")) return {
    roomId: "room_1",
    currentStatus: "occupied",
    reservationRefs: ["res_ref_1", "res_ref_2"],
    blockRefs: ["block_ref_1"]
  };
  if (url.endsWith("/v1/pms/arrivals/today")) return {
    arrivals: [
      { reservationCode: "RES-001", roomId: "room_1", guestName: "Alice", status: "checkedIn" },
      { reservationCode: "RES-002", roomId: "room_2", guestName: "Bob", status: "pending" }
    ]
  };
  if (url.endsWith("/v1/pms/departures/today")) return {
    departures: [
      { reservationCode: "RES-003", roomId: "room_3", guestName: "Charlie", status: "checkedOut" }
    ]
  };
  throw new Error(`unexpected PMS route ${url}`);
}
