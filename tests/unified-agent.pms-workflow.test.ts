import { describe, expect, it } from "vitest";
import { createPmsEvidence, PmsPlatformRejectedError, type InventorySummaryResult, type PmsWorkflowRejectedResult, type ReservationFact } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PmsReadExecutorMap, type PmsWorkflowExecutorMap } from "../packages/unified-agent/src/index.js";
import { publicToolResult } from "../packages/unified-agent/src/pms-public-tool-result.js";
import { baseTurn, fakeCreateAgentSessionWithAssistantText, fakeCreateAgentSessionWithToolCalls, pmsReadExecutors, safetyGateway } from "./unified-agent.helpers.js";

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

  it("publishes safe PMS data previews for aggregate lineage planning", () => {
    const evidence = aggregateInventoryEvidence();

    const result = publicToolResult({ outcome: "allow", auditId: "audit_1", value: evidence });

    expect(result).toMatchObject({
      outcome: "allow",
      capability: { answers: expect.arrayContaining(["aggregate_lineage"]) }
    });
    const preview = (result as { dataPreview?: { statusRefs?: unknown[] } }).dataPreview;
    expect(preview?.statusRefs).toContainEqual(expect.objectContaining({ roomNumber: "D3", status: "reserved", sourceRefs: [expect.objectContaining({ label: "RG-1" })] }));
    expect(JSON.stringify(result)).not.toContain("Reserved refs: RG-1@D3");
    expect(result).toMatchObject({ publicSummary: expect.stringContaining("statusRefCount=2") });
  });

  it("bounds PMS public tool previews while preserving counts", () => {
    const evidence = createPmsEvidence({
      method: "todayDepartures",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-13T08:00:00.000Z",
      summary: "8 departures.",
      data: {
        departures: Array.from({ length: 8 }, (_, index) => ({
          reservationCode: `R-${index + 1}`,
          roomId: `room-${index + 1}`,
          guestName: `Guest ${index + 1}`,
          status: "booked"
        }))
      }
    });

    const result = publicToolResult({ outcome: "allow", auditId: "audit_1", value: evidence });
    const preview = (result as { dataPreview?: { departureCount?: number; departures?: unknown[] } }).dataPreview;

    expect(preview?.departureCount).toBe(8);
    expect(preview?.departures).toHaveLength(5);
    expect(JSON.stringify(preview)).not.toContain("R-6");
    expect(JSON.stringify(result)).not.toContain("8 departures.");
    expect(result).toMatchObject({ publicSummary: "Today departures returned 8 reservation event(s)." });
  });

  it("repairs aggregate guest identity answers that skip inventory lineage", async () => {
    const prompts: string[] = [];
    const inventory = aggregateInventoryEvidence();
    const lookup1 = reservationEvidence("RG-1", "李小军", "D3");
    const lookup2 = reservationEvidence("RG-2", "李小军", "D4");
    const departures = createPmsEvidence({
      method: "todayDepartures",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-13T08:00:00.000Z",
      summary: "2 departures: R-1 李晶晶 room-D2 booked, R-2 张三 room-D1 booked.",
      data: { departures: [
        { reservationCode: "R-1", roomId: "room-D2", guestName: "李晶晶", status: "booked" },
        { reservationCode: "R-2", roomId: "room-D1", guestName: "张三", status: "booked" }
      ] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([
        {
          calls: [{ toolName: "pms_today_departures", params: { businessDate: "2026-05-13" } }],
          text: "这两间是李晶晶和张三。"
        },
        {
          calls: [
            { toolName: "pms_inventory_summary", params: { startDate: "2026-05-13", endDate: "2026-05-13" } },
            { toolName: "pms_reservation_lookup", params: { reservationCode: "RG-1" } },
            { toolName: "pms_reservation_lookup", params: { reservationCode: "RG-2" } }
          ],
          text: `明天已预订的 2 间来自李小军：RG-1 D3、RG-2 D4。evidenceRefs=${inventory.evidenceRef},${lookup1.evidenceRef},${lookup2.evidenceRef}`
        }
      ], prompts),
      executors: {
        pmsReadExecutors: pmsReadExecutors({
          pms_today_departures: () => departures,
          pms_inventory_summary: () => inventory,
          pms_reservation_lookup: ({ request }) => request.reservationCode === "RG-2" ? lookup2 : lookup1
        })
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "这里显示明天已预订两间，谁订的？" } });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Aggregate lineage verifier rejected");
    expect(result).toMatchObject({ type: "text", evidenceRefs: [inventory.evidenceRef, lookup1.evidenceRef, lookup2.evidenceRef] });
    expect(result.type === "text" ? result.text : "").toContain("李小军");
    expect(result.type === "text" ? result.text : "").not.toContain("李晶晶");
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
  return createPmsEvidence<InventorySummaryResult>({
    method: "searchAvailability",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    summary,
    data: { rooms: [{ roomId: "room_secret", roomType: "suite", available: true }] }
  });
}

function aggregateInventoryEvidence() {
  return createPmsEvidence<InventorySummaryResult>({
    method: "inventorySummary",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-13T08:00:00.000Z",
    summary: "Inventory for 2026-05-13: Reserved: 2. Reserved refs: RG-1@D3, RG-2@D4.",
    data: {
      dates: [{ date: "2026-05-13", total: 13, available: 11, reserved: 2, blocked: 0, occupied: 0 }],
      statusRefs: [
        { date: "2026-05-13", roomId: "room-D3", roomNumber: "D3", roomType: "秘境洞穴", status: "reserved", sourceRefs: [{ sourceType: "reservation", sourceId: "reservation-rg-1", label: "RG-1" }] },
        { date: "2026-05-13", roomId: "room-D4", roomNumber: "D4", roomType: "秘境洞穴", status: "reserved", sourceRefs: [{ sourceType: "reservation", sourceId: "reservation-rg-2", label: "RG-2" }] }
      ]
    }
  });
}

function reservationEvidence(reservationCode: string, guestName: string, roomNumber: string) {
  return createPmsEvidence<ReservationFact>({
    method: "reservationLookup",
    tenantId: "tenant_1",
    fetchedAt: reservationCode === "RG-2" ? "2026-05-13T08:00:01.000Z" : "2026-05-13T08:00:00.000Z",
    summary: `Reservation ${reservationCode}: guest ${guestName} room ${roomNumber} 秘境洞穴 dates 2026-05-10 to 2026-05-15 status booked.`,
    data: {
      reservationId: `reservation-${reservationCode.toLowerCase()}`,
      reservationCode,
      guestName,
      roomId: `room-${roomNumber}`,
      roomNumber,
      roomType: "秘境洞穴",
      arrivalDate: "2026-05-10",
      departureDate: "2026-05-15",
      status: "booked"
    }
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
  return pmsReadExecutors({
    pms_availability_search: ({ request }) => {
      calls?.push(request.capabilityId);
      return availability;
    },
    pms_inventory_summary: () => inventoryEvidence
  });
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
    pms_reservation_group_draft_create: () => createPmsEvidence({ method: "createReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group draft", data: { groupDraftRef: "group_1", status: "collectingSlots" } }),
    pms_reservation_group_draft_update: () => createPmsEvidence({ method: "updateReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group draft", data: { groupDraftRef: "group_1", status: "quoteReady" } }),
    pms_reservation_group_quote: () => createPmsEvidence({ method: "quoteReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group quote", data: { quoteRef: "group_quote_1", status: "pricingUnsupported" } }),
    pms_reservation_group_prepare_confirm: () => createPmsEvidence({ method: "prepareReservationGroupConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group prepare", data: { pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: 2 } }),
    pms_reservation_group_prepare_booking: ({ request }) => {
      calls?.push(request.capabilityId);
      return createPmsEvidence({ method: "prepareReservationGroupConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-06T12:00:00.000Z", summary: "group booking prepare", data: { pendingActionId: "pending_group_booking_1", pendingActionRef: "pending_group_booking_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: request.quantity } });
    }
  };
}
