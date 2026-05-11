import { productError } from "@pms-agent-v2/product-contracts";
import type { ProductGatewayConfig, ProductGatewayRequest } from "./types.js";

export function isAuthorized(config: ProductGatewayConfig, request: ProductGatewayRequest): boolean {
  if (!config.productGatewayAuthToken) return true;
  return bearerToken(request.headers.authorization) === config.productGatewayAuthToken
    || request.headers["x-product-gateway-token"] === config.productGatewayAuthToken;
}

export function unauthorizedResponse() {
  return {
    status: 401,
    headers: { "content-type": "application/json" },
    body: productError("unauthorized", "Unauthorized product gateway request.")
  };
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}
