import type { ProductGatewayConfig } from "./types.js";

export function loadProductGatewayConfig(env: NodeJS.ProcessEnv = process.env): ProductGatewayConfig {
  return {
    host: env.PRODUCT_GATEWAY_HOST?.trim() || "127.0.0.1",
    port: parsePort(env.PRODUCT_GATEWAY_PORT, 8793),
    maxInboundBodyBytes: parseBytes(env.PRODUCT_GATEWAY_MAX_BODY_BYTES, 1024 * 1024),
    productGatewayAuthToken: optionalEnv(env.PRODUCT_GATEWAY_AUTH_TOKEN),
    pmsAgentBaseUrl: env.PMS_AGENT_BASE_URL?.trim() || "http://127.0.0.1:8792",
    pmsAgentAuthToken: optionalEnv(env.PMS_AGENT_AUTH_TOKEN),
    pmsPlatformBaseUrl: env.PMS_PLATFORM_BASE_URL?.trim() || "http://127.0.0.1:8791",
    pmsPlatformAuthToken: optionalEnv(env.PMS_PLATFORM_AUTH_TOKEN),
    defaultTenantId: optionalEnv(env.PMS_AGENT_DEFAULT_TENANT_ID),
    defaultPropertyId: optionalEnv(env.PMS_AGENT_DEFAULT_PROPERTY_ID),
    safetyAuditLogPath: optionalEnv(env.PRODUCT_GATEWAY_SAFETY_AUDIT_LOG),
    corsOrigin: env.PRODUCT_GATEWAY_CORS_ORIGIN?.trim() || "http://127.0.0.1:8794"
  };
}

function optionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function parseBytes(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
