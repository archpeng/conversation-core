import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createRuntimeExecutors } from "../apps/agent-service/src/executors.js";
import { loadAgentServiceRuntimeConfig } from "../apps/agent-service/src/runtime.js";
import { fakeCreateAgentSessionWithToolCalls, safetyGateway, baseTurn } from "./unified-agent.helpers.js";

type PmsFetchCall = {
  path: string;
  body?: Record<string, unknown>;
};

const goldenCatalog = [
  { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
  { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
  { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
];

describe("golden PMS group-booking E2E", () => {
  it("keeps the multi-turn Feishu booking path on catalog, composite workflow, and approval-card semantics", async () => {
    const pmsCalls: PmsFetchCall[] = [];
    const restoreFetch = installGoldenPmsFetch(pmsCalls);
    const gatewayOrder: string[] = [];
    const prompts: string[] = [];
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-golden-e2e",
        PMS_PLATFORM_BASE_URL: "https://pms-platform.golden",
        PMS_AGENT_DEFAULT_HOTEL_ID: "property-small-hotel",
        PMS_AGENT_DEFAULT_PROPERTY_ID: "property-small-hotel",
        PMS_AGENT_PI_MODE: "real"
      });
      const service = createAgentService({
        gateway: safetyGateway(gatewayOrder),
        createAgentSession: fakeCreateAgentSessionWithToolCalls([
          {
            text: "可以。请问莉莉要订哪天入住、哪天离店？如果有指定房型也一起告诉我。"
          },
          {
            calls: [{ toolName: "pms_room_type_catalog", params: {} }],
            text: "目前可选的配置房型有：花园别墅、花园套房、秘境洞穴。"
          },
          {
            calls: [{
              toolName: "pms_reservation_group_prepare_booking",
              params: {
                guestName: "莉莉",
                checkInDate: "2026-05-12",
                checkOutDate: "2026-05-14",
                roomType: "花园别墅",
                quantity: 2
              }
            }],
            text: "PMS 已准备多房预订确认卡。"
          }
        ], prompts),
        executors: createRuntimeExecutors(config)
      });

      const first = await service.handle({
        method: "POST",
        path: "/v1/feishu-turn",
        body: { ...baseTurn, messageId: "golden-message-1", message: { text: "给莉莉定两间房间" } }
      });
      const second = await service.handle({
        method: "POST",
        path: "/v1/feishu-turn",
        body: { ...baseTurn, messageId: "golden-message-2", message: { text: "后天入住 两天后离开. 你这里有什么房型" } }
      });
      const third = await service.handle({
        method: "POST",
        path: "/v1/feishu-turn",
        body: { ...baseTurn, messageId: "golden-message-3", message: { text: "花园别墅" } }
      });

      expect(first.body).toEqual({
        type: "text",
        text: "可以。请问莉莉要订哪天入住、哪天离店？如果有指定房型也一起告诉我。"
      });
      expect(second.body).toMatchObject({ type: "text" });
      expect(JSON.stringify(second.body)).toContain("花园别墅");
      expect(JSON.stringify(second.body)).toContain("花园套房");
      expect(JSON.stringify(second.body)).toContain("秘境洞穴");
      expect(third.body).toMatchObject({
        type: "approval_card",
        card: {
          ref: {
            pendingActionId: "pending-action-golden-group-1",
            pendingActionRef: "pending-action-golden-group-1",
            cardPayloadRef: "card-payload-golden-group-1",
            quoteRef: "quote-golden-group-1",
            selectionCount: 2
          }
        }
      });
      expect(JSON.stringify(third.body)).toContain("点击确认后将创建对应的正式预订和房间分配");
      expect(JSON.stringify(third.body)).not.toContain("不代表最终预订");
      expect(JSON.stringify(third.body)).not.toContain("PMS 返回错误");
      expect(pmsCalls.map((call) => call.path)).toEqual([
        "/v1/pms/room-types/catalog",
        "/v1/pms/room-types/catalog",
        "/v1/pms/availability/search",
        "/v1/pms/reservation-group-drafts/create",
        "/v1/pms/reservation-group-drafts/update",
        "/v1/pms/reservation-group-drafts/quote",
        "/v1/pms/reservation-group-drafts/prepare-confirm"
      ]);
      expect(pmsCalls[2].body).toMatchObject({
        checkInDate: "2026-05-12",
        checkOutDate: "2026-05-14",
        count: 2,
        roomTypeKeyword: "花园别墅"
      });
      expect(pmsCalls[4].body).toMatchObject({
        groupDraftRef: "group-draft-golden-1",
        slots: {
          selections: [
            { roomId: "room-A1", selectedCandidateRef: expect.stringContaining(":room-A1"), roomType: "花园别墅" },
            { roomId: "room-A2", selectedCandidateRef: expect.stringContaining(":room-A2"), roomType: "花园别墅" }
          ]
        }
      });
      expect(gatewayOrder).toEqual([
        "decide:pms_room_type_catalog",
        "audit:allow",
        "decide:pms_reservation_group_prepare_booking",
        "audit:allow"
      ]);
      expect(prompts).toHaveLength(3);
    } finally {
      restoreFetch();
    }
  });
});

function installGoldenPmsFetch(calls: PmsFetchCall[]): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" || url instanceof URL ? String(url) : url.url;
    const path = new URL(href).pathname;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ path, ...(body ? { body } : {}) });

    if (path === "/v1/pms/room-types/catalog") {
      return jsonResponse({ readModel: { propertyId: "property-small-hotel", roomTypes: goldenCatalog } });
    }
    if (path === "/v1/pms/availability/search") {
      return jsonResponse({
        readModel: {
          candidates: [
            { roomId: "room-A1", roomType: "花园别墅" },
            { roomId: "room-A2", roomType: "花园别墅" }
          ]
        }
      });
    }
    if (path === "/v1/pms/reservation-group-drafts/create") {
      return jsonResponse({ groupDraft: { groupDraftRef: "group-draft-golden-1", status: "collectingSlots" } });
    }
    if (path === "/v1/pms/reservation-group-drafts/update") {
      return jsonResponse({ groupDraft: { groupDraftRef: "group-draft-golden-1", status: "quoteReady" } });
    }
    if (path === "/v1/pms/reservation-group-drafts/quote") {
      return jsonResponse({ groupDraft: { groupDraftRef: "group-draft-golden-1", status: "quoteReady", quote: { quoteRef: "quote-golden-group-1", status: "pricingUnsupported" } } });
    }
    if (path === "/v1/pms/reservation-group-drafts/prepare-confirm") {
      return jsonResponse({
        groupDraft: {
          groupDraftRef: "group-draft-golden-1",
          status: "awaitingConfirmation",
          pendingAction: {
            pendingActionRef: "pending-action-golden-group-1",
            cardPayloadRef: "card-payload-golden-group-1",
            quoteRef: "quote-golden-group-1",
            confirmationMode: "typedCardOnly",
            mutationStatus: "none",
            selectionCount: 2,
            status: "awaitingConfirmation"
          }
        }
      });
    }
    return jsonResponse({ ok: false, errors: [{ code: "UNEXPECTED_ROUTE", message: path }] }, 500);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
