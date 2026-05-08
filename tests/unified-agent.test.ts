import { describe, expect, it } from "vitest";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import {
  createUnifiedAgentSession,
  loadAgentProfile,
  registerGatedTools,
  runAgentTurn,
  type PiCreateAgentSession,
  type PiCreateAgentSessionOptions
} from "../packages/unified-agent/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import type { FeishuActorRole, FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";

const baseTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_raw_secret",
  messageId: "message_raw_1",
  actor: { role: "customer", id: "actor_raw_secret" },
  message: { text: "查一下今天是否有空房" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

describe("unified Agent runtime", () => {
  it("creates pi-coding-agent sessions with gated custom tools and no raw built-ins", async () => {
    const calls: PiCreateAgentSessionOptions[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession(calls, []),
      createResourceLoader: (systemPrompt) => ({ systemPromptOverride: systemPrompt }),
      cwd: "/repo"
    });

    expect(session.agentRuntime).toBe("pi-coding-agent");
    expect(session.profile.id).toBe("customer_pms");
    expect(calls).toHaveLength(1);
    expect(calls[0].cwd).toBe("/repo");
    expect(calls[0].tools).toEqual([]);
    expect(calls[0].customTools.map((tool) => tool.name)).toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
    expect(calls[0].customTools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["read", "write", "edit", "bash", "http"]));
    expect(calls[0].resourceLoader).toEqual({ systemPromptOverride: session.systemPrompt });
  });

  it("selects profiles deterministically from actor role", () => {
    const roles: Record<FeishuActorRole, string> = {
      customer: "customer_pms",
      staff: "customer_pms",
      admin: "admin_customization",
      internal: "admin_customization"
    };

    for (const [role, profile] of Object.entries(roles) as Array<[FeishuActorRole, string]>) {
      expect(loadAgentProfile(role).id).toBe(profile);
    }
  });

  it("keeps profile visible tool metadata aligned with registered gated tools", () => {
    const customerProfile = loadAgentProfile("customer");
    const adminProfile = loadAgentProfile("admin");

    expect(customerProfile.visibleToolNames).toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
    expect(registerGatedTools({
      profile: customerProfile,
      gateway: safetyGateway([]),
      actor: { profile: "customer", id: "customer_1" },
      tenantId: "tenant_1"
    }).map((tool) => tool.name)).toEqual(customerProfile.visibleToolNames);
    expect(registerGatedTools({
      profile: adminProfile,
      gateway: safetyGateway([]),
      actor: { profile: "admin", id: "admin_1" },
      tenantId: "tenant_1"
    }).map((tool) => tool.name)).toEqual(adminProfile.visibleToolNames);
  });

  it("exposes admin proposal tools only through the Safety Gateway", async () => {
    const order: string[] = [];
    const profile = loadAgentProfile("admin");
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway(order),
      actor: { profile: "admin", id: "admin_1" },
      tenantId: "tenant_1",
      executors: {
        proposalWrite: () => {
          order.push("executor");
          return { proposalId: "proposal_1" };
        }
      }
    });

    expect(tools.map((tool) => tool.name)).toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
    expect(tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["read", "write", "edit", "bash", "http", "gated_pms_read"]));

    const write = tools.find((tool) => tool.name === "gated_proposal_write");
    const result = await write?.execute("tool_1", { path: "/workspaces/proposal_1/proposal/rate.md", content: "proposal" });

    expect(result?.details).toMatchObject({ outcome: "allow", auditId: "audit_proposal_write_allow", value: { proposalId: "proposal_1" } });
    expect(order).toEqual(["decide:proposal_write", "audit:allow", "executor"]);
  });

  it("keeps PMS facts behind evidence envelopes at the visible gated tool boundary", async () => {
    const profile = loadAgentProfile("customer");
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway([]),
      actor: { profile: "customer", id: "customer_1" },
      tenantId: "tenant_1",
      executors: {
        pmsRead: () => createPmsEvidence({
          method: "searchAvailability",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:00:00.000Z",
          summary: "availability search summary",
          data: { available: true }
        })
      }
    });

    const read = tools.find((tool) => tool.name === "gated_pms_read");
    const result = await read?.execute("tool_1", { target: "availability" });

    expect(result?.details).toMatchObject({
      outcome: "allow",
      value: {
        evidenceRef: "pms_ev_tenant_1_searchAvailability_1778068800000",
        source: { system: "pms-platform", method: "searchAvailability" },
        scope: { tenantId: "tenant_1" },
        data: { available: true }
      }
    });
    expect(result?.content[0].text).toContain("evidenceRef");
  });

  it("keeps PMS facts behind minimized public tool content while preserving full evidence details", async () => {
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability search summary",
      data: { rooms: [{ roomId: "room_secret_tool_content", roomType: "suite", available: true }], token: "raw-platform-secret" }
    });
    const profile = loadAgentProfile("customer");
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway([]),
      actor: { profile: "customer", id: "customer_1" },
      tenantId: "tenant_1",
      executors: { pmsRead: () => evidence }
    });

    const read = tools.find((tool) => tool.name === "gated_pms_read");
    const result = await read?.execute("tool_1", { target: "availability" });
    const publicContent = String(result?.content[0].text);

    expect(JSON.parse(publicContent)).toEqual({
      outcome: "allow",
      auditId: "audit_pms_read_allow",
      evidenceRef: evidence.evidenceRef,
      source: { system: "pms-platform", method: "searchAvailability" },
      summary: "availability search summary"
    });
    expect(publicContent).not.toContain("value");
    expect(publicContent).not.toContain("data");
    expect(publicContent).not.toContain("room_secret_tool_content");
    expect(publicContent).not.toContain("raw-platform-secret");
    expect(result?.details).toMatchObject({ outcome: "allow", auditId: "audit_pms_read_allow", value: evidence });
    expect((result?.details as { value?: unknown }).value).toBe(evidence);
  });

  it("returns captured assistant text for non-PMS natural turns", async () => {
    const session = await createUnifiedAgentSession({
      turn: { ...baseTurn, message: { text: "你好" } },
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText("你好，我是 PMS 智能助手。")
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "你好" } });

    expect(result).toEqual({ type: "text", text: "你好，我是 PMS 智能助手。" });
  });

  it("keeps two-turn continuity in redacted refs only", async () => {
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });

    await runAgentTurn(session, baseTurn, { evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1"] });
    await runAgentTurn(session, { ...baseTurn, messageId: "message_raw_2", message: { text: "那明天呢" }, receivedAt: "2026-05-06T12:01:00.000Z" });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("recentMessages=message_");
    expect(prompts[1]).toContain("evidenceRefs=pms_ev_tenant_1_searchAvailability_1");
    expect(JSON.stringify(session.state)).not.toContain("session_raw_secret");
    expect(JSON.stringify(session.state)).not.toContain("actor_raw_secret");
    expect(JSON.stringify(session.state)).not.toContain("查一下今天是否有空房");
    expect(session.state.turnRefs).toHaveLength(2);
  });

  it("injects supplied authority-labeled context into turn prompts", async () => {
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability from PMS evidence",
      data: { available: true }
    });

    await runAgentTurn(session, baseTurn, {
      workspaceAdvisory: [{ source: "workspace.active.skills/rate.md", summary: "advisory note only" }],
      pmsEvidence: [evidence],
      modelPriorSummary: "ask for missing dates"
    });

    expect(prompts[0]).toContain("Authority-labeled context:");
    expect(prompts[0]).toContain("authority=workspace_advisory");
    expect(prompts[0]).toContain("source=workspace.active.skills/rate.md");
    expect(prompts[0]).toContain("authority=pms_evidence");
    expect(prompts[0]).toContain(`evidenceRefs=${evidence.evidenceRef}`);
    expect(prompts[0]).toContain("authority=model_prior");
  });

  it("injects profile-visible gated tool manifest and JSON-only tool-plan contract into turn prompts", async () => {
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });

    await runAgentTurn(session, baseTurn);

    expect(prompts[0]).toContain("Visible gated tool manifest:");
    expect(prompts[0]).toContain("ToolPlanAction JSON-only output contract:");
    expect(prompts[0]).toContain("Return exactly one JSON object and no markdown or extra prose");
    expect(prompts[0]).toContain('"type": "call_tool"');
    expect(prompts[0]).toContain('"name": "gated_pms_read"');
    expect(prompts[0]).toContain('"name": "gated_pms_workflow"');
    expect(prompts[0]).toContain('"name": "gated_pms_confirm"');
    expect(prompts[0]).not.toContain('"name": "gated_proposal_write"');
    expect(prompts[0]).not.toContain('"name": "bash"');
    expect(prompts[0]).not.toContain('"name": "read"');
    expect(prompts[0]).not.toContain('"name": "write"');
    expect(prompts[0]).not.toContain('"name": "edit"');
    expect(prompts[0]).not.toContain('"name": "http"');
    expect(prompts[0]).not.toContain('"name": "http_request"');
  });

  it("injects only admin-visible gated proposal tools for admin turn prompts", async () => {
    const prompts: string[] = [];
    const adminTurn: FeishuTurnInput = {
      ...baseTurn,
      actor: { role: "admin", id: "admin_raw_secret" },
      message: { text: "帮我起草一个价格调整方案" }
    };
    const session = await createUnifiedAgentSession({
      turn: adminTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });

    await runAgentTurn(session, adminTurn);

    expect(prompts[0]).toContain("Visible gated tool manifest:");
    expect(prompts[0]).toContain('"name": "gated_proposal_read"');
    expect(prompts[0]).toContain('"name": "gated_proposal_write"');
    expect(prompts[0]).toContain('"name": "gated_proposal_edit"');
    expect(prompts[0]).not.toContain('"name": "gated_pms_read"');
    expect(prompts[0]).not.toContain('"name": "bash"');
    expect(prompts[0]).not.toContain('"name": "read"');
    expect(prompts[0]).not.toContain('"name": "write"');
    expect(prompts[0]).not.toContain('"name": "edit"');
    expect(prompts[0]).not.toContain('"name": "http"');
    expect(prompts[0]).not.toContain('"name": "http_request"');
  });

  it("validates assistant PMS fact text instead of relying on prompt-only policy", async () => {
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText("PMS 证据显示有 3 个可订候选。")
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "普通聊天，不触发房态工具" } });

    expect(result).toMatchObject({ type: "refusal", reason: "invalid_request", message: "Current PMS facts require pms-platform evidence refs." });
  });

  it("passes assistant PMS fact text when current PMS evidence is supplied to synthesis", async () => {
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability",
      data: { available: true }
    });
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithAssistantText(`PMS 证据显示有 1 个可订候选。evidenceRefs=${evidence.evidenceRef}`)
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "普通聊天，不触发房态工具" } }, { pmsEvidence: [evidence], evidenceRefs: [evidence.evidenceRef] });

    expect(result).toEqual({ type: "text", text: `PMS 证据显示有 1 个可订候选。evidenceRefs=${evidence.evidenceRef}`, evidenceRefs: [evidence.evidenceRef] });
  });

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

function fakeCreateAgentSession(calls: PiCreateAgentSessionOptions[], prompts: string[]): PiCreateAgentSession {
  return async (options) => {
    calls.push(options);
    return {
      session: {
        async prompt(text) {
          prompts.push(text);
        }
      }
    };
  };
}

function fakeCreateAgentSessionWithAssistantText(text: string): PiCreateAgentSession {
  return fakeCreateAgentSessionWithAssistantTextSequence([text]);
}

function fakeCreateAgentSessionWithAssistantTextSequence(texts: string[], prompts: string[] = []): PiCreateAgentSession {
  return async () => {
    let index = 0;
    let listener: ((event: { type?: string; assistantMessageEvent?: { type?: string; delta?: string } }) => void) | undefined;
    return {
      session: {
        subscribe(next) {
          listener = next;
          return () => {
            listener = undefined;
          };
        },
        async prompt(text) {
          prompts.push(text);
          const reply = texts[Math.min(index, texts.length - 1)] ?? "";
          index += 1;
          listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: reply } });
        }
      }
    };
  };
}

function safetyGateway(order: string[]): SafetyGatewayPort {
  return {
    decide(request: GatedToolRequest): GatedDecision {
      order.push(`decide:${request.capabilityId}`);
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      order.push(`audit:${decision.outcome}`);
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      return { id: `audit_${event.capabilityId}_${event.outcome}` };
    }
  };
}
