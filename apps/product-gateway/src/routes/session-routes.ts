import { randomUUID } from "node:crypto";
import type { MobileSessionBinding, ProductGatewayResponse, ProductRouteContext, SessionBindingRegistry } from "../types.js";

export function handleCurrentSessionRoute(context: ProductRouteContext): ProductGatewayResponse {
  const tenantId = context.config.defaultTenantId ?? "tenant_1";
  const propertyId = context.config.defaultPropertyId ?? "property_small_hotel";
  const session = getSessionBindings(context).issue({
    sessionId: `session_${randomUUID()}`,
    tenantId,
    propertyId,
    actor: {
      role: "staff",
      id: "mobile_staff_1",
      displayName: "Mobile Staff"
    },
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  });
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      ok: true,
      session
    }
  };
}

export function getSessionBindings(context: ProductRouteContext): SessionBindingRegistry {
  if (!context.sessions) context.sessions = createSessionBindingRegistry();
  return context.sessions;
}

function createSessionBindingRegistry(): SessionBindingRegistry {
  const bindings = new Map<string, MobileSessionBinding>();
  return {
    issue(binding) {
      bindings.set(binding.sessionId, binding);
      return binding;
    },
    get(sessionId) {
      const binding = bindings.get(sessionId);
      if (!binding) return undefined;
      if (Date.parse(binding.expiresAt) <= Date.now()) {
        bindings.delete(sessionId);
        return undefined;
      }
      return binding;
    }
  };
}
