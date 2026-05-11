import { productError } from "@pms-agent-v2/product-contracts";
import { isAuthorized, unauthorizedResponse } from "./auth.js";
import type { AgentClient } from "./clients/agent-client.js";
import { createHttpAgentClient } from "./clients/agent-client.js";
import { createHttpPmsClient } from "./clients/pms-client.js";
import { handleActionCardExecutionRoute } from "./routes/action-card-routes.js";
import { handleMobileTurnRoute } from "./routes/mobile-turn-routes.js";
import { handleRoomObjectRoute } from "./routes/object-routes.js";
import { handleShiftSummaryRoute } from "./routes/review-routes.js";
import { handleTaskDetailRoute, handleTaskListRoute } from "./routes/task-routes.js";
import { createTaskLedger } from "./task-ledger.js";
import type { ProductGatewayConfig, ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext, TaskLedger } from "./types.js";

export type ProductGatewayService = {
  handle(request: ProductGatewayRequest): Promise<ProductGatewayResponse>;
};

export type ProductGatewayDeps = {
  agentClient?: AgentClient;
  pmsClient?: ProductGatewayPmsClient;
  tasks?: TaskLedger;
};

export function createProductGatewayService(config: ProductGatewayConfig, deps: ProductGatewayDeps = {}): ProductGatewayService {
  const context: ProductRouteContext = {
    config,
    tasks: deps.tasks ?? createTaskLedger()
  };
  const agentClient = deps.agentClient ?? createHttpAgentClient({ baseUrl: config.pmsAgentBaseUrl, authToken: config.pmsAgentAuthToken });
  const pmsClient = deps.pmsClient ?? createHttpPmsClient({ baseUrl: config.pmsPlatformBaseUrl, authToken: config.pmsPlatformAuthToken });

  return {
    async handle(request) {
      const method = request.method.toUpperCase();
      if (method === "GET" && request.path === "/health") return json(200, { ok: true, service: "pms-agent-v2-product-gateway" });
      if (!isAuthorized(config, request)) return unauthorizedResponse();
      if (method === "POST" && request.path === "/api/mobile/turn") return handleMobileTurnRoute(context, agentClient, request.body);
      const actionCardRoute = parseActionCardRoute(request.path);
      if (method === "POST" && actionCardRoute) {
        return handleActionCardExecutionRoute(context, pmsClient, request, actionCardRoute.taskId, actionCardRoute.cardId, actionCardRoute.actionId);
      }
      if (method === "GET" && request.path === "/api/tasks") return handleTaskListRoute(context, pmsClient, request);
      if (method === "GET" && request.path.startsWith("/api/tasks/")) return handleTaskDetailRoute(context, decodeSegment(request.path.slice("/api/tasks/".length)));
      if (method === "GET" && request.path.startsWith("/api/objects/rooms/")) return handleRoomObjectRoute(context, pmsClient, request, decodeSegment(request.path.slice("/api/objects/rooms/".length)));
      if (method === "GET" && request.path === "/api/review/shift-summary") return handleShiftSummaryRoute(context);
      return json(404, productError("unsupported", "Unsupported product gateway route."));
    }
  };
}

function parseActionCardRoute(path: string): { taskId: string; cardId: string; actionId: string } | undefined {
  const match = /^\/api\/tasks\/([^/]+)\/action-cards\/([^/]+)\/actions\/([^/]+)$/.exec(path);
  if (!match) return undefined;
  return {
    taskId: decodeSegment(match[1] ?? ""),
    cardId: decodeSegment(match[2] ?? ""),
    actionId: decodeSegment(match[3] ?? "")
  };
}

function decodeSegment(value: string): string {
  return decodeURIComponent(value.split("/")[0] ?? "");
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
