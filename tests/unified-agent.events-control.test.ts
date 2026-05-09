import { describe, expect, it } from "vitest";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PmsReadExecutorMap, type PmsWorkflowExecutorMap, type UnifiedAgentTurnEvent } from "../packages/unified-agent/src/index.js";
import { baseTurn, fakeCreateAgentSessionWithAssistantText, fakeCreateAgentSessionWithToolCalls, safetyGateway } from "./unified-agent.helpers.js";

describe("unified Agent Pi-native event control", () => {
  it("emits redacted Pi-native planner, tool, and final result events", async () => {
    const events: UnifiedAgentTurnEvent[] = [];
    const evidence = availabilityEvidence("availability event evidence");
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_availability_search", params: { checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } }],
        text: "PMS 证据显示有可订候选。"
      }]),
      executors: { pmsReadExecutors: readExecutors(evidence) }
    });

    const result = await runAgentTurn(session, baseTurn, { eventSink: (event) => events.push(event) });

    expect(result).toMatchObject({ type: "text", evidenceRefs: [evidence.evidenceRef] });
    expect(events).toEqual([
      { event: "pms_agent_turn_planned", profile: "customer_pms", plannerPath: "pi_native_tools", toolCount: 1 },
      { event: "pms_agent_tool_result", profile: "customer_pms", toolName: "pms_availability_search", outcome: "allow", evidenceMethod: "searchAvailability", diagnostics: { roomCount: 1 } },
      { event: "pms_agent_turn_result", profile: "customer_pms", resultType: "text", evidenceCount: 1, pendingActionCount: 0 }
    ]);
    expect(JSON.stringify(events)).not.toContain("room_secret");
  });

  it("emits approval-card result events without leaking pending-action identifiers", async () => {
    const events: UnifiedAgentTurnEvent[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_reservation_prepare_confirm", params: { draftRef: "draft_1", quoteRef: "quote_1" } }],
        text: "PMS 已准备审批卡。"
      }]),
      executors: { pmsWorkflowExecutors: workflowExecutors() }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "确认预订草稿" } }, { eventSink: (event) => events.push(event) });

    expect(result).toMatchObject({ type: "approval_card", card: { ref: { pendingActionId: "pending_secret_1" } } });
    expect(events.at(-1)).toEqual({ event: "pms_agent_turn_result", profile: "customer_pms", resultType: "approval_card", evidenceCount: 1, pendingActionCount: 1 });
    expect(JSON.stringify(events)).not.toContain("pending_secret_1");
  });

  it("uses deterministic safety scaffold only when the LLM is unavailable", async () => {
    const availableSession = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText("我需要更多信息。"),
      executors: { pmsReadExecutors: readExecutors(availabilityEvidence("should not run")) }
    });
    const unavailableSession = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: async () => ({ session: { async prompt() {} } }),
      executors: { pmsReadExecutors: readExecutors(availabilityEvidence("fallback evidence")) }
    });

    const available = await runAgentTurn(availableSession, { ...baseTurn, message: { text: "2026-05-09 suite availability" } });
    const unavailable = await runAgentTurn(unavailableSession, { ...baseTurn, message: { text: "2026-05-09 suite availability" } });

    expect(available).toEqual({ type: "text", text: "我需要更多信息。" });
    expect(unavailable).toMatchObject({ type: "text", evidenceRefs: [expect.stringContaining("pms_ev_")] });
  });
});

function availabilityEvidence(summary: string) {
  return createPmsEvidence({
    method: "searchAvailability",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    summary,
    data: { rooms: [{ roomId: "room_secret", roomType: "suite", available: true }] }
  });
}

function readExecutors(evidence: ReturnType<typeof availabilityEvidence>): PmsReadExecutorMap {
  return {
    pms_availability_search: () => evidence,
    pms_inventory_summary: () => evidence as never,
    pms_room_reservation_context: () => evidence as never,
    pms_reservation_lookup: () => evidence as never,
    pms_get_room: () => evidence as never,
    pms_today_arrivals: () => evidence as never,
    pms_today_departures: () => evidence as never,
    pms_pending_action_status: () => evidence as never
  };
}

function workflowExecutors(): PmsWorkflowExecutorMap {
  return {
    pms_reservation_draft_create: () => undefined as never,
    pms_reservation_draft_update: () => undefined as never,
    pms_reservation_quote: () => undefined as never,
    pms_reservation_prepare_confirm: () => createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "prepare",
      data: { pendingActionId: "pending_secret_1", confirmationMode: "typedCardOnly", mutationStatus: "none" }
    }),
    pms_reservation_group_draft_create: () => undefined as never,
    pms_reservation_group_draft_update: () => undefined as never,
    pms_reservation_group_quote: () => undefined as never,
    pms_reservation_group_prepare_confirm: () => undefined as never
  };
}
