import { describe, expect, it } from "vitest";
import { createRuntimePiSessionFactory, loadAgentServiceRuntimeConfig } from "../apps/agent-service/src/runtime.js";
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
});
