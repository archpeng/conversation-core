import { describe, expect, it } from "vitest";
import { createRuntimeExecutors, createRuntimePiSessionFactory, loadAgentServiceRuntimeConfig } from "../apps/agent-service/src/runtime.js";
import type { PiCreateAgentSessionOptions } from "../packages/unified-agent/src/index.js";

describe("agent service runtime wiring", () => {
  it("passes resourceLoader through the real-mode runtime factory into pi session creation", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_MODE: "real",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const calls: unknown[] = [];
    const resourceLoader = { systemPromptOverride: () => "runtime system prompt" };
    const factory = createRuntimePiSessionFactory(config, (async (options: unknown) => {
      calls.push(options);
      return { session: { async prompt() {} } };
    }) as never);

    await factory({ cwd: config.cwd, tools: [], customTools: [], resourceLoader } as PiCreateAgentSessionOptions);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      cwd: config.cwd,
      tools: [],
      customTools: [],
      resourceLoader
    });
  });

  it("passes configured GPT-5.5 model through the real-mode runtime factory", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_MODE: "real",
      PMS_AGENT_PI_MODEL_PROVIDER: "openai",
      PMS_AGENT_PI_MODEL_ID: "gpt-5.5",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const calls: unknown[] = [];
    const factory = createRuntimePiSessionFactory(config, (async (options: unknown) => {
      calls.push(options);
      return { session: { async prompt() {} } };
    }) as never);

    await factory({ cwd: config.cwd, tools: [], customTools: [] } as PiCreateAgentSessionOptions);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ model: { provider: "openai", id: "gpt-5.5" } });
  });

  it("uses typed PMS read params instead of runtime defaults for availability search", async () => {
    const bodies: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({ rooms: [] }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791",
        PMS_AGENT_DEFAULT_CHECK_IN_DATE: "2026-05-06",
        PMS_AGENT_DEFAULT_CHECK_OUT_DATE: "2026-05-07"
      });
      const executors = createRuntimeExecutors(config);

      await executors.pmsRead?.({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_read" } },
        request: {
          capabilityId: "pms_read",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          target: "availability",
          checkInDate: "2026-05-09",
          checkOutDate: "2026-05-10",
          quantity: 2,
          guestName: "王晓"
        }
      });

      expect(bodies).toEqual([{ tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", startDate: "2026-05-09", endDate: "2026-05-10" }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses typed PMS workflow params to create, quote, and prepare confirm through platform envelopes", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: JSON.parse(String(init?.body)) });
      if (href.endsWith("/v1/pms/reservation-drafts/create")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.create", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_typed_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-drafts/quote")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.quote", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_typed_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], quote: { quoteRef: "quote_ref_typed_1", status: "pricingUnsupported" } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.prepare_confirm", mutationStatus: "none", draft: { draftRef: "draft_ref_typed_1", status: "awaitingConfirmation", missingSlots: [], evidenceRefs: [], pendingAction: { pendingActionRef: "pending_typed_1", cardPayloadRef: "card_payload_typed_1", quoteRef: "quote_ref_typed_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation" } } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791",
        PMS_AGENT_DEFAULT_CHECK_IN_DATE: "2026-05-06",
        PMS_AGENT_DEFAULT_CHECK_OUT_DATE: "2026-05-07",
        PMS_AGENT_DEFAULT_ROOM_ID: "room-default",
        PMS_AGENT_DEFAULT_GUEST_NAME: "Default Guest"
      });
      const executors = createRuntimeExecutors(config);

      const evidence = await executors.pmsWorkflow?.({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_workflow" } },
        request: {
          capabilityId: "pms_workflow",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          target: "prepare_confirm",
          roomId: "room-A1",
          guestName: "王晓",
          checkInDate: "2026-05-09",
          checkOutDate: "2026-05-10",
          quantity: 2,
          sourceEpisodeRefs: ["pms_ev_read_1"]
        }
      });

      expect(calls.map((call) => call.url)).toEqual([
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/create",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/quote",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/prepare-confirm"
      ]);
      expect(calls[0].body).toMatchObject({
        operation: "pms.reservation.draft.create",
        propertyId: "property-small-hotel",
        actor: { type: "ai", id: "pms-agent-v2" },
        source: "api",
        slots: { roomId: "room-A1", guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", selectedCandidateRef: "pms_ev_read_1:room-A1" },
        evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_read_1" }]
      });
      expect(calls[1].body).toMatchObject({ operation: "pms.reservation.quote", draftRef: "draft_ref_typed_1" });
      expect(calls[2].body).toMatchObject({ operation: "pms.reservation.prepare_confirm", draftRef: "draft_ref_typed_1", quoteRef: "quote_ref_typed_1" });
      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "prepareReservationConfirm" },
        data: { pendingActionId: "pending_typed_1", cardPayloadRef: "card_payload_typed_1", quoteRef: "quote_ref_typed_1", confirmationMode: "typedCardOnly", mutationStatus: "none" }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not use runtime defaults to create workflow drafts without a PMS room fact", async () => {
    const calls: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(init?.body);
      return { ok: true, status: 200, json: async () => ({ draftId: "draft_unexpected", status: "draft" }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791",
        PMS_AGENT_DEFAULT_ROOM_ID: "room-default",
        PMS_AGENT_DEFAULT_GUEST_NAME: "Default Guest",
        PMS_AGENT_DEFAULT_CHECK_IN_DATE: "2026-05-06",
        PMS_AGENT_DEFAULT_CHECK_OUT_DATE: "2026-05-07"
      });
      const executors = createRuntimeExecutors(config);

      await expect(executors.pmsWorkflow?.({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_workflow" } },
        request: {
          capabilityId: "pms_workflow",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          target: "prepare_confirm",
          guestName: "王晓",
          checkInDate: "2026-05-09",
          checkOutDate: "2026-05-10"
        }
      })).rejects.toThrow("pms_workflow_room_required");
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
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

    await expect(factory({ cwd: config.cwd, tools: [], customTools: [] } as PiCreateAgentSessionOptions))
      .rejects.toThrow("model_not_resolved: Pi ModelRegistry could not resolve openai/missing-model-for-test");
  });
});
