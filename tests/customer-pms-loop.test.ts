import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import { createPmsEvidence, type AvailabilitySearchResult, type ReservationConfirmPreparation } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type PiCreateAgentSession } from "../packages/unified-agent/src/index.js";
import type { FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import type { GatedDecision, GatedToolExecutor, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";

const turn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_secret_1",
  messageId: "message_1",
  actor: { role: "customer", id: "actor_secret_1" },
  message: { text: "2026-05-06 大床房有房吗" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

describe("customer PMS loop", () => {
  it("grounds availability replies in PMS evidence for rooms, no rooms, multiple candidates, missing prices, and PMS errors", async () => {
    const withRoom = await runEvalTurn({
      body: turn,
      pmsRead: evidenceRead({ rooms: [{ roomId: "room_secret_1", roomType: "大床房", available: true, priceCents: 128800 }] })
    });
    expect(withRoom.status).toBe(200);
    expect(withRoom.body).toMatchObject({ type: "text", evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1778068800000"] });
    expect(JSON.stringify(withRoom.body)).toContain("大床房");
    expect(JSON.stringify(withRoom.body)).not.toContain("room_secret_1");

    const noRooms = await runEvalTurn({
      body: { ...turn, messageId: "message_2" },
      pmsRead: evidenceRead({ rooms: [{ roomId: "room_secret_2", roomType: "大床房", available: false }] })
    });
    expect(noRooms.body).toMatchObject({ type: "text", evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1778068800000"] });
    expect(JSON.stringify(noRooms.body)).toContain("未查到可订房型");
    expect(JSON.stringify(noRooms.body)).not.toContain("room_secret_2");

    const multipleMissingPrice = await runEvalTurn({
      body: { ...turn, messageId: "message_3", message: { text: "2026-05-06 房型 suite availability" } },
      pmsRead: evidenceRead({ rooms: [
        { roomId: "room_secret_3", roomType: "套房", available: true },
        { roomId: "room_secret_4", roomType: "家庭套房", available: true, priceCents: 188800 }
      ] })
    });
    expect(JSON.stringify(multipleMissingPrice.body)).toContain("有 2 个可订候选");
    expect(JSON.stringify(multipleMissingPrice.body)).toContain("价格未由 PMS 证据返回");
    expect(JSON.stringify(multipleMissingPrice.body)).toContain("PMS priceCents=188800");
    expect(JSON.stringify(multipleMissingPrice.body)).not.toContain("CNY");
    expect(JSON.stringify(multipleMissingPrice.body)).not.toContain("room_secret_3");
    expect(JSON.stringify(multipleMissingPrice.body)).not.toContain("room_secret_4");

    const pmsError = await runEvalTurn({
      body: { ...turn, messageId: "message_4" },
      pmsRead: () => {
        throw new Error("pms token room_secret_5 tenant_1 failed");
      }
    });
    expect(pmsError.body).toEqual({ type: "refusal", reason: "unsupported", message: "PMS evidence is temporarily unavailable." });
    expect(JSON.stringify(pmsError.body)).not.toContain("room_secret_5");
  });

  it("asks for required availability slots before reporting PMS facts", async () => {
    const readCalls: string[] = [];
    const missingDate = await runEvalTurn({
      body: { ...turn, messageId: "message_5", message: { text: "大床房有房吗" } },
      pmsRead: () => {
        readCalls.push("read");
        return fakePmsEvidence({ method: "searchAvailability", data: { rooms: [] }, summary: "should not be used" });
      }
    });
    const missingRoomType = await runEvalTurn({
      body: { ...turn, messageId: "message_6", message: { text: "2026-05-06 有房吗" } },
      pmsRead: () => {
        readCalls.push("read");
        return fakePmsEvidence({ method: "searchAvailability", data: { rooms: [] }, summary: "should not be used" });
      }
    });

    expect(missingDate.body).toEqual({ type: "refusal", reason: "invalid_request", message: "请先提供入住和离店日期。" });
    expect(missingRoomType.body).toEqual({ type: "refusal", reason: "invalid_request", message: "请先提供要查询的房型。" });
    expect(readCalls).toEqual([]);
  });

  it("refuses PMS-looking facts that are not evidence envelopes", async () => {
    const response = await runEvalTurn({
      body: turn,
      pmsRead: (() => ({ rooms: [{ roomId: "room_secret_6", roomType: "大床房", available: true }] })) as GatedToolExecutor<ReturnType<typeof fakePmsEvidence<AvailabilitySearchResult>>>
    });

    expect(response.body).toEqual({ type: "refusal", reason: "unsupported", message: "PMS evidence envelope is missing." });
    expect(JSON.stringify(response.body)).not.toContain("room_secret_6");
  });

  it("returns typed approval cards for prepare-confirm without calling PMS confirm", async () => {
    const calls: string[] = [];
    const response = await runEvalTurn({
      body: { ...turn, messageId: "message_7", message: { text: "我要预订 2026-05-06 大床房" } },
      pmsWorkflow: ({ request }) => {
        calls.push(request.capabilityId);
        return fakePmsEvidence({
          method: "prepareReservationConfirm",
          data: { pendingActionId: "pending_secret_1", confirmationMode: "typedCardOnly", mutationStatus: "none" },
          summary: "prepare confirm"
        });
      },
      pmsConfirm: () => {
        calls.push("confirm_executor");
        return { mutated: true };
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      type: "approval_card",
      card: {
        type: "pms_pending_action_card",
        ref: { type: "pms_pending_action", pendingActionId: "pending_secret_1", action: "reservation_confirm" }
      }
    });
    expect(calls).toEqual(["pms_workflow"]);
  });

  it("keeps natural-language confirm behind the typed-card boundary", async () => {
    const calls: string[] = [];
    const session = await createUnifiedAgentSession({
      turn,
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession,
      executors: {
        pmsWorkflow: ({ request }) => {
          calls.push(request.capabilityId);
          return fakePmsEvidence({
            method: "prepareReservationConfirm",
            data: { pendingActionId: "pending_secret_2", confirmationMode: "typedCardOnly", mutationStatus: "none" },
            summary: "prepare confirm"
          });
        },
        pmsConfirm: () => {
          calls.push("confirm_executor");
          return { mutated: true };
        }
      }
    });

    const noPending = await runAgentTurn(session, { ...turn, messageId: "message_8", message: { text: "确认" } });
    expect(noPending).toEqual({ type: "refusal", reason: "invalid_request", message: "请先通过确认卡片生成待审批操作；自然语言确认不会执行 PMS 变更。" });

    await runAgentTurn(session, { ...turn, messageId: "message_9", message: { text: "我要预订 2026-05-06 大床房" } });
    const withPending = await runAgentTurn(session, { ...turn, messageId: "message_10", message: { text: "确认" } });

    expect(withPending).toMatchObject({ type: "approval_card", card: { ref: { pendingActionId: "pending_secret_2" } } });
    expect(calls).toEqual(["pms_workflow"]);
  });

  it("continues follow-up availability by re-reading PMS evidence, not by using memory as PMS truth", async () => {
    const refs: string[] = [];
    const session = await createUnifiedAgentSession({
      turn,
      gateway: safetyGateway(),
      createAgentSession: fakeCreateAgentSession,
      executors: {
        pmsRead: () => {
          const fetchedAt = `2026-05-06T12:0${refs.length}:00.000Z`;
          const item = fakePmsEvidence({ method: "searchAvailability", fetchedAt, data: { rooms: [{ roomId: `room_secret_${refs.length}`, roomType: "大床房", available: true }] }, summary: "availability" });
          refs.push(item.evidenceRef);
          return item;
        }
      }
    });

    const first = await runAgentTurn(session, turn);
    const followUp = await runAgentTurn(session, { ...turn, messageId: "message_11", message: { text: "那明天呢" } });

    expect(first).toMatchObject({ type: "text", evidenceRefs: [refs[0]] });
    expect(followUp).toMatchObject({ type: "text", evidenceRefs: [refs[1]] });
    expect(refs).toHaveLength(2);
    expect(session.state.evidenceRefs).toEqual(refs);
    expect(JSON.stringify(session.state)).not.toContain("大床房有房吗");
  });
});

type RunEvalTurnInput = {
  body: FeishuTurnInput;
  pmsRead?: GatedToolExecutor<ReturnType<typeof fakePmsEvidence<AvailabilitySearchResult>>>;
  pmsWorkflow?: GatedToolExecutor<ReturnType<typeof fakePmsEvidence<ReservationConfirmPreparation>>>;
  pmsConfirm?: GatedToolExecutor<unknown>;
};

async function runEvalTurn(input: RunEvalTurnInput) {
  const service = createAgentService({
    gateway: safetyGateway(),
    createAgentSession: fakeCreateAgentSession,
    executors: {
      pmsRead: input.pmsRead,
      pmsWorkflow: input.pmsWorkflow,
      pmsConfirm: input.pmsConfirm
    }
  });
  return service.handle({ method: "POST", path: "/v1/eval-turn", body: input.body });
}

function evidenceRead(data: AvailabilitySearchResult) {
  return () => fakePmsEvidence({ method: "searchAvailability", data, summary: "availability" });
}

function fakePmsEvidence<T>(input: { method: "searchAvailability" | "prepareReservationConfirm"; data: T; summary: string; fetchedAt?: string }) {
  return createPmsEvidence({
    method: input.method,
    tenantId: "tenant_1",
    fetchedAt: input.fetchedAt ?? "2026-05-06T12:00:00.000Z",
    data: input.data,
    summary: input.summary
  });
}

const fakeCreateAgentSession: PiCreateAgentSession = async () => ({
  session: {
    async prompt() {}
  }
});

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
