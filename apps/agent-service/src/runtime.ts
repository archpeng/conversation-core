import { createAgentService, type AgentService } from "./index.js";
import { createRuntimeExecutors, type RuntimeExecutorConfig } from "./executors.js";
import { createRuntimePiSessionFactory } from "./runtime-pi-session.js";
import { createRuntimeResourceLoaderFactory } from "./runtime-profile-context.js";
import { createRuntimeSafetyGateway } from "./runtime-safety-gateway.js";
import { startAgentHttpServer as startRuntimeHttpServer } from "./runtime-server.js";
import type { AgentServiceRuntimeConfig } from "./runtime-config.js";
import { createSafetyAuditJsonlFileWriter } from "@pms-agent-v2/safety-gateway";

export { loadAgentServiceRuntimeConfig, isMainModule, type AgentServiceRuntimeConfig } from "./runtime-config.js";
export { createRuntimePiSessionFactory } from "./runtime-pi-session.js";
export { createRuntimeResourceLoaderFactory } from "./runtime-profile-context.js";
export { createRuntimeSafetyGateway } from "./runtime-safety-gateway.js";
export { type StartedAgentHttpServer } from "./runtime-server.js";
export { createRuntimeExecutors, type RuntimeExecutorConfig };

export function createRuntimeAgentService(config: AgentServiceRuntimeConfig): AgentService {
  return createAgentService({
    gateway: createRuntimeSafetyGateway({ auditSink: createSafetyAuditJsonlFileWriter(config.safetyAuditLogPath) }),
    createAgentSession: createRuntimePiSessionFactory(config),
    createResourceLoader: createRuntimeResourceLoaderFactory(config),
    cwd: config.cwd,
    piSessionDir: config.piSessionDir,
    executors: createRuntimeExecutors(config),
    eventSink: config.logTurnEvents ? (event) => console.log(JSON.stringify(event)) : undefined
  });
}

export function startAgentHttpServer(config: AgentServiceRuntimeConfig, service = createRuntimeAgentService(config)) {
  return startRuntimeHttpServer(config, service);
}
