import { AuthStorage, createAgentSession, ModelRegistry, SessionManager, type CreateAgentSessionOptions } from "@mariozechner/pi-coding-agent";
import { join } from "node:path";
import type { AgentSessionFactory, AgentSessionFactoryOptions, AgentSessionPort } from "@pms-agent-v2/unified-agent";
import type { AgentServiceRuntimeConfig } from "./runtime-config.js";
import { ensureRuntimePiDirs } from "./runtime-directories.js";

type RuntimeCreateSession = (options: CreateAgentSessionOptions) => Promise<{ session: AgentSessionPort }>;

export function createRuntimePiSessionFactory(
  config: AgentServiceRuntimeConfig,
  createSession: RuntimeCreateSession = createAgentSession
): AgentSessionFactory {
  if (config.piMode === "stub") {
    return async () => ({ session: { async prompt() {} } });
  }

  return async (options: AgentSessionFactoryOptions) => {
    ensureRuntimePiDirs(config);
    const authStorage = AuthStorage.create(join(config.piAgentDir, "auth.json"));
    const modelRegistry = ModelRegistry.create(authStorage, join(config.piAgentDir, "models.json"));
    const model = config.piModelProvider && config.piModelId ? modelRegistry.find(config.piModelProvider, config.piModelId) : undefined;
    if (config.piModelProvider && config.piModelId && !model) {
      throw new Error(`model_not_resolved: Pi ModelRegistry could not resolve ${config.piModelProvider}/${config.piModelId}`);
    }
    const result = await createSession({
      cwd: options.cwd ?? config.cwd,
      agentDir: config.piAgentDir,
      tools: [...options.tools],
      customTools: [...options.customTools],
      authStorage,
      modelRegistry,
      ...(options.resourceLoader ? { resourceLoader: options.resourceLoader } : {}),
      ...(model ? { model } : {}),
      sessionManager: runtimeSessionManager(config, options.sessionFile)
    });
    return { session: result.session };
  };
}

function runtimeSessionManager(config: AgentServiceRuntimeConfig, sessionFile?: string): ReturnType<typeof SessionManager.inMemory> {
  if (config.piSessionMode === "memory") return SessionManager.inMemory(config.cwd);
  if (sessionFile) return SessionManager.open(sessionFile, config.piSessionDir, config.cwd);
  return SessionManager.create(config.cwd, config.piSessionDir);
}
