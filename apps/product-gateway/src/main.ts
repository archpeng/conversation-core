import { loadProductGatewayConfig } from "./config.js";
import { createProductGatewayService } from "./service.js";
import { startProductGatewayServer } from "./server.js";

export async function main(): Promise<void> {
  const config = loadProductGatewayConfig();
  const started = await startProductGatewayServer(config, createProductGatewayService(config));
  process.stdout.write(`${JSON.stringify({
    ok: true,
    service: "pms-agent-v2-product-gateway",
    url: started.url,
    auth: {
      configured: Boolean(config.productGatewayAuthToken),
      header: "Authorization: Bearer <PRODUCT_GATEWAY_AUTH_TOKEN>"
    },
    pmsAgentBaseUrl: config.pmsAgentBaseUrl,
    pmsPlatformBaseUrl: config.pmsPlatformBaseUrl
  })}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void started.close().finally(() => process.exit(0));
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
