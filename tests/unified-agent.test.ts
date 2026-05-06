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
  return async () => {
    let listener: ((event: { type?: string; assistantMessageEvent?: { type?: string; delta?: string } }) => void) | undefined;
    return {
      session: {
        subscribe(next) {
          listener = next;
          return () => {
            listener = undefined;
          };
        },
        async prompt() {
          listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: text } });
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
