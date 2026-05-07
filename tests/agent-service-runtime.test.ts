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
