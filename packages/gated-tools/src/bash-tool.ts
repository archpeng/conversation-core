import { runGatedTool, type GatedToolExecutor, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "./run-gated-tool.js";

export type GatedBashInput<T> = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId?: string;
  workspace: NonNullable<GatedToolRequest["workspace"]>;
  command: string;
  executor: GatedToolExecutor<T>;
};

export function gatedBash<T>(input: GatedBashInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: {
      capabilityId: "sandbox_bash",
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: input.workspace,
      target: input.command
    },
    executor: input.executor
  });
}
