export const workspaceName = "@pms-agent-v2/unified-agent";

export function bootstrapStatus() {
  return { workspaceName, stage: "P0_BOOTSTRAP" as const };
}
