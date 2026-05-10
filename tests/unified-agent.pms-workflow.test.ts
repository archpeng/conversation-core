import { describe, expect, it } from "vitest";
import { createPmsEvidence, PmsPlatformRejectedError, type PmsWorkflowRejectedResult } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PmsReadExecutorMap, type PmsWorkflowExecutorMap } from "../packages/unified-agent/src/index.js";
import { baseTurn, fakeCreateAgentSessionWithAssistantText, fakeCreateAgentSessionWithToolCalls, safetyGateway } from "./unified-agent.helpers.js";

describe("unified Agent Pi-native PMS tools", () => {
  it("uses Pi-native PMS safe-read tool results as the primary live path", async () => {
    const order: string[] = [];
    const evidence = availabilityEvidence("availability from Pi tool");
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_availability_search", params: { checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } }],
        text: "PMS 证据显示有可订候选。"
      }]),
      executors: { pmsReadExecutors: readExecutors(evidence) }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toMatchObject({ type: "text", evidenceRefs: [evidence.evidenceRef] });
    expect(order).toEqual(["decide:pms_availability_search", "audit:allow"]);
    expect(session.state.evidenceRefs).toEqual([evidence.evidenceRef]);
    expect(JSON.stringify(result)).not.toContain("room_secret");
  });

  it("lets Pi combine availability and inventory evidence before answering discrepancies", async () => {
    const availability = availabilityEvidence("12 full-stay candidates");
    const inventory = createPmsEvidence({
      method: "inventorySummary",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "13 total rooms; 12 available; 1 reserved",
      data: { dates: [{ date: "2026-05-09", total: 13, available: 12, reserved: 1, blocked: 0, occupied: 0 }] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [
          { toolName: "pms_availability_search", params: { checkInDate: "2026-05-09", checkOutDate: "2026-05-16" } },
          { toolName: "pms_inventory_summary", params: { startDate: "2026-05-09", endDate: "2026-05-16" } }
        ],
        text: "PMS availability returned 12 full-stay candidates; inventory shows 13 total rooms and 1 reserved."
      }]),
      executors: { pmsReadExecutors: readExecutors(availability, inventory) }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "为什么是12间? 我们有13间客房" } });

    expect(result).toMatchObject({ type: "text", evidenceRefs: [availability.evidenceRef, inventory.evidenceRef] });
    expect(result.type === "text" ? result.text : "").toContain("13 total rooms");
  });

  it("turns draft/quote/prepare-confirm tool evidence into an approval card without final mutation tools", async () => {
    const order: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [
          { toolName: "pms_reservation_draft_create", params: { roomId: "room-A1", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } },
          { toolName: "pms_reservation_quote", params: { draftRef: "draft_1" } },
          { toolName: "pms_reservation_prepare_confirm", params: { draftRef: "draft_1", quoteRef: "quote_1" } }
        ],
        text: "PMS 已准备预订审批卡。"
      }]),
      executors: { pmsWorkflowExecutors: workflowExecutors() }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "帮王晓订 2026-05-09 大床房" } });

    expect(result).toMatchObject({ type: "approval_card", card: { ref: { pendingActionId: "pending_1" } } });
    expect(session.tools.some((tool) => tool.name === "gated_pms_confirm" || tool.name === "pms_confirm")).toBe(false);
    expect(order).toEqual([
      "decide:pms_reservation_draft_create", "audit:allow",
      "decide:pms_reservation_quote", "audit:allow",
      "decide:pms_reservation_prepare_confirm", "audit:allow"
    ]);
  });

  it("uses the composite group booking workflow to prepare a multi-room approval card", async () => {
    const order: string[] = [];
    const calls: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{
          toolName: "pms_reservation_group_prepare_booking",
          params: {
            guestName: "莉莉",
            checkInDate: "2026-05-12",
            checkOutDate: "2026-05-14",
            roomType: "花园别墅",
            quantity: 2
          }
        }],
        text: "PMS 已准备多房预订确认卡。"
      }]),
      executors: { pmsWorkflowExecutors: workflowExecutors(calls) }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "给莉莉订两间花园别墅" } });

    expect(result).toMatchObject({ type: "approval_card", card: { ref: { pendingActionId: "pending_group_booking_1", selectionCount: 2 } } });
    expect(calls).toEqual(["pms_reservation_group_prepare_booking"]);
    expect(order).toEqual(["decide:pms_reservation_group_prepare_booking", "audit:allow"]);
  });

  it("uses the composite single booking workflow to prepare an approval card without exposing draft refs to Pi", async () => {
    const order: string[] = [];
    const calls: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{
          toolName: "pms_reservation_prepare_booking",
          params: {
            guestName: "花理论",
            checkInDate: "2026-05-11",
            checkOutDate: "2026-05-12",
            roomType: "洞穴",
            roomNumber: "d2",
            quantity: 1
          }
        }],
        text: "PMS 已准备单房预订确认卡。"
      }]),
      executors: { pmsWorkflowExecutors: workflowExecutors(calls) }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "选择d2，发卡片给我确认" } });

    expect(result).toMatchObject({ type: "approval_card", card: { ref: { pendingActionId: "pending_single_booking_1", selectionCount: 1 } } });
    expect(calls).toEqual(["pms_reservation_prepare_booking"]);
    expect(order).toEqual(["decide:pms_reservation_prepare_booking", "audit:allow"]);
  });

  it("surfaces structured PMS workflow rejection instead of a generic platform error", async () => {
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_reservation_group_quote", params: { groupDraftRef: "group_missing_selection" } }],
        text: ""
      }]),
      executors: {
        pmsWorkflowExecutors: {
          ...workflowExecutors(),
          pms_reservation_group_quote: () => {
            throw new PmsPlatformRejectedError(groupQuoteMissingSelectionsRejection());
          }
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "重新报价" } });

    expect(result).toEqual({ type: "refusal", reason: "unsupported", message: "草稿缺少房间选择，无法报价。 缺失项：roomSelections。" });
  });

  it("does not run deterministic booking fallback when Pi already called a safe read tool", async () => {
    const calls: string[] = [];
    const evidence = availabilityEvidence("planner chose availability");
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_availability_search", params: { checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } }],
        text: "PMS 证据显示有可订候选。"
      }]),
      executors: {
        pmsReadExecutors: readExecutors(evidence, undefined, calls),
        pmsWorkflowExecutors: workflowExecutors(calls)
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "book 2026-05-09 suite" } });

    expect(result).toMatchObject({ type: "text", evidenceRefs: [evidence.evidenceRef] });
    expect(calls).toEqual(["pms_availability_search"]);
  });

  it("treats old JSON plan text as natural text, not a compatibility execution path", async () => {
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } })),
      executors: { pmsReadExecutors: readExecutors(availabilityEvidence("should not run")) }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({ type: "text", text: "{\"type\":\"call_tool\",\"toolName\":\"gated_pms_read\",\"params\":{\"target\":\"availability\"}}" });
    expect(session.state.evidenceRefs).toEqual([]);
  });
});

function groupQuoteMissingSelectionsRejection(): PmsWorkflowRejectedResult {
  return {
    kind: "pms_workflow_rejected",
    origin: "pms-platform",
    operation: "pms.reservation.group_quote",
    status: "rejected",
    mutationStatus: "none",
    errors: [{ code: "RESERVATION_GROUP_DRAFT_MISSING_REQUIRED_SLOTS", message: "Reservation group draft is missing required slots.", field: "missingSlots" }],
    missingSlots: ["roomSelections"],
    summary: "草稿缺少房间选择，无法报价。 缺失项：roomSelections。"
  };
}

function availabilityEvidence(summary: string) {
  return createPmsEvidence({
    method: "searchAvailability",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    summary,
    data: { rooms: [{ roomId: "room_secret", roomType: "suite", available: true }] }
  });
}

function readExecutors(
  availability: ReturnType<typeof availabilityEvidence>,
  inventory?: ReturnType<typeof createPmsEvidence>,
  calls?: string[]
): PmsReadExecutorMap {
  const inventoryEvidence = inventory ?? createPmsEvidence({
    method: "inventorySummary",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    summary: "inventory",
    data: { dates: [] }
  });
  return {
    pms_hotel_profile: () => availability as never,
    pms_room_type_catalog: () => availability as never,
    pms_availability_search: ({ request }) => {
      calls?.push(request.capabilityId);
      return availability;
    },
    pms_inventory_summary: () => inventoryEvidence as never,
    pms_room_reservation_context: () => availability as never,
    pms_reservation_lookup: () => availability as never,
    pms_get_room: () => availability as never,
    pms_today_arrivals: () => availability as never,
    pms_today_departures: () => availability as never,
    pms_pending_action_status: () => availability as never
  };
}

function workflowExecutors(calls?: string[]): PmsWorkflowExecutorMap {
  return {
    pms_reservation_draft_create: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "createReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "draft", data: { draftRef: "draft_1", status: "collectingSlots" } });
    },
    pms_reservation_draft_update: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "updateReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "draft", data: { draftRef: "draft_1", status: "collectingSlots" } });
    },
    pms_reservation_quote: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "quoteReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "quote", data: { quoteRef: "quote_1", status: "pricingUnsupported" } });
    },
    pms_reservation_prepare_confirm: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "prepareReservationConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "prepare", data: { pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none", quoteRef: request.quoteRef } });
    },
    pms_reservation_prepare_booking: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "prepareReservationConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "single booking prepare", data: { pendingActionId: "pending_single_booking_1", pendingActionRef: "pending_single_booking_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: request.quantity ?? 1 } });
    },
    pms_reservation_group_draft_create: () => createPmsEvidence({ method: "createReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group draft", data: { groupDraftRef: "group_1", status: "collectingSlots" } }) as never,
    pms_reservation_group_draft_update: () => createPmsEvidence({ method: "updateReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group draft", data: { groupDraftRef: "group_1", status: "quoteReady" } }) as never,
    pms_reservation_group_quote: () => createPmsEvidence({ method: "quoteReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group quote", data: { quoteRef: "group_quote_1", status: "pricingUnsupported" } }) as never,
    pms_reservation_group_prepare_confirm: () => createPmsEvidence({ method: "prepareReservationGroupConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group prepare", data: { pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: 2 } }) as never,
    pms_reservation_group_prepare_booking: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "prepareReservationGroupConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group booking prepare", data: { pendingActionId: "pending_group_booking_1", pendingActionRef: "pending_group_booking_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: request.quantity } });
    }
  };
}
