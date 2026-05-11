import type { PmsFetch } from "../packages/pms-platform-client/src/index.js";

export type FetchCall = { url: string; method: string; body?: unknown };

export function fakeFetch(calls: FetchCall[]): PmsFetch {
  return async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const body = responseFor(url);
    return { ok: true, status: 200, json: async () => body };
  };
}

export function invalidPmsInput<T>(value: unknown): T {
  return value as T;
}

function responseFor(url: string): unknown {
  if (url.endsWith("/health")) return { ok: true };
  if (url.endsWith("/v1/pms/capabilities/manifest")) return { capabilities: ["availability", "drafts", "pending_actions"] };
  if (url.endsWith("/v1/pms/hotel/profile")) return {
    readModel: {
      propertyId: "property-small-hotel",
      propertyName: "PMS 小型酒店样板",
      timeZone: "Asia/Shanghai",
      status: "active",
      roomTotal: 13,
      roomTypes: [
        { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
        { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
        { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
      ]
    }
  };
  if (url.endsWith("/v1/pms/room-types/catalog")) return {
    readModel: {
      propertyId: "property-small-hotel",
      roomTypes: [
        { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
        { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
        { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
      ]
    }
  };
  if (url.endsWith("/v1/pms/availability/search")) return { rooms: [] };
  if (url.endsWith("/v1/pms/room")) return { roomId: "room_1", roomType: "deluxe", status: "available" };
  if (url.endsWith("/v1/pms/reservations/get")) return { reservationId: "res_1", status: "draft", roomId: "room_1" };
  if (url.endsWith("/v1/pms/reservation-drafts/create")) return { draftId: "draft_1", status: "created" };
  if (url.endsWith("/v1/pms/reservation-drafts/update")) return { draftId: "draft_1", status: "updated" };
  if (url.endsWith("/v1/pms/reservation-drafts/quote")) return { quoteId: "quote_1", totalCents: 12800, currency: "CNY" };
  if (url.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) return { pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" };
  if (url.endsWith("/v1/pms/pending-actions/status")) return { pendingActionId: "pending_1", status: "pending" };
  if (url.endsWith("/v1/pms/pending-actions/confirm")) return { ok: true, operation: "pms.pending_action.confirm", status: "ok", mutationStatus: "committed", idempotencyStatus: "confirmed", pendingAction: { pendingActionRef: "pending_1", status: "confirmed", auditRefs: [{ auditId: "audit_pending_confirm_1" }] }, reservation: { reservationCode: "RES-001" } };
  if (url.endsWith("/v1/pms/pending-actions/cancel")) return { ok: true, operation: "pms.pending_action.cancel", status: "ok", mutationStatus: "none", idempotencyStatus: "cancelled", pendingAction: { pendingActionRef: "pending_1", status: "cancelled", auditRefs: [{ auditId: "audit_pending_cancel_1" }] } };
  if (url.endsWith("/v1/pms/inventory/summary")) return {
    readModel: {
      summaries: [
        { businessDate: "2026-05-09", roomType: "花园套房", totalRooms: 4, availableRooms: 2, reservedRooms: 1, blockedRooms: 1, occupiedRooms: 0 },
        { businessDate: "2026-05-09", roomType: "花园别墅", totalRooms: 6, availableRooms: 3, reservedRooms: 2, blockedRooms: 0, occupiedRooms: 1 },
        { businessDate: "2026-05-10", roomType: "花园套房", totalRooms: 4, availableRooms: 2, reservedRooms: 1, blockedRooms: 1, occupiedRooms: 0 },
        { businessDate: "2026-05-10", roomType: "花园别墅", totalRooms: 6, availableRooms: 2, reservedRooms: 3, blockedRooms: 0, occupiedRooms: 1 }
      ]
    }
  };
  if (url.endsWith("/v1/pms/room/reservation-context")) return {
    roomId: "room_1",
    currentStatus: "occupied",
    reservationRefs: ["res_ref_1", "res_ref_2"],
    blockRefs: ["block_ref_1"]
  };
  if (url.endsWith("/v1/pms/reservations/today-arrivals")) return {
    arrivals: [
      { reservationCode: "RES-001", roomId: "room_1", guestName: "Alice", status: "checkedIn" },
      { reservationCode: "RES-002", roomId: "room_2", guestName: "Bob", status: "pending" }
    ]
  };
  if (url.endsWith("/v1/pms/reservations/today-departures")) return {
    departures: [
      { reservationCode: "RES-003", roomId: "room_3", guestName: "Charlie", status: "checkedOut" }
    ]
  };
  throw new Error(`unexpected PMS route ${url}`);
}
