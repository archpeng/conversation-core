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
  it("executes accepted LLM PMS read plans as the primary live path", async () => {
    const order: string[] = [];
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability from LLM plan",
      data: { rooms: [{ roomId: "room_secret_plan", roomType: "suite", available: true }] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return evidence;
        }
      }
    });

    const result = await runAgentTurn(session, baseTurn);

    expect(result).toEqual({ type: "text", text: `PMS evidence is available: availability from LLM plan. evidenceRefs=${evidence.evidenceRef}`, evidenceRefs: [evidence.evidenceRef] });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
    expect(session.state.evidenceRefs).toEqual([evidence.evidenceRef]);
  });

  it("passes typed PMS read params from LLM plan to the gated executor", async () => {
    let capturedRequest: GatedToolRequest | undefined;
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: { rooms: [] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } }),
        `已查询 PMS 房态。evidenceRefs=${evidence.evidenceRef}`
      ]),
      executors: {
        pmsRead: ({ request }) => {
          capturedRequest = request;
          return evidence;
        }
      }
    });

    await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定两间房间" } });

    expect(capturedRequest).toMatchObject({
      capabilityId: "pms_read",
      target: "availability",
      checkInDate: "2026-05-09",
      checkOutDate: "2026-05-10",
      quantity: 2,
      guestName: "王晓"
    });
  });

  it("turns accepted LLM PMS workflow plans into approval cards without confirm mutation", async () => {
    const order: string[] = [];
    let capturedRequest: GatedToolRequest | undefined;
    const evidence = createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed approval is ready",
      data: { pendingActionId: "pending_secret_llm_workflow", confirmationMode: "typedCardOnly", mutationStatus: "none", expiresAt: "2026-05-06T12:10:00.000Z" }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({ type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1 } })),
      executors: {
        pmsWorkflow: ({ request }) => {
          capturedRequest = request;
          order.push("executor:pmsWorkflow");
          return evidence;
        },
        pmsConfirm: () => {
          order.push("executor:pmsConfirm");
          return { mutated: true };
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "我要预订 2026-05-06 大床房" } });

    expect(result).toEqual({
      type: "approval_card",
      card: {
        type: "pms_pending_action_card",
        ref: {
          type: "pms_pending_action",
          tenantId: "tenant_1",
          pendingActionId: "pending_secret_llm_workflow",
          action: "reservation_confirm",
          expiresAt: "2026-05-06T12:10:00.000Z"
        },
        title: "确认预订草稿",
        summary: "PMS 已准备预订草稿待审批操作；点击确认只会确认草稿 pending-action，不代表最终预订已创建。",
        confirmLabel: "确认",
        cancelLabel: "取消"
      }
    });
    expect(order).toEqual(["decide:pms_workflow", "audit:allow", "executor:pmsWorkflow"]);
    expect(capturedRequest).toMatchObject({
      capabilityId: "pms_workflow",
      target: "prepare_confirm",
      guestName: "王晓",
      checkInDate: "2026-05-09",
      checkOutDate: "2026-05-10",
      quantity: 1
    });
    expect(session.state.evidenceRefs).toEqual([evidence.evidenceRef]);
    expect(session.state.pendingActionRefs).toEqual(["pending_secret_llm_workflow"]);
  });

  it("uses PMS availability evidence as the only roomId source for bounded read then workflow", async () => {
    const order: string[] = [];
    let workflowRequest: GatedToolRequest | undefined;
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: { rooms: [{ roomId: "room-A1", roomType: "suite", available: true }] }
    });
    const workflowEvidence = createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:01:00.000Z",
      summary: "typed approval is ready",
      data: { pendingActionId: "pending_secret_bounded", confirmationMode: "typedCardOnly", mutationStatus: "none" }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1, guestName: "王晓" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1 } }
      })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: ({ request }) => {
          workflowRequest = request;
          order.push("executor:pmsWorkflow");
          return workflowEvidence;
        },
        pmsConfirm: () => {
          order.push("executor:pmsConfirm");
          return { mutated: true };
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定一间房" } });

    expect(result.type).toBe("approval_card");
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead", "decide:pms_workflow", "audit:allow", "executor:pmsWorkflow"]);
    expect(workflowRequest).toMatchObject({
      capabilityId: "pms_workflow",
      target: "prepare_confirm",
      roomId: "room-A1",
      guestName: "王晓",
      checkInDate: "2026-05-09",
      checkOutDate: "2026-05-10",
      quantity: 1
    });
    expect(session.state.evidenceRefs).toEqual([readEvidence.evidenceRef, workflowEvidence.evidenceRef]);
    expect(session.state.pendingActionRefs).toEqual(["pending_secret_bounded"]);
  });

  it("does not run workflow when bounded read evidence has no available room", async () => {
    const order: string[] = [];
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: { rooms: [{ roomId: "room-A1", roomType: "suite", available: false }] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1, guestName: "王晓" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1 } }
      })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: () => {
          order.push("executor:pmsWorkflow");
          return createPmsEvidence({
            method: "prepareReservationConfirm",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:01:00.000Z",
            summary: "unexpected",
            data: { pendingActionId: "pending_secret_unexpected", confirmationMode: "typedCardOnly", mutationStatus: "none" }
          });
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定一间房" } });

    expect(result).toEqual({
      type: "text",
      text: `PMS 证据显示该入住区间没有可订房间，无法准备预订审批卡。请调整日期或房型后再试。evidenceRefs=${readEvidence.evidenceRef}`,
      evidenceRefs: [readEvidence.evidenceRef]
    });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
    expect(session.state.evidenceRefs).toEqual([readEvidence.evidenceRef]);
  });

  it("uses multiple PMS availability candidates for a multi-room bounded workflow", async () => {
    const order: string[] = [];
    let workflowRequest: GatedToolRequest | undefined;
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: {
        rooms: [
          { roomId: "room-A1", roomType: "suite", available: true },
          { roomId: "room-A2", roomType: "suite", available: true }
        ]
      }
    });
    const workflowEvidence = createPmsEvidence({
      method: "prepareReservationGroupConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:01:00.000Z",
      summary: "typed group approval is ready",
      data: { pendingActionId: "pending_group_bounded", pendingActionRef: "pending_group_bounded", cardPayloadRef: "card_group_bounded", quoteRef: "quote_group_bounded", selectionCount: 2, confirmationMode: "typedCardOnly", mutationStatus: "none" }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(JSON.stringify({
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2 } }
      })),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: ({ request }) => {
          workflowRequest = request;
          order.push("executor:pmsWorkflow");
          return workflowEvidence;
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定两间房" } });

    expect(result).toMatchObject({
      type: "approval_card",
      card: {
        ref: {
          pendingActionId: "pending_group_bounded",
          pendingActionRef: "pending_group_bounded",
          cardPayloadRef: "card_group_bounded",
          quoteRef: "quote_group_bounded",
          selectionCount: 2
        }
      }
    });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead", "decide:pms_workflow", "audit:allow", "executor:pmsWorkflow"]);
    expect(workflowRequest).toMatchObject({
      capabilityId: "pms_workflow",
      quantity: 2,
      selections: [
        { roomId: "room-A1", selectedCandidateRef: `${readEvidence.evidenceRef}:room-A1`, roomType: "suite" },
        { roomId: "room-A2", selectedCandidateRef: `${readEvidence.evidenceRef}:room-A2`, roomType: "suite" }
      ]
    });
    expect(session.state.evidenceRefs).toEqual([readEvidence.evidenceRef, workflowEvidence.evidenceRef]);
    expect(session.state.pendingActionRefs).toEqual(["pending_group_bounded"]);
  });

  it("resolves spoken room type text against PMS availability evidence before workflow", async () => {
    const order: string[] = [];
    const prompts: string[] = [];
    let readRequest: GatedToolRequest | undefined;
    let workflowRequest: GatedToolRequest | undefined;
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: {
        rooms: [
          { roomId: "room-A1", roomType: "花园别墅", available: true },
          { roomId: "room-D1", roomType: "秘境洞穴", available: true },
          { roomId: "room-D2", roomType: "秘境洞穴", available: true }
        ]
      }
    });
    const workflowEvidence = createPmsEvidence({
      method: "prepareReservationGroupConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:01:00.000Z",
      summary: "typed group approval is ready",
      data: { pendingActionId: "pending_group_cave", pendingActionRef: "pending_group_cave", cardPayloadRef: "card_group_cave", quoteRef: "quote_group_cave", selectionCount: 2, confirmationMode: "typedCardOnly", mutationStatus: "none" }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({
          type: "bounded_read_then_workflow",
          read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 2, roomType: "洞穴房", guestName: "小杨" } },
          workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "小杨", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 2, roomTypeText: "洞穴房" } }
        }),
        JSON.stringify({ ok: true, roomType: "秘境洞穴", roomIds: ["room-D1", "room-D2"] })
      ], prompts),
      executors: {
        pmsRead: ({ request }) => {
          readRequest = request;
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: ({ request }) => {
          workflowRequest = request;
          order.push("executor:pmsWorkflow");
          return workflowEvidence;
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "先两间洞穴" } });

    expect(result.type).toBe("approval_card");
    expect(readRequest).toMatchObject({ target: "availability", quantity: 2 });
    expect(readRequest?.roomType).toBeUndefined();
    expect(prompts[1]).toContain("requestedRoomTypeText=洞穴房");
    expect(prompts[1]).toContain("秘境洞穴");
    expect(workflowRequest).toMatchObject({
      capabilityId: "pms_workflow",
      quantity: 2,
      roomType: "秘境洞穴",
      selections: [
        { roomId: "room-D1", selectedCandidateRef: `${readEvidence.evidenceRef}:room-D1`, roomType: "秘境洞穴" },
        { roomId: "room-D2", selectedCandidateRef: `${readEvidence.evidenceRef}:room-D2`, roomType: "秘境洞穴" }
      ]
    });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead", "decide:pms_workflow", "audit:allow", "executor:pmsWorkflow"]);
  });

  it("does not run workflow when room type resolution returns non-evidence rooms", async () => {
    const order: string[] = [];
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: {
        rooms: [
          { roomId: "room-A1", roomType: "花园别墅", available: true },
          { roomId: "room-D1", roomType: "秘境洞穴", available: true }
        ]
      }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({
          type: "bounded_read_then_workflow",
          read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 1, guestName: "小杨" } },
          workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "小杨", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 1, roomTypeText: "别墅房" } }
        }),
        JSON.stringify({ ok: true, roomType: "花园别墅", roomIds: ["room-not-in-evidence"] })
      ]),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: () => {
          order.push("executor:pmsWorkflow");
          return createPmsEvidence({
            method: "prepareReservationConfirm",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:01:00.000Z",
            summary: "unexpected",
            data: { pendingActionId: "pending_unexpected", confirmationMode: "typedCardOnly", mutationStatus: "none" }
          });
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "先一间别墅" } });

    expect(result).toEqual({
      type: "text",
      text: `我查到该日期有这些可订房型：花园别墅（1 间）、秘境洞穴（1 间）。请确认你想订哪一种。 evidenceRefs=${readEvidence.evidenceRef}`,
      evidenceRefs: [readEvidence.evidenceRef]
    });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
  });

  it("asks to adjust when resolved room type has insufficient PMS candidates", async () => {
    const order: string[] = [];
    const readEvidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "typed availability",
      data: {
        rooms: [
          { roomId: "room-D1", roomType: "秘境洞穴", available: true },
          { roomId: "room-A1", roomType: "花园别墅", available: true }
        ]
      }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({
          type: "bounded_read_then_workflow",
          read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 2, guestName: "小杨" } },
          workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "小杨", checkInDate: "2026-05-08", checkOutDate: "2026-05-10", quantity: 2, roomTypeText: "洞穴房" } }
        }),
        JSON.stringify({ ok: true, roomType: "秘境洞穴", roomIds: ["room-D1"] })
      ]),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return readEvidence;
        },
        pmsWorkflow: () => {
          order.push("executor:pmsWorkflow");
          return createPmsEvidence({
            method: "prepareReservationGroupConfirm",
            tenantId: "tenant_1",
            fetchedAt: "2026-05-06T12:01:00.000Z",
            summary: "unexpected",
            data: { pendingActionId: "pending_unexpected", confirmationMode: "typedCardOnly", mutationStatus: "none" }
          });
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "先两间洞穴" } });

    expect(result).toEqual({
      type: "text",
      text: `PMS 证据显示“秘境洞穴”当前可订 1 间，不足 2 间，无法准备预订审批卡。是否调整间数或更换房型？evidenceRefs=${readEvidence.evidenceRef}`,
      evidenceRefs: [readEvidence.evidenceRef]
    });
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
  });

  it("uses a second LLM pass to synthesize user-facing PMS evidence replies", async () => {
    const order: string[] = [];
    const prompts: string[] = [];
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "Availability search returned 13 rooms.",
      data: { rooms: [{ roomId: "room_secret_synthesis", roomType: "suite", available: true }] }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway(order),
      createAgentSession: fakeCreateAgentSessionWithAssistantTextSequence([
        JSON.stringify({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }),
        `我已查询 PMS：后天有 13 个可订候选。要给王晓订两间房，还需要确认房型和离店日期；自然语言不会直接完成预订，确认后我会生成审批卡。evidenceRefs=${evidence.evidenceRef}`
      ], prompts),
      executors: {
        pmsRead: () => {
          order.push("executor:pmsRead");
          return evidence;
        }
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "查一下后天的房态, 并给王晓定两间房间" } });

    expect(result).toEqual({
      type: "text",
      text: `我已查询 PMS：后天有 13 个可订候选。要给王晓订两间房，还需要确认房型和离店日期；自然语言不会直接完成预订，确认后我会生成审批卡。evidenceRefs=${evidence.evidenceRef}`,
      evidenceRefs: [evidence.evidenceRef]
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Final response synthesis after a gated PMS tool call.");
    expect(prompts[1]).toContain(`evidenceRefs=${evidence.evidenceRef}`);
    expect(prompts[1]).not.toContain("room_secret_synthesis");
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor:pmsRead"]);
  });


});
