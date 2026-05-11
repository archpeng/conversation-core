import type { ProductGatewayResponse, ProductRouteContext } from "../types.js";

export function handleCurrentSessionRoute(context: ProductRouteContext): ProductGatewayResponse {
  const tenantId = context.config.defaultTenantId ?? "tenant_1";
  const propertyId = context.config.defaultPropertyId ?? "property_small_hotel";
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      ok: true,
      session: {
        sessionId: `session_${tenantId}_${propertyId}`,
        tenantId,
        propertyId,
        actor: {
          role: "staff",
          id: "mobile_staff_1",
          displayName: "Mobile Staff"
        }
      }
    }
  };
}
