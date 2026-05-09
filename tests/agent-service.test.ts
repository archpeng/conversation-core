import { describe, expect, it } from "vitest";
import { createAgentService, handleAgentServiceRequest, type AgentServiceResponse } from "../apps/agent-service/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import type { AgentResult, FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import { PMS_SAFE_READ_TOOLS, PMS_SAFE_WORKFLOW_TOOLS, type AgentSessionFactory, type AgentSessionFactoryOptions, type PmsReadExecutorMap, type UnifiedAgentTurnEvent } from "../packages/unified-agent/src/index.js";

const validTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_secret_1",
  sessionId: "session_secret_1",
  messageId: "message_secret_1",
  actor: { role: "customer", id: "actor_secret_1" },
  message: { text: "raw secret general question" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};
const customerRegisteredToolNames = [
  ...PMS_SAFE_READ_TOOLS,
  ...PMS_SAFE_WORKFLOW_TOOLS
];

describe("agent service API", () => {
  it("returns redacted health", async () => {
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession([]) });

    const response = await service.handle({ method: "GET", path: "/health" });

    expect(response).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: { status: "ok", service: "pms-agent-v2-agent-service" }
    });
    expect(JSON.stringify(response.body)).not.toContain("tenant_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("session_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("actor_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("raw secret general question");
  });

  it("lets an adapter call /v1/feishu-turn and receives AgentResult only", async () => {
    const calls: AgentSessionFactoryOptions[] = [];
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(calls) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: JSON.stringify(validTurn) });

    expect(response.status).toBe(200);
    expectAgentResultBody(response);
    expect(response.body).toMatchObject({ type: "text" });
    expect(JSON.stringify(response.body)).not.toContain("Agent turn completed");
    expect(response.body).not.toHaveProperty("result");
    expect(response.body).not.toHaveProperty("replies");
    expect(calls[0].tools).toEqual(customerRegisteredToolNames);
    expect(calls[0].customTools.map((tool) => tool.name)).toEqual(customerRegisteredToolNames);
  });

  it("uses a deterministic redacted Pi session file for the same Feishu conversation", async () => {
    const sessionDir = "/tmp/pms-agent-v2-runtime-test/pi-sessions";
    const firstCalls: AgentSessionFactoryOptions[] = [];
    const secondCalls: AgentSessionFactoryOptions[] = [];
    const firstService = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(firstCalls), piSessionDir: sessionDir });
    const secondService = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(secondCalls), piSessionDir: sessionDir });

    await firstService.handle({ method: "POST", path: "/v1/feishu-turn", body: validTurn });
    await secondService.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, messageId: "message_secret_2" } });

    expect(firstCalls).toHaveLength(1);
    expect(secondCalls).toHaveLength(1);
    expect(firstCalls[0].sessionFile).toBe(secondCalls[0].sessionFile);
    expect(firstCalls[0].sessionFile).toMatch(/^\/tmp\/pms-agent-v2-runtime-test\/pi-sessions\/feishu-[a-f0-9]{32}\.jsonl$/);
    expect(firstCalls[0].sessionFile).not.toContain("tenant_secret_1");
    expect(firstCalls[0].sessionFile).not.toContain("session_secret_1");
    expect(firstCalls[0].sessionFile).not.toContain("actor_secret_1");
  });

  it("uses a different Pi session file for a different Feishu conversation", async () => {
    const sessionDir = "/tmp/pms-agent-v2-runtime-test/pi-sessions";
    const firstCalls: AgentSessionFactoryOptions[] = [];
    const secondCalls: AgentSessionFactoryOptions[] = [];
    const firstService = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(firstCalls), piSessionDir: sessionDir });
    const secondService = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(secondCalls), piSessionDir: sessionDir });

    await firstService.handle({ method: "POST", path: "/v1/feishu-turn", body: validTurn });
    await secondService.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, sessionId: "session_secret_2", messageId: "message_secret_2" } });

    expect(firstCalls[0].sessionFile).toBeDefined();
    expect(secondCalls[0].sessionFile).toBeDefined();
    expect(firstCalls[0].sessionFile).not.toBe(secondCalls[0].sessionFile);
  });

  it("returns a natural greeting fallback instead of an internal completion placeholder", async () => {
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession([]) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, message: { text: "你好" } } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "text" });
    expect(JSON.stringify(response.body)).toContain("PMS 智能助手");
    expect(JSON.stringify(response.body)).not.toContain("Agent turn completed");
  });

  it("disposes expired cached sessions during eviction before creating the next turn session", async () => {
    const disposed: string[] = [];
    const sessions = new Map<string, unknown>([["expired", {
      updatedAt: 0,
      session: {
        piSession: { dispose: () => disposed.push("expired") },
        profile: { id: "customer_pms" },
        tools: [],
        systemPrompt: "",
        systemPromptInjected: false,
        state: {}
      }
    }]]);
    const calls: AgentSessionFactoryOptions[] = [];

    const response = await handleAgentServiceRequest(
      { gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(calls) },
      { method: "POST", path: "/v1/feishu-turn", body: validTurn },
      sessions as never
    );

    expect(response.status).toBe(200);
    expect(disposed).toEqual(["expired"]);
    expect(sessions.has("expired")).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("reuses cached sessions for continuity across /v1/feishu-turn calls", async () => {
    const calls: AgentSessionFactoryOptions[] = [];
    let pmsReadCount = 0;
    const service = createAgentService({
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession(calls),
      executors: {
        pmsReadExecutors: availabilityExecutors(() => {
          pmsReadCount += 1;
          return createPmsEvidence({
            method: "searchAvailability",
            tenantId: validTurn.tenantId,
            fetchedAt: `2026-05-06T12:0${pmsReadCount}:00.000Z`,
            summary: "availability search summary",
            data: { rooms: [{ roomId: `room_${pmsReadCount}`, roomType: "大床房", available: true }] }
          });
        })
      }
    });

    const first = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, message: { text: "查一下今天大床房有房吗" } } });
    const second = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, messageId: "message_secret_2", message: { text: "那明天呢" } } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(pmsReadCount).toBe(2);
    expect(second.body).toMatchObject({ type: "text" });
    expect(JSON.stringify(second.body)).toContain("evidenceRefs");
  });

  it("supports /v1/eval-turn with the same AgentResult-only output shape", async () => {
    const calls: AgentSessionFactoryOptions[] = [];
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(calls) });

    const response = await service.handle({ method: "POST", path: "/v1/eval-turn", body: { ...validTurn, messageId: "message_secret_eval" } });

    expect(response.status).toBe(200);
    expectAgentResultBody(response);
    expect(calls).toHaveLength(1);
  });

  it("rejects invalid input as a refusal AgentResult without depending on old adapter body shape", async () => {
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession([]) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: { tenantId: "tenant_secret_1", replies: [{ text: "old shape" }] } });

    expect(response.status).toBe(400);
    expectAgentResultBody(response);
    expect(response.body).toEqual({ type: "refusal", reason: "invalid_request", message: "Invalid Feishu turn input." });
    expect(JSON.stringify(response.body)).not.toContain("tenant_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("old shape");
  });

  it("routes customer/staff and admin/internal to deterministic profile tools", async () => {
    const customerCalls: AgentSessionFactoryOptions[] = [];
    const staffCalls: AgentSessionFactoryOptions[] = [];
    const adminCalls: AgentSessionFactoryOptions[] = [];
    const internalCalls: AgentSessionFactoryOptions[] = [];

    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(customerCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "customer", id: "customer_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(staffCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "staff", id: "staff_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(adminCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "admin", id: "admin_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(internalCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "internal", id: "internal_1" } } });

    expect(toolNames(customerCalls)).toEqual(customerRegisteredToolNames);
    expect(toolNames(staffCalls)).toEqual(customerRegisteredToolNames);
    expect(toolNames(adminCalls)).toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
    expect(toolNames(internalCalls)).toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
  });

  it("normalizes runtime failures to a redacted refusal AgentResult", async () => {
    const events: UnifiedAgentTurnEvent[] = [];
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: async () => {
      throw new Error("tenant_secret_1 session_secret_1 actor_secret_1 raw secret general question");
    }, eventSink: (event) => events.push(event) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: validTurn });

    expect(response.status).toBe(502);
    expectAgentResultBody(response);
    expect(response.body).toEqual({
      type: "refusal",
      reason: "unsupported",
      message: "助手暂时无法完成本轮处理，请稍后重试；如果你正在处理 PMS 操作，请重新发送上一条需求。"
    });
    expect(JSON.stringify(response.body)).not.toContain("tenant_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("session_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("actor_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("raw secret general question");
    expect(events).toEqual([{
      event: "pms_agent_turn_failed",
      stage: "create_or_run_turn",
      status: 502,
      errorName: "Error",
      errorMessageHash: expect.stringMatching(/^[a-f0-9]{16}$/)
    }]);
    expect(JSON.stringify(events)).not.toContain("tenant_secret_1");
    expect(JSON.stringify(events)).not.toContain("session_secret_1");
    expect(JSON.stringify(events)).not.toContain("actor_secret_1");
    expect(JSON.stringify(events)).not.toContain("raw secret general question");
  });
});

function expectAgentResultBody(response: AgentServiceResponse): asserts response is AgentServiceResponse & { body: AgentResult } {
  expect(response.headers).toEqual({ "content-type": "application/json" });
  expect(response.body).toHaveProperty("type");
  expect(response.body).not.toHaveProperty("result");
  expect(response.body).not.toHaveProperty("data");
  expect(response.body).not.toHaveProperty("replies");
}

function toolNames(calls: AgentSessionFactoryOptions[]): string[] {
  return calls[0].customTools.map((tool) => tool.name);
}

function fakeCreateAgentSession(calls: AgentSessionFactoryOptions[]): AgentSessionFactory {
  return async (options) => {
    calls.push(options);
    return {
      session: {
        async prompt() {}
      }
    };
  };
}

function availabilityExecutors(read: () => ReturnType<typeof createPmsEvidence>): PmsReadExecutorMap {
  return {
    pms_hotel_profile: read as never,
    pms_room_type_catalog: read as never,
    pms_availability_search: read,
    pms_inventory_summary: read as never,
    pms_room_reservation_context: read as never,
    pms_reservation_lookup: read as never,
    pms_get_room: read as never,
    pms_today_arrivals: read as never,
    pms_today_departures: read as never,
    pms_pending_action_status: read as never
  };
}

function safetyGateway(): SafetyGatewayPort {
  return {
    decide(request: GatedToolRequest): GatedDecision {
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      return { id: `audit_${event.capabilityId}_${event.outcome}` };
    }
  };
}
