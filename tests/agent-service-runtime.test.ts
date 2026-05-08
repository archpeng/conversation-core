import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentService } from "../apps/agent-service/src/index.js";
import { createRuntimeExecutors, createRuntimePiSessionFactory, dispatchPmsRead, loadAgentServiceRuntimeConfig, startAgentHttpServer } from "../apps/agent-service/src/runtime.js";
import type { PiCreateAgentSessionOptions } from "../packages/unified-agent/src/index.js";
import type { GatedToolRequest } from "../packages/gated-tools/src/index.js";

describe("agent service runtime wiring", () => {
  it("loads turn-event logging as explicit opt-in only", () => {
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test" }).logTurnEvents).toBe(false);
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test", PMS_AGENT_LOG_TURN_EVENTS: "false" }).logTurnEvents).toBe(false);
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test", PMS_AGENT_LOG_TURN_EVENTS: "true" }).logTurnEvents).toBe(true);
  });

  it("loads an explicit inbound body size limit", () => {
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test" }).maxInboundBodyBytes).toBe(256 * 1024);
    expect(loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test", PMS_AGENT_MAX_BODY_BYTES: "8" }).maxInboundBodyBytes).toBe(8);
  });

  it("defaults Pi runtime state to a project-private agent dir instead of the global Pi dir", () => {
    const config = loadAgentServiceRuntimeConfig({ PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test" });

    expect(config.piAgentDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent");
    expect(config.piSessionDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent/sessions");
    expect(config.piSessionMode).toBe("persistent");
  });

  it("allows explicit in-memory Pi sessions as an opt-out", () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_SESSION_MODE: "memory"
    });

    expect(config.piSessionMode).toBe("memory");
  });

  it("allows an explicit project-private Pi agent dir override", () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_AGENT_DIR: ".local/pi-agent-live",
      PMS_AGENT_PI_SESSION_DIR: ".local/pi-agent-live/sessions"
    });

    expect(config.piAgentDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent-live");
    expect(config.piSessionDir).toBe("/tmp/pms-agent-v2-runtime-test/.local/pi-agent-live/sessions");
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
      gateway: { decide: () => ({ outcome: "deny", reasons: [] }), audit: () => ({ id: "audit_1" }) },
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
      agentDir: config.piAgentDir,
      tools: [],
      customTools: [],
      resourceLoader
    });
  });

  it("opens the deterministic Pi session file in persistent runtime mode", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_MODE: "real",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const sessionFile = join(config.piSessionDir, "feishu-test-session.jsonl");
    const calls: unknown[] = [];
    const factory = createRuntimePiSessionFactory(config, (async (options: unknown) => {
      calls.push(options);
      return { session: { async prompt() {} } };
    }) as never);

    await factory({ cwd: config.cwd, sessionFile, tools: [], customTools: [] } as PiCreateAgentSessionOptions);

    const options = calls[0] as { sessionManager?: { getSessionFile?: () => string | undefined; getSessionDir?: () => string } };
    expect(options.sessionManager?.getSessionFile?.()).toBe(sessionFile);
    expect(options.sessionManager?.getSessionDir?.()).toBe(config.piSessionDir);
  });

  it("passes configured GPT-5.5 model through the real-mode runtime factory", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_AGENT_PI_MODE: "real",
      PMS_AGENT_PI_MODEL_PROVIDER: "openai",
      PMS_AGENT_PI_MODEL_ID: "gpt-5.5",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    writeMinimalPiModels(config.piAgentDir);
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

      expect(bodies).toEqual([{ tenantId: "tenant_1", hotelId: "property-small-hotel", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", count: 2, startDate: "2026-05-09", endDate: "2026-05-10" }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses typed PMS workflow params through create, update, quote, prepare-confirm, and status readback", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: JSON.parse(String(init?.body)) });
      if (href.endsWith("/v1/pms/reservation-drafts/create")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.create", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_typed_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-drafts/update")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.update", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_typed_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [], slots: { roomId: "room-A1", selectedCandidateRef: "pms_ev_read_1:room-A1" } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-drafts/quote")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.quote", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_typed_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], quote: { quoteRef: "quote_ref_typed_1", status: "pricingUnsupported" } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.prepare_confirm", mutationStatus: "none", draft: { draftRef: "draft_ref_typed_1", status: "awaitingConfirmation", missingSlots: [], evidenceRefs: [], pendingAction: { pendingActionRef: "pending_typed_1", cardPayloadRef: "card_payload_typed_1", quoteRef: "quote_ref_typed_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation" } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/pending-actions/status")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.pending_action.status", mutationStatus: "none", pendingAction: { pendingActionRef: "pending_typed_1", cardPayloadRef: "card_payload_typed_1", quoteRef: "quote_ref_typed_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation" } }) } as Response;
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
          quantity: 1,
          sourceEpisodeRefs: ["pms_ev_read_1"]
        }
      });

      expect(calls.map((call) => call.url)).toEqual([
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/create",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/update",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/quote",
        "http://127.0.0.1:8791/v1/pms/reservation-drafts/prepare-confirm",
        "http://127.0.0.1:8791/v1/pms/pending-actions/status"
      ]);
      expect(calls[0].body).toMatchObject({
        operation: "pms.reservation.draft.create",
        propertyId: "property-small-hotel",
        actor: { type: "ai", id: "pms-agent-v2" },
        source: "api",
        slots: { roomId: "room-A1", guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", selectedCandidateRef: "pms_ev_read_1:room-A1" },
        evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_read_1" }]
      });
      expect(calls[1].body).toMatchObject({ operation: "pms.reservation.draft.update", draftRef: "draft_ref_typed_1", slots: { roomId: "room-A1", selectedCandidateRef: "pms_ev_read_1:room-A1" } });
      expect(calls[2].body).toMatchObject({ operation: "pms.reservation.quote", draftRef: "draft_ref_typed_1" });
      expect(calls[3].body).toMatchObject({ operation: "pms.reservation.prepare_confirm", draftRef: "draft_ref_typed_1", quoteRef: "quote_ref_typed_1" });
      expect(calls[4].body).toMatchObject({ operation: "pms.pending_action.status", pendingActionRef: "pending_typed_1", cardPayloadRef: "card_payload_typed_1" });
      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "prepareReservationConfirm" },
        data: { pendingActionId: "pending_typed_1", cardPayloadRef: "card_payload_typed_1", quoteRef: "quote_ref_typed_1", confirmationMode: "typedCardOnly", mutationStatus: "none" }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses reservation group draft routes for quantity greater than one", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: JSON.parse(String(init?.body)) });
      if (href.endsWith("/v1/pms/reservation-group-drafts/create")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.create", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "collectingSlots", missingSlots: ["roomSelections"], evidenceRefs: [] } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-group-drafts/update")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.update", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], slots: { selections: [{ roomId: "room-A1" }, { roomId: "room-A2" }] } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-group-drafts/quote")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_quote", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", quote: { quoteRef: "group_quote_ref_1", status: "pricingUnsupported" } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/reservation-group-drafts/prepare-confirm")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_prepare_confirm", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "awaitingConfirmation", pendingAction: { pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation", selectionCount: 2 } } }) } as Response;
      }
      if (href.endsWith("/v1/pms/pending-actions/status")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.pending_action.status", mutationStatus: "none", pendingAction: { pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", status: "awaitingConfirmation" } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
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
          selections: [
            { roomId: "room-A1", selectedCandidateRef: "pms_ev_read_1:room-A1", roomType: "suite" },
            { roomId: "room-A2", selectedCandidateRef: "pms_ev_read_1:room-A2", roomType: "suite" }
          ],
          sourceEpisodeRefs: ["pms_ev_read_1"]
        }
      });

      expect(calls.map((call) => call.url)).toEqual([
        "http://127.0.0.1:8791/v1/pms/reservation-group-drafts/create",
        "http://127.0.0.1:8791/v1/pms/reservation-group-drafts/update",
        "http://127.0.0.1:8791/v1/pms/reservation-group-drafts/quote",
        "http://127.0.0.1:8791/v1/pms/reservation-group-drafts/prepare-confirm",
        "http://127.0.0.1:8791/v1/pms/pending-actions/status"
      ]);
      expect(calls[0].body).toMatchObject({ operation: "pms.reservation.group_draft.create", slots: { guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", quantity: 2 }, evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_read_1" }] });
      expect(calls[1].body).toMatchObject({ operation: "pms.reservation.group_draft.update", groupDraftRef: "group_draft_ref_1", slots: { selections: [{ roomId: "room-A1", selectedCandidateRef: "pms_ev_read_1:room-A1" }, { roomId: "room-A2", selectedCandidateRef: "pms_ev_read_1:room-A2" }] } });
      expect(calls[2].body).toMatchObject({ operation: "pms.reservation.group_quote", groupDraftRef: "group_draft_ref_1" });
      expect(calls[3].body).toMatchObject({ operation: "pms.reservation.group_prepare_confirm", groupDraftRef: "group_draft_ref_1", quoteRef: "group_quote_ref_1" });
      expect(calls[4].body).toMatchObject({ operation: "pms.pending_action.status", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1" });
      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "prepareReservationGroupConfirm" },
        data: { pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", selectionCount: 2, confirmationMode: "typedCardOnly", mutationStatus: "none" }
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

  it("builds per-capability executors that route pms_availability_search through the correct client method", async () => {
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

      const evidence = await executors.pmsReadExecutors?.pms_availability_search({
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

      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "searchAvailability" },
        data: { rooms: [] }
      });
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        tenantId: "tenant_1",
        hotelId: "property-small-hotel",
        checkInDate: "2026-05-09",
        checkOutDate: "2026-05-10",
        count: 2
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("builds per-capability executors that route pms_get_room through the correct client method", async () => {
    const bodies: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({ roomId: "room-A1", roomType: "大床房", status: "available" }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
      });
      const executors = createRuntimeExecutors(config);

      const evidence = await executors.pmsReadExecutors?.pms_get_room({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_get_room" } },
        request: {
          capabilityId: "pms_get_room",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          roomId: "room-A1"
        }
      });

      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "getRoom" },
        data: { roomId: "room-A1", roomType: "大床房", status: "available" }
      });
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        tenantId: "tenant_1",
        roomId: "room-A1"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("builds per-capability executors that route pms_pending_action_status through the correct client method", async () => {
    const bodies: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({ pendingActionId: "pending_1", status: "awaitingConfirmation" }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
      });
      const executors = createRuntimeExecutors(config);

      const evidence = await executors.pmsReadExecutors?.pms_pending_action_status({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_pending_action_status" } },
        request: {
          capabilityId: "pms_pending_action_status",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          pendingActionId: "pending_1"
        }
      });

      expect(evidence).toMatchObject({
        source: { system: "pms-platform", method: "pendingActionStatus" },
        data: { pendingActionId: "pending_1", status: "awaitingConfirmation" }
      });
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        pendingActionRef: "pending_1"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("dispatchPmsRead routes to the correct per-capability executor by capabilityId", async () => {
    const bodies: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({ rooms: [{ roomId: "room-B1", roomType: "双人床房", available: true }] }) } as Response;
    }) as typeof fetch;
    try {
      const config = loadAgentServiceRuntimeConfig({
        PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
        PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791",
        PMS_AGENT_DEFAULT_CHECK_IN_DATE: "2026-05-06",
        PMS_AGENT_DEFAULT_CHECK_OUT_DATE: "2026-05-07"
      });
      const executors = createRuntimeExecutors(config);

      const result = await dispatchPmsRead({
        capabilityId: "pms_availability_search",
        actor: { profile: "customer" },
        tenantId: "tenant_1",
        checkInDate: "2026-05-09",
        checkOutDate: "2026-05-10"
      }, executors.pmsReadExecutors!);

      const evidence = result as { source: { system: string; method: string }; data: { rooms: unknown[] } };
      expect(evidence.source).toEqual({ system: "pms-platform", method: "searchAvailability" });
      expect(evidence.data.rooms).toEqual([{ roomId: "room-B1", roomType: "双人床房", available: true }]);
      expect(bodies[0]).toMatchObject({
        tenantId: "tenant_1",
        hotelId: "property-small-hotel",
        checkInDate: "2026-05-09",
        checkOutDate: "2026-05-10"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("dispatchPmsRead throws for unknown capability IDs", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const executors = createRuntimeExecutors(config);

    await expect(dispatchPmsRead({
      capabilityId: "unknown_capability",
      actor: { profile: "customer" },
      tenantId: "tenant_1"
    }, executors.pmsReadExecutors!)).rejects.toThrow("Unknown PMS read capability: unknown_capability");
  });

  it("dispatchPmsRead throws for legacy pms_read capabilityId", async () => {
    const config = loadAgentServiceRuntimeConfig({
      PMS_AGENT_CWD: "/tmp/pms-agent-v2-runtime-test",
      PMS_PLATFORM_BASE_URL: "http://127.0.0.1:8791"
    });
    const executors = createRuntimeExecutors(config);

    await expect(dispatchPmsRead({
      capabilityId: "pms_read",
      actor: { profile: "customer" },
      tenantId: "tenant_1"
    }, executors.pmsReadExecutors!)).rejects.toThrow(
      "dispatchPmsRead received legacy pms_read capabilityId; use the coarse pmsRead executor instead"
    );
  });

  it("coarse pmsRead executor remains unchanged and still uses target-based routing", async () => {
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

      // target: "availability" routes to searchAvailability
      await executors.pmsRead?.({
        auditId: "audit_1",
        decision: { outcome: "allow", reasons: [], audit: { capabilityId: "pms_read" } },
        request: {
          capabilityId: "pms_read",
          actor: { profile: "customer" },
          tenantId: "tenant_1",
          target: "availability"
        }
      });

      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({ hotelId: "property-small-hotel" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function writeMinimalPiModels(agentDir: string): void {
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, "models.json"), JSON.stringify({
    providers: {
      openai: {
        baseUrl: "https://example.invalid/v1",
        api: "openai-completions",
        apiKey: "OPENAI_API_KEY",
        models: [
          {
            id: "gpt-5.5",
            name: "GPT-5.5 test model",
            reasoning: true,
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 32768,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
          }
        ]
      }
    }
  }), "utf8");
}
