import type { GatedToolExecutor } from "@pms-agent-v2/gated-tools";

export function notConfiguredExecutor<T = unknown>(name: string): GatedToolExecutor<T> {
  return () => {
    throw new Error(`Gated tool executor is not configured: ${name}`);
  };
}
