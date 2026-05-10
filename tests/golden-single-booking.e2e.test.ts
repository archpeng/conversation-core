import { describe, expect, it } from "vitest";
import { createAgentService, type AgentServiceResponse } from "../apps/agent-service/src/index.js";
import { createRuntimeExecutors } from "../apps/agent-service/src/executors.js";
import { loadAgentServiceRuntimeConfig } from "../apps/agent-service/src/runtime.js";
import { baseTurn, fakeCreateAgentSessionWithToolCalls, safetyGateway } from "./unified-agent.helpers.js";

type PmsFetchCall = {
  path: string;
  body?: Record<string, unknown>;
};

const goldenCatalog = [
  { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
  { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
  { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" },
];

describe("golden PMS single-booking E2E", () => {
  it("sends an approval card in the incident flow when the user selects room D2", async () => {
    const result = await runGoldenSingleBooking({
      finalMessage: "选择d2, 发卡片给我确认",
      prepareParams: {
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "洞穴",
        roomNumber: "d2",
        quantity: 1,
      },
    });

    expect(result.third.body).toMatchObject({
      type: "approval_card",
      card: {
        ref: {
          pendingActionId: "pending-action-golden-single-1",
          pendingActionRef: "pending-action-golden-single-1",
          cardPayloadRef: "card-payload-golden-single-1",
          quoteRef: "quote-golden-single-1",
          selectionCount: 1,
        },
      },
    });
    expect(JSON.stringify(result.third.body)).not.toContain("没有可用于继续报价");
    expect(JSON.stringify(result.third.body)).not.toContain("PMS 返回错误");
    expect(result.pmsCalls.map((call) => call.path)).toEqual([
      "/v1/pms/room-types/catalog",
      "/v1/pms/room-types/catalog",
      "/v1/pms/availability/search",
      "/v1/pms/reservation-drafts/create",
      "/v1/pms/reservation-drafts/quote",
      "/v1/pms/reservation-drafts/prepare-confirm",
    ]);
    expect(result.pmsCalls[2].body).toMatchObject({
      checkInDate: "2026-05-11",
      checkOutDate: "2026-05-12",
      count: 1,
      roomTypeKeyword: "秘境洞穴",
    });
    expect(result.pmsCalls[3].body).toMatchObject({
      slots: {
        roomId: "room-D2",
        guestDisplayName: "花理论",
        arrivalDate: "2026-05-11",
        departureDate: "2026-05-12",
        roomTypeKeyword: "秘境洞穴",
      },
    });
    expect(result.gatewayOrder).toEqual([
      "decide:pms_room_type_catalog",
      "audit:allow",
      "decide:pms_reservation_prepare_booking",
      "audit:allow",
    ]);
  });

  it("auto-selects the first available single room and sends an approval card when no room number is provided", async () => {
    const result = await runGoldenSingleBooking({
      finalMessage: "洞穴1间",
      prepareParams: {
        guestName: "花理论",
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        roomType: "洞穴",
        quantity: 1,
      },
    });

    expect(result.third.body).toMatchObject({ type: "approval_card" });
    expect(result.pmsCalls[3].body).toMatchObject({ slots: { roomId: "room-D1", roomTypeKeyword: "秘境洞穴" } });
  });
});

async function runGoldenSingleBooking(input: {
  finalMessage: string;
  prepareParams: Record<string, unknown>;
}): Promise<{ third: AgentServiceResponse; pmsCalls: PmsFetchCall[]; gatewayOrder: string[] }> {
  const pmsCalls: PmsFetchCall[] = [];
  const restoreFetch = installGoldenPmsFetch(pmsCalls);
  const gatewayOrder: string[] = [];
  const prompts: string[] = [];
  try {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-golden-single-e2e",
      PMS_PLATFORM_BASE_URL: "https://pms-platform.golden",
      PMS_AGENT_DEFAULT_HOTEL_ID: "property-small-hotel",
      PMS_AGENT_DEFAULT_PROPERTY_ID: "property-small-hotel",
      PMS_AGENT_PI_MODE: "real",
    });
    const service = createAgentService({
      gateway: safetyGateway(gatewayOrder),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([
        { text: "可以。请问花理论要订哪天入住、哪天离店？" },
        {
          calls: [{ toolName: "pms_room_type_catalog", params: {} }],
          text: "好的，入住 2026-05-11，退房 2026-05-12，客人“花理论”，1 间房。请问要订哪个房型？可选如：花园别墅、花园套房、秘境洞穴。",
        },
        {
          calls: [{ toolName: "pms_reservation_prepare_booking", params: input.prepareParams }],
          text: "PMS 已准备单房预订确认卡。",
        },
      ], prompts),
      executors: createRuntimeExecutors(config),
    });

    await service.handle({
      method: "POST",
      path: "/v1/feishu-turn",
      body: { ...baseTurn, messageId: "golden-single-message-1", message: { text: "给花理论订一间房" } },
    });
    await service.handle({
      method: "POST",
      path: "/v1/feishu-turn",
      body: { ...baseTurn, messageId: "golden-single-message-2", message: { text: "明天,后天出" } },
    });
    const third = await service.handle({
      method: "POST",
      path: "/v1/feishu-turn",
      body: { ...baseTurn, messageId: `golden-single-message-3-${input.finalMessage}`, message: { text: input.finalMessage } },
    });

    expect(prompts).toHaveLength(3);
    return { third, pmsCalls, gatewayOrder };
  } finally {
    restoreFetch();
  }
}

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
            { roomId: "room-D1", roomNumber: "D1", roomTypeId: "room-type-cave", roomType: "秘境洞穴" },
            { roomId: "room-D2", roomNumber: "D2", roomTypeId: "room-type-cave", roomType: "秘境洞穴" },
          ],
        },
      });
    }
    if (path === "/v1/pms/reservation-drafts/create") {
      return jsonResponse({
        ok: true,
        operation: "pms.reservation.draft.create",
        mutationStatus: "draftOnly",
        draft: { draftRef: "draft-golden-single-1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] },
      });
    }
    if (path === "/v1/pms/reservation-drafts/quote") {
      return jsonResponse({
        ok: true,
        operation: "pms.reservation.quote",
        mutationStatus: "draftOnly",
        draft: {
          draftRef: "draft-golden-single-1",
          status: "quoteReady",
          missingSlots: [],
          quote: { quoteRef: "quote-golden-single-1", status: "pricingUnsupported" },
        },
      });
    }
    if (path === "/v1/pms/reservation-drafts/prepare-confirm") {
      return jsonResponse({
        ok: true,
        operation: "pms.reservation.prepare_confirm",
        mutationStatus: "draftOnly",
        draft: {
          draftRef: "draft-golden-single-1",
          status: "awaitingConfirmation",
          missingSlots: [],
          pendingAction: {
            pendingActionRef: "pending-action-golden-single-1",
            cardPayloadRef: "card-payload-golden-single-1",
            quoteRef: "quote-golden-single-1",
            confirmationMode: "typedCardOnly",
            mutationStatus: "none",
            status: "awaitingConfirmation",
            selectionCount: 1,
          },
        },
      });
    }
    throw new Error(`unexpected PMS route ${path}`);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
