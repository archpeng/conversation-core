import type { AvailabilitySearchResult, HotelProfileResult, InventorySummaryResult, RoomTypeCatalogResult } from "@pms-agent-v2/pms-platform-client";
import type { PmsReadExecutorMap, PmsWorkflowExecutorMap } from "@pms-agent-v2/unified-agent";
import { fakePmsEvidence } from "./eval-cases.helpers.js";

export function availabilitySafeReadExecutors(
  availabilityEvidence: ReturnType<typeof fakePmsEvidence<AvailabilitySearchResult>>,
  calls?: string[]
): PmsReadExecutorMap {
  const inventoryEvidence = fakePmsEvidence<InventorySummaryResult>({
    method: "inventorySummary",
    data: { dates: [{ date: "2026-05-06", total: 1, available: 1, reserved: 0, blocked: 0, occupied: 0 }] },
    summary: "inventory"
  });
  return {
    ...discrepancySafeReadExecutors(availabilityEvidence, inventoryEvidence),
    pms_availability_search: () => {
      calls?.push("pms_availability_search");
      return availabilityEvidence;
    }
  };
}

export function dynamicAvailabilitySafeReadExecutors(refs: string[], roomIdPrefix: string): PmsReadExecutorMap {
  const fallback = fakePmsEvidence<AvailabilitySearchResult>({
    method: "searchAvailability",
    data: { rooms: [] },
    summary: "availability"
  });
  return {
    ...availabilitySafeReadExecutors(fallback),
    pms_availability_search: () => {
      const item = fakePmsEvidence({
        method: "searchAvailability",
        fetchedAt: `2026-05-06T12:${String(refs.length).padStart(2, "0")}:00.000Z`,
        data: { rooms: [{ roomId: `${roomIdPrefix}_${refs.length}`, roomType: "suite", available: true }] },
        summary: "availability"
      });
      refs.push(item.evidenceRef);
      return item;
    }
  };
}

export function singleReservationWorkflowExecutors(calls: string[], pendingActionId = "pending_secret_prepare"): PmsWorkflowExecutorMap {
  return {
    pms_reservation_draft_create: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "createReservationDraft",
        data: { draftRef: "draft_eval_1", status: "collectingSlots" },
        summary: "draft created"
      });
    },
    pms_reservation_draft_update: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "updateReservationDraft",
        data: { draftRef: request.draftRef ?? "draft_eval_1", status: "collectingSlots" },
        summary: "draft updated"
      });
    },
    pms_reservation_quote: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "quoteReservationDraft",
        data: { quoteRef: "quote_eval_1", status: "pricingUnsupported" },
        summary: "draft quoted"
      });
    },
    pms_reservation_prepare_confirm: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "prepareReservationConfirm",
        data: { pendingActionId, confirmationMode: "typedCardOnly", mutationStatus: "none", quoteRef: request.quoteRef },
        summary: "prepare confirm"
      });
    },
    pms_reservation_group_draft_create: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "createReservationGroupDraft",
        data: { groupDraftRef: "group_draft_eval_1", status: "collectingSlots" },
        summary: "group draft created"
      });
    },
    pms_reservation_group_draft_update: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "updateReservationGroupDraft",
        data: { groupDraftRef: request.groupDraftRef ?? "group_draft_eval_1", status: "quoteReady" },
        summary: "group draft updated"
      });
    },
    pms_reservation_group_quote: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "quoteReservationGroupDraft",
        data: { quoteRef: "group_quote_eval_1", status: "pricingUnsupported" },
        summary: "group draft quoted"
      });
    },
    pms_reservation_group_prepare_confirm: ({ request }) => {
      calls.push(request.capabilityId);
      return fakePmsEvidence({
        method: "prepareReservationGroupConfirm",
        data: { pendingActionId, pendingActionRef: pendingActionId, confirmationMode: "typedCardOnly", mutationStatus: "none", quoteRef: request.quoteRef, selectionCount: 2 },
        summary: "group prepare confirm"
      });
    }
  };
}

export function discrepancySafeReadExecutors(
  availabilityEvidence: ReturnType<typeof fakePmsEvidence<AvailabilitySearchResult>>,
  inventoryEvidence: ReturnType<typeof fakePmsEvidence<InventorySummaryResult>>
): PmsReadExecutorMap {
  return {
    pms_hotel_profile: () => fakePmsEvidence<HotelProfileResult>({
      method: "hotelProfile",
      data: {
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
      },
      summary: "hotel profile"
    }),
    pms_room_type_catalog: () => fakePmsEvidence<RoomTypeCatalogResult>({
      method: "roomTypeCatalog",
      data: {
        propertyId: "property-small-hotel",
        roomTypes: [
          { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
          { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
          { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
        ]
      },
      summary: "room type catalog"
    }),
    pms_availability_search: () => availabilityEvidence,
    pms_inventory_summary: () => inventoryEvidence,
    pms_room_reservation_context: () => fakePmsEvidence({
      method: "roomReservationContext",
      data: { roomId: "room-1", currentStatus: "available", reservationRefs: [], blockRefs: [] },
      summary: "room context"
    }),
    pms_reservation_lookup: () => fakePmsEvidence({
      method: "reservationLookup",
      data: { reservationId: "res-1", status: "confirmed", roomId: "room-1" },
      summary: "reservation lookup"
    }),
    pms_get_room: () => fakePmsEvidence({
      method: "getRoom",
      data: { roomId: "room-1", roomType: "suite", status: "available" },
      summary: "room fact"
    }),
    pms_today_arrivals: () => fakePmsEvidence({
      method: "todayArrivals",
      data: { arrivals: [] },
      summary: "today arrivals"
    }),
    pms_today_departures: () => fakePmsEvidence({
      method: "todayDepartures",
      data: { departures: [] },
      summary: "today departures"
    }),
    pms_pending_action_status: () => fakePmsEvidence({
      method: "pendingActionStatus",
      data: { pendingActionId: "pending-1", status: "pending" },
      summary: "pending action status"
    })
  };
}
