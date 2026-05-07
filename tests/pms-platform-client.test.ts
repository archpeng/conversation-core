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

  it("keeps the client method set typed and MVP-only", () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    expect(Object.keys(client).sort()).toEqual([
      "capabilitiesManifest",
      "createReservationDraft",
      "getReservation",
      "getRoom",
      "health",
      "pendingActionStatus",
      "prepareReservationConfirm",
      "quoteReservationDraft",
      "searchAvailability",
      "updateReservationDraft"
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
  throw new Error(`unexpected PMS route ${url}`);
}
