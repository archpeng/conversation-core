import type { FeishuActorRole } from "@pms-agent-v2/adapter-contracts";

export type UnifiedAgentProfileId = "customer_pms" | "admin_customization";

export type UnifiedAgentProfile = {
  id: UnifiedAgentProfileId;
  visibleToolNames: readonly string[];
};

const customerPmsProfile: UnifiedAgentProfile = {
  id: "customer_pms",
  visibleToolNames: ["gated_pms_read", "gated_pms_confirm"]
};

const adminCustomizationProfile: UnifiedAgentProfile = {
  id: "admin_customization",
  visibleToolNames: ["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]
};

export function loadAgentProfile(actorRole: FeishuActorRole): UnifiedAgentProfile {
  if (actorRole === "admin" || actorRole === "internal") return adminCustomizationProfile;
  return customerPmsProfile;
}
