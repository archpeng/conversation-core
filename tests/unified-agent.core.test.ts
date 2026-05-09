import { describe, expect, it } from "vitest";
import {
  createUnifiedAgentSession,
  loadAgentProfile,
  PMS_SAFE_READ_TOOLS,
  PMS_SAFE_WORKFLOW_TOOLS,
  registerGatedTools,
  runAgentTurn,
  type AgentSessionFactoryOptions
} from "../packages/unified-agent/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import type { FeishuActorRole, FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import { baseTurn, fakeCreateAgentSession, fakeCreateAgentSessionWithAssistantText, fakeCreateAgentSessionWithAssistantTextSequence, safetyGateway } from "./unified-agent.helpers.js";

const customerRegisteredToolNames = [
  ...PMS_SAFE_READ_TOOLS,
  ...PMS_SAFE_WORKFLOW_TOOLS
];

describe("unified Agent runtime", () => {
  it("creates pi-coding-agent sessions with gated custom tools and no raw built-ins", async () => {
    const calls: AgentSessionFactoryOptions[] = [];
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
    expect(calls[0].tools).toEqual(customerRegisteredToolNames);
    expect(calls[0].customTools.map((tool) => tool.name)).toEqual(customerRegisteredToolNames);
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

    expect(customerProfile.visibleToolNames).toEqual([
      ...PMS_SAFE_READ_TOOLS,
      ...PMS_SAFE_WORKFLOW_TOOLS
    ]);
    expect(customerProfile.visibleToolNames).toEqual(expect.arrayContaining(registerGatedTools({
      profile: customerProfile,
      gateway: safetyGateway([]),
      actor: { profile: "customer", id: "customer_1" },
      tenantId: "tenant_1"
    }).map((tool) => tool.name)));
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
        pmsReadExecutors: {
          pms_availability_search: () => createPmsEvidence({
          method: "searchAvailability",
          tenantId: "tenant_1",
          fetchedAt: "2026-05-06T12:00:00.000Z",
          summary: "availability search summary",
          data: { available: true }
          }),
          pms_inventory_summary: () => undefined as never,
          pms_room_reservation_context: () => undefined as never,
          pms_reservation_lookup: () => undefined as never,
          pms_get_room: () => undefined as never,
          pms_today_arrivals: () => undefined as never,
          pms_today_departures: () => undefined as never,
          pms_pending_action_status: () => undefined as never
        }
      }
    });

    const read = tools.find((tool) => tool.name === "pms_availability_search");
    const result = await read?.execute("tool_1", {});

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
      executors: { pmsReadExecutors: {
        pms_availability_search: () => evidence,
        pms_inventory_summary: () => evidence as never,
        pms_room_reservation_context: () => evidence as never,
        pms_reservation_lookup: () => evidence as never,
        pms_get_room: () => evidence as never,
        pms_today_arrivals: () => evidence as never,
        pms_today_departures: () => evidence as never,
        pms_pending_action_status: () => evidence as never
      } }
    });

    const read = tools.find((tool) => tool.name === "pms_availability_search");
    const result = await read?.execute("tool_1", {});
    const publicContent = String(result?.content[0].text);

    expect(JSON.parse(publicContent)).toEqual({
      outcome: "allow",
      auditId: "audit_pms_availability_search_allow",
      evidenceRef: evidence.evidenceRef,
      source: { system: "pms-platform", method: "searchAvailability" },
      summary: "availability search summary"
    });
    expect(publicContent).not.toContain("value");
    expect(publicContent).not.toContain("data");
    expect(publicContent).not.toContain("room_secret_tool_content");
    expect(publicContent).not.toContain("raw-platform-secret");
    expect(result?.details).toMatchObject({ outcome: "allow", auditId: "audit_pms_availability_search_allow", value: evidence });
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

  it("injects Pi-native visible custom tools into turn prompts", async () => {
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession([], prompts)
    });

    await runAgentTurn(session, baseTurn);

    expect(prompts[0]).toContain("Visible Pi custom tools:");
    expect(prompts[0]).toContain("Use the visible Pi custom tools directly");
    expect(prompts[0]).not.toContain("ToolPlanAction JSON-only output contract:");
    expect(prompts[0]).toContain('"name": "pms_availability_search"');
    expect(prompts[0]).toContain('"name": "pms_inventory_summary"');
    expect(prompts[0]).toContain('"name": "pms_reservation_prepare_confirm"');
    expect(prompts[0]).not.toContain('"name": "gated_pms_read"');
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

    expect(prompts[0]).toContain("Visible Pi custom tools:");
    expect(prompts[0]).toContain('"name": "gated_proposal_read"');
    expect(prompts[0]).toContain('"name": "gated_proposal_write"');
    expect(prompts[0]).toContain('"name": "gated_proposal_edit"');
    expect(prompts[0]).not.toContain('"name": "pms_availability_search"');
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


});
