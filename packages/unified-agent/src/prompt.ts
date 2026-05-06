import type { UnifiedAgentProfile } from "./profile.js";

export function buildSystemPrompt(profile: UnifiedAgentProfile): string {
  const roleHint = profile.id === "customer_pms" ? "Help customer/staff PMS requests." : "Help admin/internal proposal work.";
  return [
    roleHint,
    "Use only the gated tools visible in this session.",
    "State PMS facts only when backed by PMS evidence refs.",
    "For high-risk changes, return approval/proposal output instead of mutating directly."
  ].join("\n");
}
