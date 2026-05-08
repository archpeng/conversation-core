import type { FeishuActorRole } from "@pms-agent-v2/adapter-contracts";

export type UnifiedAgentProfileId = "customer_pms" | "admin_customization";

export type UnifiedAgentProfile = {
  id: UnifiedAgentProfileId;
  visibleToolNames: readonly string[];
  useGeneratedTools?: boolean;
};

const customerPmsProfile: UnifiedAgentProfile = {
  id: "customer_pms",
  visibleToolNames: [
    "gated_pms_read", "gated_pms_workflow", "gated_pms_confirm",
    "pms_availability_search", "pms_inventory_summary", "pms_room_reservation_context",
    "pms_reservation_lookup", "pms_get_room", "pms_today_arrivals", "pms_today_departures"
  ]
};

const adminCustomizationProfile: UnifiedAgentProfile = {
  id: "admin_customization",
  visibleToolNames: ["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]
};

export function loadAgentProfile(actorRole: FeishuActorRole): UnifiedAgentProfile {
  if (actorRole === "admin" || actorRole === "internal") return adminCustomizationProfile;
  return customerPmsProfile;
}
