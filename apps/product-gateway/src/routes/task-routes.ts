import { productError } from "@pms-agent-v2/product-contracts";
import { todayReadTasks } from "../task-builders.js";
import type { ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleTaskListRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest): Promise<ProductGatewayResponse> {
  const scope = readScope(context, request);
  if (!scope.ok) return json(400, scope.error);

  try {
    const [arrivals, departures, inventory] = await Promise.all([
      pmsClient.todayArrivals({ tenantId: scope.tenantId, businessDate: scope.businessDate }),
      pmsClient.todayDepartures({ tenantId: scope.tenantId, businessDate: scope.businessDate }),
      pmsClient.inventorySummary({ tenantId: scope.tenantId, propertyId: scope.propertyId, startDate: scope.businessDate, endDate: scope.businessDate })
    ]);
    const tasks = todayReadTasks({ tenantId: scope.tenantId, propertyId: scope.propertyId, businessDate: scope.businessDate, arrivals, departures, inventory });
    for (const task of tasks) context.tasks.add(task);
    return json(200, { ok: true, tasks: context.tasks.list() });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform read model is unavailable."));
  }
}

export function handleTaskDetailRoute(context: ProductRouteContext, taskId: string): ProductGatewayResponse {
  const task = context.tasks.get(taskId);
  if (!task) return json(404, productError("unsupported", "Task was not found in the product gateway ledger."));
  return json(200, { ok: true, task });
}

function readScope(context: ProductRouteContext, request: ProductGatewayRequest) {
  const tenantId = request.query.get("tenantId") ?? context.config.defaultTenantId;
  const propertyId = request.query.get("propertyId") ?? context.config.defaultPropertyId;
  const businessDate = request.query.get("businessDate") ?? isoDate(new Date());
  if (!tenantId || !propertyId) {
    return { ok: false as const, error: productError("invalid_request", "tenantId and propertyId are required for read-only task feed.") };
  }
  return { ok: true as const, tenantId, propertyId, businessDate };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
