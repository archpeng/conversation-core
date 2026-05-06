export const workspaceName = "@pms-agent-v2/agent-service";

export function bootstrapStatus() {
  return { workspaceName, stage: "P0_BOOTSTRAP" as const };
}
