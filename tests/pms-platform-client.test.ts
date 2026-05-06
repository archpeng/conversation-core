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
