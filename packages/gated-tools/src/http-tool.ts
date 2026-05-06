import { runGatedTool, type GatedToolExecutor, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "./run-gated-tool.js";

export type GatedHttpInput<T> = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId?: string;
  url: string;
  executor: GatedToolExecutor<T>;
};

export function gatedHttp<T>(input: GatedHttpInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: {
      capabilityId: "http_request",
      actor: input.actor,
      tenantId: input.tenantId,
      target: input.url
    },
    executor: input.executor
  });
}
