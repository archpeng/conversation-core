import { mkdirSync } from "node:fs";
import type { AgentServiceRuntimeConfig } from "./runtime-config.js";

export function ensureRuntimePiDirs(config: AgentServiceRuntimeConfig): void {
  mkdirSync(config.piAgentDir, { recursive: true });
  if (config.piSessionMode === "persistent") mkdirSync(config.piSessionDir, { recursive: true });
}
