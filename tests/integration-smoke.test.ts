import { describe, expect, it } from "vitest";
import { createAgentService, type AgentServiceResponse } from "../apps/agent-service/src/index.js";
import { isAgentResult, type AgentResult, type FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import { gatedBash, type GatedDecision, type GatedToolExecutor, type GatedToolRequest, type SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import { createPmsEvidence, type AvailabilitySearchResult, type ReservationConfirmPreparation } from "../packages/pms-platform-client/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PiCreateAgentSession } from "../packages/unified-agent/src/index.js";

const baseTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_secret_smoke",
  messageId: "message_1",
  actor: { role: "customer", id: "actor_secret_smoke" },
  message: { text: "hello concierge" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

describe("local MVP integration smoke", () => {
  it("passes the six MVP loops with local adapter and PMS mocks", async () => {
    const auditEvents: string[] = [];
    const writes: WrittenArtifact[] = [];
    const pmsCalls: string[] = [];
    const confirmCalls: string[] = [];
    const gateway = safetyGateway(auditEvents);
    const service = createAgentService({
      gateway,
      createAgentSession: fakeCreateAgentSession,
      executors: {
        pmsRead: localPmsRead(pmsCalls),
        pmsWorkflow: localPrepareConfirm(pmsCalls),
        pmsConfirm: () => {
          confirmCalls.push("confirm");
          return { mutated: true };
        },
        proposalWrite: writeRecorder(writes)
      }
    });

    const loop1 = adapterDeliver(await adapterPostTurn(service, { ...baseTurn, messageId: "message_loop_1" }));
    expect(loop1.kind).toBe("text");

    const loop2 = adapterDeliver(await adapterPostTurn(service, {
      ...baseTurn,
      messageId: "message_loop_2",
      message: { text: "2026-05-06 suite availability" }
    }));
    expect(loop2.kind).toBe("text");
    expect(loop2.evidenceRefs).toHaveLength(1);
    expect(JSON.stringify(loop2)).not.toContain("room_secret_smoke");

    const loop3 = adapterDeliver(await adapterPostTurn(service, {
      ...baseTurn,
      messageId: "message_loop_3",
      message: { text: "book 2026-05-06 suite" }
    }));
    expect(loop3.kind).toBe("approval_card");
    expect(loop3.pendingActionId).toBe("pending_secret_smoke");

    const serviceRefusal = adapterDeliver(await adapterPostTurn(service, {
      ...baseTurn,
      messageId: "message_loop_4a",
      message: { text: "confirm" }
    }));
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway,
      createAgentSession: fakeCreateAgentSession,
      executors: {
        pmsWorkflow: localPrepareConfirm(pmsCalls),
        pmsConfirm: () => {
          confirmCalls.push("confirm");
          return { mutated: true };
        }
      }
    });
    await runAgentTurn(session, { ...baseTurn, messageId: "message_loop_4b", message: { text: "book 2026-05-06 suite" } });
    const naturalConfirm = adapterDeliver(await runAgentTurn(session, { ...baseTurn, messageId: "message_loop_4c", message: { text: "confirm" } }));
    expect(serviceRefusal.kind).toBe("refusal");
    expect(naturalConfirm.kind).toBe("approval_card");

    const loop5 = adapterDeliver(await adapterPostTurn(service, {
      ...baseTurn,
      actor: { role: "admin", id: "admin_secret_smoke" },
      messageId: "message_loop_5",
      message: { text: "Generate proposal skill eval risk for quiet-hours rule" }
    }));
    expect(loop5.kind).toBe("proposal");
    expect(writes.map((write) => write.path.split("/").at(-1))).toEqual(["SKILL.md", "eval-fixtures.json", "risk-report.md"]);
    expect(writes.every((write) => write.path.includes("/proposal/") && !write.path.includes("production"))).toBe(true);

    const sandboxSideEffects: string[] = [];
    const allowedSandbox = await gatedBash({
      gateway,
      actor: { profile: "admin", id: "admin_secret_smoke" },
      tenantId: "tenant_1",
      workspace: { kind: "sandbox", path: "/workspaces/smoke/sandbox" },
      command: "pnpm test",
      executor: () => {
        sandboxSideEffects.push("allowed");
        return "sandbox-ok";
      }
    });
    const deniedSandbox = await gatedBash({
      gateway,
      actor: { profile: "admin", id: "admin_secret_smoke" },
      tenantId: "tenant_1",
      workspace: { kind: "sandbox", path: "/workspaces/smoke/sandbox" },
      command: "curl https://example.invalid",
      executor: () => {
        sandboxSideEffects.push("denied");
        return "must-not-run";
      }
    });
    expect(allowedSandbox).toMatchObject({ outcome: "allow", value: "sandbox-ok" });
    expect(deniedSandbox).toMatchObject({ outcome: "deny" });
    expect(sandboxSideEffects).toEqual(["allowed"]);

    expect(confirmCalls).toEqual([]);
    expect(pmsCalls).toEqual(["pms_read", "pms_workflow", "pms_workflow"]);
    expect(auditEvents).toEqual(expect.arrayContaining([
      "pms_read:allow",
      "pms_workflow:allow",
      "proposal_write:allow",
      "sandbox_bash:allow",
      "sandbox_bash:deny"
    ]));
  });
});

type AdapterDelivery = {
  kind: AgentResult["type"];
  evidenceRefs?: readonly string[];
  pendingActionId?: string;
  proposalId?: string;
};

type WrittenArtifact = {
  path: string;
  content: string;
};

async function adapterPostTurn(service: ReturnType<typeof createAgentService>, turn: FeishuTurnInput): Promise<AgentResult> {
  const response = await service.handle({ method: "POST", path: "/v1/feishu-turn", body: turn });
  expectAgentResultResponse(response);
  return response.body;
}

function adapterDeliver(result: AgentResult): AdapterDelivery {
  switch (result.type) {
    case "text":
      return { kind: result.type, evidenceRefs: result.evidenceRefs };
    case "approval_card":
      return { kind: result.type, pendingActionId: result.card.ref.pendingActionId };
    case "proposal":
      return { kind: result.type, proposalId: result.proposalId };
    case "refusal":
      return { kind: result.type };
  }
}

function expectAgentResultResponse(response: AgentServiceResponse): asserts response is AgentServiceResponse & { body: AgentResult } {
  expect(response.status).toBe(200);
  expect(isAgentResult(response.body)).toBe(true);
  expect(response.body).not.toHaveProperty("replies");
  expect(response.body).not.toHaveProperty("result");
}

function localPmsRead(calls: string[]): GatedToolExecutor<ReturnType<typeof evidence<AvailabilitySearchResult>>> {
  return ({ request }) => {
    calls.push(request.capabilityId);
    return evidence({
      method: "searchAvailability",
      data: { rooms: [{ roomId: "room_secret_smoke", roomType: "suite", available: true, priceCents: 188800 }] },
      summary: "local availability smoke"
    });
  };
}

function localPrepareConfirm(calls: string[]): GatedToolExecutor<ReturnType<typeof evidence<ReservationConfirmPreparation>>> {
  return ({ request }) => {
    calls.push(request.capabilityId);
    return evidence({
      method: "prepareReservationConfirm",
      data: { pendingActionId: "pending_secret_smoke", confirmationMode: "typedCardOnly", mutationStatus: "none" },
      summary: "local prepare-confirm smoke"
    });
  };
}

function writeRecorder(writes: WrittenArtifact[]): GatedToolExecutor<{ path: string }> {
  return ({ request }) => {
    writes.push({ path: request.target ?? "", content: request.content ?? "" });
    return { path: request.target ?? "" };
  };
}

function evidence<T>(input: { method: "searchAvailability" | "prepareReservationConfirm"; data: T; summary: string }) {
  return createPmsEvidence({
    method: input.method,
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    data: input.data,
    summary: input.summary
  });
}

const fakeCreateAgentSession: PiCreateAgentSession = async () => ({
  session: {
    async prompt() {}
  }
});

function safetyGateway(auditEvents: string[]): SafetyGatewayPort {
  return {
    decide(request: GatedToolRequest): GatedDecision {
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      auditEvents.push(`${event.capabilityId}:${event.outcome}`);
      return { id: `audit_${event.capabilityId}_${event.outcome}_${auditEvents.length}` };
    }
  };
}
