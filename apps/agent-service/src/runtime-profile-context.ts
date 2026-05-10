import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import { createPmsPlatformClient, type HotelProfileResult, type PmsEvidence, type RoomTypeCatalogResult } from "@pms-agent-v2/pms-platform-client";
import type { ResourceLoaderFactory } from "@pms-agent-v2/unified-agent";
import type { AgentServiceRuntimeConfig } from "./runtime-config.js";
import { ensureRuntimePiDirs } from "./runtime-directories.js";

export function createRuntimeResourceLoaderFactory(config: AgentServiceRuntimeConfig): ResourceLoaderFactory {
  return async (systemPrompt: string) => {
    ensureRuntimePiDirs(config);
    const profileFile = await pmsHotelProfileContextFile(config);
    const loader = new DefaultResourceLoader({
      cwd: config.cwd,
      agentDir: config.piAgentDir,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      systemPromptOverride: () => systemPrompt,
      agentsFilesOverride: (current) => ({
        agentsFiles: [
          ...current.agentsFiles,
          profileFile
        ]
      })
    });
    await loader.reload();
    return loader;
  };
}

async function pmsHotelProfileContextFile(config: AgentServiceRuntimeConfig): Promise<{ path: string; content: string }> {
  const client = createPmsPlatformClient({
    baseUrl: config.pmsPlatformBaseUrl,
    authToken: config.pmsPlatformAuthToken,
    fetch
  });
  try {
    const tenantId = "runtime-profile";
    const [profile, catalog] = await Promise.all([
      client.hotelProfile({ tenantId, propertyId: config.defaultPropertyId }),
      client.roomTypeCatalog({ tenantId, propertyId: config.defaultPropertyId })
    ]);
    return {
      path: "/virtual/PMS_HOTEL_PROFILE.md",
      content: formatPmsHotelProfileContext(profile, catalog)
    };
  } catch {
    return {
      path: "/virtual/PMS_HOTEL_PROFILE.md",
      content: [
        "# PMS_HOTEL_PROFILE",
        "",
        "PMS Platform profile snapshot is unavailable for this session.",
        "Do not answer availability, price, reservation, room status, order status, or pending-action status without calling the relevant PMS evidence tool.",
      ].join("\n")
    };
  }
}

function formatPmsHotelProfileContext(
  profile: PmsEvidence<HotelProfileResult>,
  catalog: PmsEvidence<RoomTypeCatalogResult>
): string {
  const roomTypes = catalog.data.roomTypes.map((roomType) =>
    `- ${roomType.displayName}: ${roomType.roomCount} rooms, id=${roomType.roomTypeId}, code=${roomType.code}, status=${roomType.status}`
  );
  return [
    "# PMS_HOTEL_PROFILE",
    "",
    "Source: PMS Platform safe-read snapshot injected as a virtual context file. This file is not written to the repository.",
    `Snapshot refs: ${profile.evidenceRef}, ${catalog.evidenceRef}`,
    "",
    "## Static Hotel Catalog",
    `- propertyId: ${profile.data.propertyId}`,
    `- hotelName: ${profile.data.propertyName}`,
    `- timeZone: ${profile.data.timeZone}`,
    `- status: ${profile.data.status}`,
    `- configuredRoomTotal: ${profile.data.roomTotal}`,
    "",
    "## Active Room Types",
    ...(roomTypes.length > 0 ? roomTypes : ["- none configured"]),
    "",
    "## Use",
    "Use this PMS-owned snapshot to understand the hotel's configured static catalog and to choose the right PMS tool.",
    "For booking workflows, unique partial room type wording can map to the configured room type, for example 洞穴 maps to 秘境洞穴 when it is the only matching active room type.",
    "For a final answer about hotel profile or room type catalog, prefer pms_hotel_profile or pms_room_type_catalog so the reply can include evidenceRefs.",
    "Availability, price, reservation, room status, order status, and pending-action status must always be answered from fresh PMS evidence tools.",
  ].join("\n");
}
