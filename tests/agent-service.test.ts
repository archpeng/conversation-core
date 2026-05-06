import { describe, expect, it } from "vitest";
import { createAgentService, type AgentServiceResponse } from "../apps/agent-service/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import type { AgentResult, FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import type { PiCreateAgentSession, PiCreateAgentSessionOptions } from "../packages/unified-agent/src/index.js";

const validTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_secret_1",
  sessionId: "session_secret_1",
  messageId: "message_secret_1",
  actor: { role: "customer", id: "actor_secret_1" },
  message: { text: "raw secret general question" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

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
    const calls: PiCreateAgentSessionOptions[] = [];
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(calls) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: JSON.stringify(validTurn) });

    expect(response.status).toBe(200);
    expectAgentResultBody(response);
    expect(response.body).toMatchObject({ type: "text" });
    expect(JSON.stringify(response.body)).not.toContain("Agent turn completed");
    expect(response.body).not.toHaveProperty("result");
    expect(response.body).not.toHaveProperty("replies");
    expect(calls[0].tools).toEqual([]);
    expect(calls[0].customTools.map((tool) => tool.name)).toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
  });

  it("returns a natural greeting fallback instead of an internal completion placeholder", async () => {
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession([]) });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, message: { text: "你好" } } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "text" });
    expect(JSON.stringify(response.body)).toContain("PMS 智能助手");
    expect(JSON.stringify(response.body)).not.toContain("Agent turn completed");
  });

  it("reuses cached sessions for continuity across /v1/feishu-turn calls", async () => {
    const calls: PiCreateAgentSessionOptions[] = [];
    let pmsReadCount = 0;
    const service = createAgentService({
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession(calls),
      executors: {
        pmsRead: () => {
          pmsReadCount += 1;
          return createPmsEvidence({
            method: "searchAvailability",
            tenantId: validTurn.tenantId,
            fetchedAt: `2026-05-06T12:0${pmsReadCount}:00.000Z`,
            summary: "availability search summary",
            data: { rooms: [{ roomId: `room_${pmsReadCount}`, roomType: "大床房", available: true }] }
          });
        }
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
    const calls: PiCreateAgentSessionOptions[] = [];
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
    const customerCalls: PiCreateAgentSessionOptions[] = [];
    const staffCalls: PiCreateAgentSessionOptions[] = [];
    const adminCalls: PiCreateAgentSessionOptions[] = [];
    const internalCalls: PiCreateAgentSessionOptions[] = [];

    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(customerCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "customer", id: "customer_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(staffCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "staff", id: "staff_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(adminCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "admin", id: "admin_1" } } });
    await createAgentService({ gateway: safetyGateway(), createAgentSession: fakeCreateAgentSession(internalCalls) }).handle({ method: "POST", path: "/v1/feishu-turn", body: { ...validTurn, actor: { role: "internal", id: "internal_1" } } });

    expect(toolNames(customerCalls)).toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
    expect(toolNames(staffCalls)).toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
    expect(toolNames(adminCalls)).toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
    expect(toolNames(internalCalls)).toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
  });

  it("normalizes runtime failures to a redacted refusal AgentResult", async () => {
    const service = createAgentService({ gateway: safetyGateway(), createAgentSession: async () => {
      throw new Error("tenant_secret_1 session_secret_1 actor_secret_1 raw secret general question");
    } });

    const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: validTurn });

    expect(response.status).toBe(502);
    expectAgentResultBody(response);
    expect(response.body).toEqual({ type: "refusal", reason: "unsupported", message: "Agent turn failed." });
    expect(JSON.stringify(response.body)).not.toContain("tenant_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("session_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("actor_secret_1");
    expect(JSON.stringify(response.body)).not.toContain("raw secret general question");
  });
});

function expectAgentResultBody(response: AgentServiceResponse): asserts response is AgentServiceResponse & { body: AgentResult } {
  expect(response.headers).toEqual({ "content-type": "application/json" });
  expect(response.body).toHaveProperty("type");
  expect(response.body).not.toHaveProperty("result");
  expect(response.body).not.toHaveProperty("data");
  expect(response.body).not.toHaveProperty("replies");
}

function toolNames(calls: PiCreateAgentSessionOptions[]): string[] {
  return calls[0].customTools.map((tool) => tool.name);
}

function fakeCreateAgentSession(calls: PiCreateAgentSessionOptions[]): PiCreateAgentSession {
  return async (options) => {
    calls.push(options);
    return {
      session: {
        async prompt() {}
      }
    };
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
