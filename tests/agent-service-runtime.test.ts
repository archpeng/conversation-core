import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createRuntimeExecutors, createRuntimePiSessionFactory, createRuntimeResourceLoaderFactory, loadAgentServiceRuntimeConfig, startAgentHttpServer } from "../apps/agent-service/src/runtime.js";

describe("agent service runtime wiring", () => {
  it("loads runtime defaults and explicit opt-ins", () => {
    const config = loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test" });

    expect(config.logTurnEvents).toBe(false);
    expect(config.maxInboundBodyBytes).toBe(256 * 1024);
    expect(config.piAgentDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent");
    expect(config.piSessionDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent/sessions");
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test", PMS_AGENT_LOG_TURN_EVENTS: "true" }).logTurnEvents).toBe(true);
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test", PMS_AGENT_MAX_BODY_BYTES: "8" }).maxInboundBodyBytes).toBe(8);
  });

  it("rejects oversized HTTP request bodies before service handling", async () => {
    const handled: unknown[] = [];
    const service = {
      async handle(request: unknown) {
        handled.push(request);
        return { status: 200, headers: { "content-type": "application/json" } as const, body: { type: "text", text: "unexpected" } };
      }
    };
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_MAX_BODY_BYTES: "8",
      PMS_AGENT_PI_MODE: "stub",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const started = await startAgentHttpServer({ ...config, port: 0 }, service);
    try {
      const response = await fetch(`${started.url}/v1/feishu-turn`, { method: "POST", body: "012345678" });

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ type: "refusal", reason: "invalid_request", message: "Request body too large." });
      expect(handled).toEqual([]);
    } finally {
      await started.close();
    }
  });

  it("keeps health and valid turn behavior under the body limit", async () => {
    const service = createAgentService({
      gateway: { decide: () => ({ outcome: "deny", reasons: [], audit: { capabilityId: "test" } }), audit: () => ({ id: "audit_1" }) },
      createAgentSession: async () => ({ session: { async prompt() {} } })
    });
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_MAX_BODY_BYTES: "4096",
      PMS_AGENT_PI_MODE: "stub",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const started = await startAgentHttpServer({ ...config, port: 0 }, service);
    try {
      const health = await fetch(`${started.url}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: "ok", service: "pms-agent-v2-agent-service" });

      const turn = await fetch(`${started.url}/v1/feishu-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant_1",
          channel: "feishu",
          sessionId: "session_1",
          messageId: "message_1",
          actor: { role: "customer", id: "customer_1" },
          message: { text: "你好" },
          receivedAt: "2026-05-07T00:00:00.000Z"
        })
      });
      expect(turn.status).toBe(200);
      expect(await turn.json()).toMatchObject({ type: "text" });
    } finally {
      await started.close();
    }
  });

  it("fails visibly when a configured runtime model cannot be resolved", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_MODE: "real",
      PMS_AGENT_PI_MODEL_PROVIDER: "openai",
      PMS_AGENT_PI_MODEL_ID: "missing-model-for-test",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const factory = createRuntimePiSessionFactory(config, (async () => ({ session: { async prompt() {} } })) as never);

    await expect(factory({ cwd: config.cwd, tools: [], customTools: [] } as never))
      .rejects.toThrow("model_not_resolved: Pi ModelRegistry could not resolve openai/missing-model-for-test");
  });

  it("injects a virtual PMS hotel profile context file before Pi session creation", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).endsWith("/v1/pms/hotel/profile")) {
        return { ok: true, status: 200, json: async () => ({ readModel: {
          propertyId: "property-small-hotel",
          propertyName: "PMS 小型酒店样板",
          timeZone: "Asia/Shanghai",
          status: "active",
          roomTotal: 13,
          roomTypes: [
            { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" }
          ]
        } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ readModel: { propertyId: "property-small-hotel", roomTypes: [
        { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
        { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
        { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
      ] } }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
      });
      const loader = await createRuntimeResourceLoaderFactory(config)("system prompt");
      const profileFile = loader.getAgentsFiles().agentsFiles.find((file) => file.path === "/virtual/PMS_HOTEL_PROFILE.md");

      expect(profileFile?.content).toContain("PMS Platform safe-read snapshot");
      expect(profileFile?.content).toContain("hotelName: PMS 小型酒店样板");
      expect(profileFile?.content).toContain("configuredRoomTotal: 13");
      expect(profileFile?.content).toContain("花园别墅: 6 rooms");
      expect(profileFile?.content).toContain("Availability, price, reservation, room status");
      expect(calls.map((call) => call.url)).toEqual([
        "http://127.0.0.1:8791/v1/pms/hotel/profile",
        "http://127.0.0.1:8791/v1/pms/room-types/catalog"
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("routes generated availability executor to PMS Platform availability search", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      const body = JSON.parse(String(init?.body));
      calls.push({ url: href, body });
      if (href.endsWith("/v1/pms/room-types/catalog")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ readModel: { propertyId: "property-small-hotel", roomTypes: [
            { roomTypeId: "room-type-garden-villa", code: "garden-villa", displayName: "花园别墅", roomCount: 6, status: "active" },
            { roomTypeId: "room-type-garden-suite", code: "garden-suite", displayName: "花园套房", roomCount: 2, status: "active" },
            { roomTypeId: "room-type-cave", code: "cave", displayName: "秘境洞穴", roomCount: 5, status: "active" }
          ] } })
        } as Response;
      }
      if (href.endsWith("/v1/pms/availability/search") && body.startDate === "2026-05-11" && body.roomTypeKeyword === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ readModel: { candidates: [
            { roomId: "room-A1", roomType: "花园别墅" },
            { roomId: "room-A2", roomType: "花园别墅" },
            { roomId: "room-C2", roomType: "花园套房" }
          ] } })
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ readModel: { candidates: [] } }) } as Response;
    }) as typeof fetch;
    try {
      const executors = createRuntimeExecutors(loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791",
        PMS_AGENT_DEFAULT_CHECK_IN_DATE: "2026-05-06",
        PMS_AGENT_DEFAULT_CHECK_OUT_DATE: "2026-05-07"
      }));

      await executors.pmsReadExecutors?.pms_availability_search?.({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_availability_search" } },
        request: {
          capabilityId: "pms_availability_search",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          checkInDate: "2026-05-09",
          checkOutDate: "2026-05-10",
          quantity: 2
        }
      });
      const unrestrictedText = await executors.pmsReadExecutors?.pms_availability_search?.({
        auditId: "audit_2",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_availability_search" } },
        request: {
          capabilityId: "pms_availability_search",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          checkInDate: "2026-05-11",
          checkOutDate: "2026-05-17",
          quantity: 1,
          roomType: "不限制房型"
        }
      });
      const unmatchedRoomType = await executors.pmsReadExecutors?.pms_availability_search?.({
        auditId: "audit_3",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_availability_search" } },
        request: {
          capabilityId: "pms_availability_search",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          checkInDate: "2026-05-11",
          checkOutDate: "2026-05-13",
          roomType: "大床房"
        }
      });
      const configuredButUnavailable = await executors.pmsReadExecutors?.pms_availability_search?.({
        auditId: "audit_4",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_availability_search" } },
        request: {
          capabilityId: "pms_availability_search",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          checkInDate: "2026-05-11",
          checkOutDate: "2026-05-13",
          roomType: "花园别墅"
        }
      });

      expect(calls).toEqual([
        {
          url: "http://127.0.0.1:8791/v1/pms/availability/search",
          body: { tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", count: 2, startDate: "2026-05-09", endDate: "2026-05-10" }
        },
        {
          url: "http://127.0.0.1:8791/v1/pms/room-types/catalog",
          body: { operation: "pms_room_type_catalog", propertyId: "property-small-hotel" }
        },
        {
          url: "http://127.0.0.1:8791/v1/pms/room-types/catalog",
          body: { operation: "pms_room_type_catalog", propertyId: "property-small-hotel" }
        },
        {
          url: "http://127.0.0.1:8791/v1/pms/room-types/catalog",
          body: { operation: "pms_room_type_catalog", propertyId: "property-small-hotel" }
        },
        {
          url: "http://127.0.0.1:8791/v1/pms/availability/search",
          body: { tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-11", checkOutDate: "2026-05-13", startDate: "2026-05-11", endDate: "2026-05-13", roomType: "花园别墅", roomTypeKeyword: "花园别墅" }
        },
      ]);
      expect(unrestrictedText?.summary).toContain("no configured room type 不限制房型");
      expect(unmatchedRoomType?.summary).toContain("no configured room type 大床房");
      expect(unmatchedRoomType?.summary).toContain("花园别墅 6");
      expect(unmatchedRoomType?.summary).toContain("花园套房 2");
      expect(unmatchedRoomType?.summary).toContain("秘境洞穴 5");
      expect(configuredButUnavailable?.summary).toContain("configured room type 花园别墅");
      expect(configuredButUnavailable?.summary).toContain("returned 0 rooms");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("routes each safe workflow executor to its exact PMS Platform route", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: JSON.parse(String(init?.body)) });
      if (href.endsWith("/create")) return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.create", mutationStatus: "draftOnly", draft: { draftRef: "draft_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) } as Response;
      if (href.endsWith("/quote")) return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.quote", mutationStatus: "draftOnly", draft: { draftRef: "draft_1", status: "quoteReady", missingSlots: [], quote: { quoteRef: "quote_1", status: "pricingUnsupported" } } }) } as Response;
      if (href.endsWith("/prepare-confirm")) return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.prepare_confirm", mutationStatus: "none", draft: { draftRef: "draft_1", status: "awaitingConfirmation", pendingAction: { pendingActionRef: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation", quoteRef: "quote_1" } } }) } as Response;
      if (href.endsWith("/update")) return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.update", mutationStatus: "draftOnly", draft: { draftRef: "draft_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) } as Response;
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;
    try {
      const executors = createRuntimeExecutors(loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
      })).pmsWorkflowExecutors;

      await executors?.pms_reservation_draft_create(baseInput("pms_reservation_draft_create", { roomId: "room-A1", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", sourceEvidenceRef: "pms_ev_1" }));
      await executors?.pms_reservation_draft_update(baseInput("pms_reservation_draft_update", { draftRef: "draft_1", roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1", sourceEvidenceRef: "pms_ev_1" }));
      await executors?.pms_reservation_quote(baseInput("pms_reservation_quote", { draftRef: "draft_1" }));
      const prepared = await executors?.pms_reservation_prepare_confirm(baseInput("pms_reservation_prepare_confirm", { draftRef: "draft_1", quoteRef: "quote_1" }));

      expect(calls.map((call) => call.url)).toEqual([
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/create",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/update",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/quote",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/prepare-confirm"
      ]);
      expect(prepared).toMatchObject({ source: { method: "prepareReservationConfirm" }, data: { pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function baseInput(capabilityId: string, request: Record<string, unknown>) {
  return {
    auditId: "audit_1",
    decision: { outcome: "allow", reasons: [], audit: { capabilityId } },
    request: {
      capabilityId,
      actor: { profile: "customer" as const },
      tenantId: "tenant_1",
      ...request
    }
  };
}
