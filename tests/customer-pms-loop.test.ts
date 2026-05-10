import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createPmsEvidence, type AvailabilitySearchResult, type RoomTypeCatalogResult } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn, type AgentSessionFactory, type PmsReadExecutorMap } from "../packages/unified-agent/src/index.js";
import type { FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";
import { pmsReadExecutors, safetyGateway } from "./unified-agent.helpers.js";

const turn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_secret_1",
  messageId: "message_1",
  actor: { role: "customer", id: "actor_secret_1" },
  message: { text: "2026-05-06 大床房有房吗" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

describe("customer PMS degraded loop", () => {
  it("grounds LLM-unavailable availability fallback in generated PMS evidence", async () => {
    const response = await runEvalTurn({
      body: turn,
      pmsReadExecutors: availabilityExecutors(evidence({ rooms: [{ roomId: "room_secret_1", roomType: "大床房", available: true, priceCents: 128800 }] }))
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "text", evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1778068800000"] });
    expect(JSON.stringify(response.body)).toContain("大床房");
    expect(JSON.stringify(response.body)).not.toContain("room_secret_1");
  });

  it("uses room type catalog instead of availability for no-date room type questions", async () => {
    let availabilityReads = 0;
    const response = await runEvalTurn({
      body: { ...turn, message: { text: "有哪些房型" } },
      pmsReadExecutors: {
        ...availabilityExecutors(evidence({ rooms: [] })),
        pms_availability_search: () => {
          availabilityReads += 1;
          return evidence({ rooms: [] });
        },
        pms_room_type_catalog: () => catalogEvidence({
          roomTypes: [
            { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
            { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" }
          ]
        })
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      type: "text",
      text: "PMS 证据显示本酒店配置房型：花园别墅（6 间）、花园套房（2 间）。evidenceRefs=pms_ev_tenant_1_roomTypeCatalog_1778068800000",
      evidenceRefs: ["pms_ev_tenant_1_roomTypeCatalog_1778068800000"]
    });
    expect(availabilityReads).toBe(0);
  });

  it("asks for required availability slots before reading PMS", async () => {
    let reads = 0;
    const missingDate = await runEvalTurn({
      body: { ...turn, message: { text: "大床房有房吗" } },
      pmsReadExecutors: availabilityExecutors(() => {
        reads += 1;
        return evidence({ rooms: [] });
      })
    });
    const missingRoomType = await runEvalTurn({
      body: { ...turn, messageId: "message_2", message: { text: "2026-05-06 有房吗" } },
      pmsReadExecutors: availabilityExecutors(() => {
        reads += 1;
        return evidence({ rooms: [] });
      })
    });

    expect(missingDate.body).toEqual({ type: "refusal", reason: "invalid_request", message: "请先提供入住和离店日期。" });
    expect(missingRoomType.body).toEqual({ type: "refusal", reason: "invalid_request", message: "请先提供要查询的房型。" });
    expect(reads).toBe(0);
  });

  it("keeps booking preparation out of deterministic fallback", async () => {
    const response = await runEvalTurn({
      body: { ...turn, message: { text: "我要预订 2026-05-06 大床房" } },
      pmsReadExecutors: availabilityExecutors(evidence({ rooms: [] }))
    });

    expect(response.body).toEqual({
      type: "refusal",
      reason: "unsupported",
      message: "PMS booking preparation requires the LLM to compose the safe PMS workflow tools. Please retry when the LLM is available."
    });
  });

  it("keeps natural-language confirm behind the typed-card boundary", async () => {
    const session = await createUnifiedAgentSession({
      turn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession,
      executors: { pmsReadExecutors: availabilityExecutors(evidence({ rooms: [] })) }
    });

    const result = await runAgentTurn(session, { ...turn, message: { text: "确认" } });

    expect(result).toEqual({ type: "refusal", reason: "invalid_request", message: "请先通过确认卡片生成待审批操作；自然语言确认不会执行 PMS 变更。" });
  });

  it("continues follow-up availability by re-reading PMS evidence", async () => {
    const refs: string[] = [];
    const session = await createUnifiedAgentSession({
      turn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSession,
      executors: {
        pmsReadExecutors: availabilityExecutors(() => {
          const item = evidence({ rooms: [{ roomId: `room_secret_${refs.length}`, roomType: "大床房", available: true }] }, `2026-05-06T12:0${refs.length}:00.000Z`);
          refs.push(item.evidenceRef);
          return item;
        })
      }
    });

    const first = await runAgentTurn(session, turn);
    const followUp = await runAgentTurn(session, { ...turn, messageId: "message_3", message: { text: "那明天呢" } });

    expect(first).toMatchObject({ type: "text", evidenceRefs: [refs[0]] });
    expect(followUp).toMatchObject({ type: "text", evidenceRefs: [refs[1]] });
    expect(refs).toHaveLength(2);
  });
});

type RunEvalTurnInput = {
  body: FeishuTurnInput;
  pmsReadExecutors: PmsReadExecutorMap;
};

async function runEvalTurn(input: RunEvalTurnInput) {
  const service = createAgentService({
    gateway: safetyGateway([]),
    createAgentSession: fakeCreateAgentSession,
    executors: { pmsReadExecutors: input.pmsReadExecutors }
  });
  return service.handle({ method: "POST", path: "/v1/eval-turn", body: input.body });
}

function availabilityExecutors(read: ReturnType<typeof evidence> | (() => ReturnType<typeof evidence>)): PmsReadExecutorMap {
  const readFn = typeof read === "function" ? read : () => read;
  return pmsReadExecutors({ pms_availability_search: readFn });
}

function evidence(data: AvailabilitySearchResult, fetchedAt = "2026-05-06T12:00:00.000Z") {
  return createPmsEvidence({
    method: "searchAvailability",
    tenantId: "tenant_1",
    fetchedAt,
    data,
    summary: "availability"
  });
}

function catalogEvidence(data: RoomTypeCatalogResult, fetchedAt = "2026-05-06T12:00:00.000Z") {
  return createPmsEvidence({
    method: "roomTypeCatalog",
    tenantId: "tenant_1",
    fetchedAt,
    data,
    summary: "room type catalog"
  });
}

const fakeCreateAgentSession: AgentSessionFactory = async () => ({
  session: {
    async prompt() {}
  }
});
