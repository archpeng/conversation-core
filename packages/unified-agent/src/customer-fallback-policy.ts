import type { RedactedSessionState } from "./continuity.js";

export type CustomerFallbackIntent = "availability" | "room_type_catalog" | "prepare_confirm" | "natural_confirm" | "none";

// Degraded-only lexical cues. The live customer path remains LLM-first; this policy is used only when the LLM is unavailable.
export function detectCustomerFallbackIntent(message: string, state: RedactedSessionState): CustomerFallbackIntent {
  const text = message.toLowerCase();
  if (/确认|confirm/.test(text)) return "natural_confirm";
  if (/预订|预定|reserve|book/.test(text)) return "prepare_confirm";
  if (hasRoomTypeCatalogCue(message) && !hasDateCue(message)) return "room_type_catalog";
  if (/有房|空房|availability|available|room/.test(text)) return "availability";
  if (hasFollowUpEvidenceCue(message, state)) return "availability";
  return "none";
}

export function hasFollowUpEvidenceCue(message: string, state: RedactedSessionState): boolean {
  return state.evidenceRefs.length > 0 && /继续|那|明天|tomorrow|follow/i.test(message);
}

export function hasDateCue(message: string): boolean {
  return /\d{4}-\d{2}-\d{2}|今天|明天|后天|today|tomorrow/.test(message);
}

export function hasRoomTypeCue(message: string): boolean {
  return /房型|大床|双床|套房|king|twin|suite|room type/i.test(message);
}

function hasRoomTypeCatalogCue(message: string): boolean {
  return /有哪些房型|有什么房型|房型.*(有哪些|有什么|列表|目录)|room types?/i.test(message);
}
