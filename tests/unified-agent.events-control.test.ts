import { describe, expect, it } from "vitest";
import {
  createUnifiedAgentSession,
  loadAgentProfile,
  registerGatedTools,
  runAgentTurn,
  type PiCreateAgentSessionOptions
} from "../packages/unified-agent/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import type { FeishuActorRole } from "../packages/adapter-contracts/src/index.js";
import { baseTurn, fakeCreateAgentSession, fakeCreateAgentSessionWithAssistantText, fakeCreateAgentSessionWithAssistantTextSequence, safetyGateway } from "./unified-agent.helpers.js";
describe("unified Agent runtime", () => {
  it("appends evidence refs when post-tool LLM synthesis omits them", async () => {
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "Availability search returned 13 rooms.",
      data: { rooms: [] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }),
        "我已查询 PMS：有 13 个可订候选。"
      ]),
      executors: { pmsRead: () => evidence }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({
      type: "text",
      text: `我已查询 PMS：有 13 个可订候选。 evidenceRefs=${evidence.evidenceRef}`,
      evidenceRefs: [evidence.evidenceRef]
    });
  });

  it("emits redacted planner, tool, and result events", async () => {
    const events: unknown[] = [];
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "Availability search returned 13 rooms.",
      data: { rooms: [] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }),
        `已查询 PMS 房态。evidenceRefs=${evidence.evidenceRef}`
      ]),
      executors: { pmsRead: () => evidence }
    });

    await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定两间房间" } }, { eventSink: (event) => events.push(event) });

    expect(events).toEqual([
      { event: "pms_agent_turn_planned", profile: "customer_pms", plannerPath: "structured_tool_plan", toolPlanType: "call_tool", toolName: "gated_pms_read", paramKeys: ["target"] },
      { event: "pms_agent_tool_result", profile: "customer_pms", toolName: "gated_pms_read", outcome: "allow", evidenceMethod: "searchAvailability", resultType: "text" },
      { event: "pms_agent_turn_result", profile: "customer_pms", resultType: "text", evidenceCount: 1, pendingActionCount: 0 }
    ]);
    expect(JSON.stringify(events)).not.toContain("王晓");
    expect(JSON.stringify(events)).not.toContain("后天");
    expect(JSON.stringify(events)).not.toContain(evidence.evidenceRef);
    expect(JSON.stringify(events)).not.toContain("pending_secret_event");
  });

  it("emits approval-card result events without pending-action identifiers", async () => {
    const events: unknown[] = [];
    const evidence = createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed approval is ready",
      data: { pendingActionId: "pending_secret_event", confirmationMode: "typedCardOnly", mutationStatus: "none" }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } })),
      executors: { pmsWorkflow: () => evidence }
    });

    await runAgentTurn(session, { ...baseTurn, message: { text: "给王晓准备预订审批" } }, { eventSink: (event) => events.push(event) });

    expect(events.at(-1)).toEqual({ event: "pms_agent_turn_result", profile: "customer_pms", resultType: "approval_card", evidenceCount: 1, pendingActionCount: 1 });
    expect(JSON.stringify(events)).not.toContain("pending_secret_event");
    expect(JSON.stringify(events)).not.toContain(evidence.evidenceRef);
    expect(JSON.stringify(events)).not.toContain("王晓");
  });

  it("maps non-call LLM plans into safe AgentResult without side effects", async () => {
    const order: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "ask_clarification", message: "请提供入住日期。" })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return createPmsEvidence({
            method: "searchAvailability",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:00:00.000Z",
            summary: "unexpected",
            data: { rooms: [] }
          });
        }
      }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({ type: "refusal", reason: "invalid_request", message: "请提供入住日期。" });
    expect(order).toEqual([]);
  });

  it("does not execute PMS confirm plans that require typed approval", async () => {
    const order: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_confirm", params: { pendingActionId: "pending_1" } })),
      executors: {
        pmsConfirm: () => {
          order.push("executor:pmsConfirm");
          return { mutated: true };
        }
      }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({ type: "refusal", reason: "policy", message: "Requested action requires typed approval." });
    expect(order).toEqual(["decide:pms_confirm", "audit:require_approval"]);
  });

  it("rejects raw or non-visible LLM plans before executors and deterministic loop fallback", async () => {
    const order: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "bash", params: { command: "pnpm test" } })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return createPmsEvidence({
            method: "searchAvailability",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:00:00.000Z",
            summary: "unexpected deterministic fallback",
            data: { rooms: [] }
          });
        }
      }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({ type: "refusal", reason: "policy", message: "Invalid tool plan: raw_tool_not_visible." });
    expect(order).toEqual([]);
    expect(session.state.evidenceRefs).toEqual([]);
  });

  it("uses deterministic safety scaffold only when LLM is unavailable", async () => {
    const order: string[] = [];
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSession([], prompts),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return createPmsEvidence({
            method: "searchAvailability",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:00:00.000Z",
            summary: "legacy scaffold availability",
            data: { rooms: [{ roomId: "room_secret_scaffold", roomType: "大床房", available: true }] }
          });
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "2026-05-06 大床房有房吗" } });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("ToolPlanAction JSON-only output contract:");
    expect(result).toMatchObject({ type: "text", evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1778068800000"] });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
  });

  it("does not let deterministic PMS keywords bypass a valid LLM tool plan", async () => {
    const order: string[] = [];
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "planner chose availability",
      data: { rooms: [{ roomId: "room_secret_valid_plan", roomType: "suite", available: true }] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return evidence;
        },
        pmsWorkflow: () => {
          order.push("executor:pmsWorkflow");
          return createPmsEvidence({
            method: "prepareReservationConfirm",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:00:00.000Z",
            summary: "deterministic loop should not prepare booking",
            data: { pendingActionId: "pending_secret_bypass", confirmationMode: "typedCardOnly", mutationStatus: "none" }
          });
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "我要预订 2026-05-06 大床房" } });

    expect(result).toEqual({ type: "text", text: `PMS evidence is available: planner chose availability. evidenceRefs=${evidence.evidenceRef}`, evidenceRefs: [evidence.evidenceRef] });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
  });

  it("does not convert prior session text into PMS evidence", async () => {
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });

    await runAgentTurn(session, baseTurn);
    await runAgentTurn(session, { ...baseTurn, messageId: "message_raw_2", message: { text: "继续" }, receivedAt: "2026-05-06T12:01:00.000Z" });

    expect(prompts[1]).toContain("evidenceRefs=none");
    expect(prompts[1]).not.toContain("查一下今天是否有空房");
    expect(JSON.stringify(session.state)).not.toContain("查一下今天是否有空房");
  });
});
