import { productError, validateMobileAgentTurnInput } from "@pms-agent-v2/product-contracts";
import type { AgentClient } from "../clients/agent-client.js";
import { taskFromAgentResult } from "../task-builders.js";
import type { ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleMobileTurnRoute(context: ProductRouteContext, agentClient: AgentClient, body: unknown): Promise<ProductGatewayResponse> {
  const input = validateMobileAgentTurnInput(body);
  if (!input.ok) {
    return json(400, productError("invalid_request", `Invalid mobile turn input: ${input.issues.join("; ")}`));
  }

  try {
    const result = await agentClient.runMobileTurn(input.value);
    const task = taskFromAgentResult(result);
    context.tasks.add(task);
    return json(200, { ok: true, task });
  } catch {
    return json(502, productError("backend_unavailable", "Agent service is unavailable or returned an invalid result."));
  }
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
