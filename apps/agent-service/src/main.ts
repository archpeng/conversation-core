import { isMainModule, loadAgentServiceRuntimeConfig, startAgentHttpServer } from "./runtime.js";

export async function main(): Promise<void> {
  const config = loadAgentServiceRuntimeConfig();
  const started = await startAgentHttpServer(config);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    service: "pms-agent-v2-agent-service",
    url: started.url,
    auth: {
      header: "X-PMS-AGENT-TOKEN",
      configured: Boolean(config.inboundAuthToken)
    },
    pmsPlatformBaseUrl: config.pmsPlatformBaseUrl,
    proposalWorkspacePath: config.proposalWorkspacePath,
    safetyAuditLogPath: config.safetyAuditLogPath,
    piMode: config.piMode,
    piSessionMode: config.piSessionMode,
    logTurnEvents: config.logTurnEvents
  })}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void started.close().finally(() => process.exit(0));
    });
  }
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
