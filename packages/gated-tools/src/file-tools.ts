import { runGatedTool, type GatedToolExecutor, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "./run-gated-tool.js";

type FileAction = "read" | "write" | "edit";
type WorkspaceKind = "proposal" | "sandbox";

export type GatedFileInput<T> = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId?: string;
  workspace: { kind: WorkspaceKind; path?: string };
  path: string;
  content?: string;
  executor: GatedToolExecutor<T>;
};

export function gatedRead<T>(input: GatedFileInput<T>): Promise<GatedToolResult<T>> {
  return runFileTool(input, "read");
}

export function gatedWrite<T>(input: GatedFileInput<T>): Promise<GatedToolResult<T>> {
  return runFileTool(input, "write");
}

export function gatedEdit<T>(input: GatedFileInput<T>): Promise<GatedToolResult<T>> {
  return runFileTool(input, "edit");
}

function runFileTool<T>(input: GatedFileInput<T>, action: FileAction): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: {
      capabilityId: fileCapability(input.workspace.kind, action),
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: input.workspace,
      target: input.path,
      content: input.content
    },
    executor: input.executor
  });
}

function fileCapability(workspaceKind: WorkspaceKind, action: FileAction): string {
  if (workspaceKind === "proposal") return `proposal_${action}`;
  return `sandbox_${action}`;
}
