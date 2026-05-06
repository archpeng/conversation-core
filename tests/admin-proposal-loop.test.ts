import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PiCreateAgentSession } from "../packages/unified-agent/src/index.js";
import type { FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import type { GatedDecision, GatedToolExecutor, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";

const adminTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_secret_1",
  messageId: "message_1",
  actor: { role: "admin", id: "admin_secret_1" },
  message: { text: "请为 late checkout discount rule 生成 proposal skill eval risk" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

describe("admin proposal loop", () => {
  it("creates proposal-only artifacts with audit IDs", async () => {
    const writes: WrittenArtifact[] = [];
    const service = createAgentService({
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession,
      executors: { proposalWrite: writeRecorder(writes) }
    });

    const response = await service.handle({ method: "POST", path: "/v1/eval-turn", body: adminTurn });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      type: "proposal",
      title: "proposal_created",
      approvalRequired: true
    });
    expect(JSON.stringify(response.body)).toContain("audit_proposal_write_allow_1");
    expect(JSON.stringify(response.body)).toContain("audit_proposal_write_allow_2");
    expect(JSON.stringify(response.body)).toContain("audit_proposal_write_allow_3");

    expect(writes.map((write) => write.path.split("/").at(-1))).toEqual(["SKILL.md", "eval-fixtures.json", "risk-report.md"]);
    for (const write of writes) {
      expect(write.path).toMatch(/^\/workspaces\/session_[A-Za-z0-9]+_message_[A-Za-z0-9]+\/proposal\//);
      expect(write.path).not.toContain("production");
      expect(write.capabilityId).toBe("proposal_write");
      expect(write.auditId).toMatch(/^audit_proposal_write_allow_/);
    }

    const skill = writes.find((write) => write.path.endsWith("/SKILL.md"));
    const evals = writes.find((write) => write.path.endsWith("/eval-fixtures.json"));
    const risk = writes.find((write) => write.path.endsWith("/risk-report.md"));

    expect(skill?.content).toContain("late checkout discount rule");
    expect(JSON.parse(evals?.content ?? "{}")).toMatchObject({ expectedResult: "proposal_created", productionMutation: false });
    expect(risk?.content).toContain("PMS safety");
    expect(risk?.content).toContain("Non-publication boundary");
  });

  it("denies admin proposal writes outside the proposal workspace", async () => {
    const calls: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: adminTurn,
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession,
      executors: {
        proposalWrite: () => {
          calls.push("executor");
          return { ok: true };
        }
      }
    });

    const write = session.tools.find((tool) => tool.name === "gated_proposal_write");
    const result = await write?.execute("tool_1", { path: "/production/SKILL.md", content: "not isolated" });

    expect(result?.details).toMatchObject({ outcome: "deny" });
    expect(calls).toEqual([]);
  });

  it("does not expose proposal file tools to customer turns", async () => {
    const writes: WrittenArtifact[] = [];
    const customerTurn: FeishuTurnInput = { ...adminTurn, actor: { role: "customer", id: "customer_secret_1" }, messageId: "message_2" };
    const session = await createUnifiedAgentSession({
      turn: customerTurn,
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession,
      executors: { proposalWrite: writeRecorder(writes) }
    });

    const result = await runAgentTurn(session, customerTurn);

    expect(session.tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]));
    expect(result).toEqual({ type: "text", text: "Agent turn completed." });
    expect(writes).toEqual([]);
  });
});

type WrittenArtifact = {
  path: string;
  content: string;
  capabilityId: string;
  auditId: string;
};

function writeRecorder(writes: WrittenArtifact[]): GatedToolExecutor<{ path: string }> {
  return ({ request, auditId }) => {
    writes.push({
      path: request.target ?? "",
      content: request.content ?? "",
      capabilityId: request.capabilityId,
      auditId
    });
    return { path: request.target ?? "" };
  };
}

const fakeCreateAgentSession: PiCreateAgentSession = async () => ({
  session: {
    async prompt() {}
  }
});

function safetyGateway(): SafetyGatewayPort {
  let auditIndex = 0;
  return {
    decide(request: GatedToolRequest): GatedDecision {
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      auditIndex += 1;
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      return { id: `audit_${event.capabilityId}_${event.outcome}_${auditIndex}` };
    }
  };
}
