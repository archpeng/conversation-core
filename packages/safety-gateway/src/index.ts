export const workspaceName = "@pms-agent-v2/safety-gateway";

export function bootstrapStatus() {
  return { workspaceName, stage: "P0_BOOTSTRAP" as const };
}
