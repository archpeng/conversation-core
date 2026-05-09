import type { FeishuActorRole } from "@pms-agent-v2/adapter-contracts";
import { PMS_SAFE_READ_TOOLS } from "./pms-capability-tools.js";
import { PMS_SAFE_WORKFLOW_TOOLS } from "./pms-workflow-tools.js";

export type UnifiedAgentProfileId = "customer_pms" | "admin_customization";

export type UnifiedAgentProfile = {
  id: UnifiedAgentProfileId;
  visibleToolNames: readonly string[];
};

const customerPmsProfile: UnifiedAgentProfile = {
  id: "customer_pms",
  visibleToolNames: [...PMS_SAFE_READ_TOOLS, ...PMS_SAFE_WORKFLOW_TOOLS]
};

const adminCustomizationProfile: UnifiedAgentProfile = {
  id: "admin_customization",
  visibleToolNames: ["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]
};

export function loadAgentProfile(actorRole: FeishuActorRole): UnifiedAgentProfile {
  if (actorRole === "admin" || actorRole === "internal") return adminCustomizationProfile;
  return customerPmsProfile;
}
