import { clarificationFromMissingSlot, parseIntentFrame } from "@pms-agent-v2/unified-agent";
import { assert } from "./eval-cases.helpers.js";

export async function focusedClarification(): Promise<void> {
  const parsed = parseIntentFrame({
    intent: "availability",
    confidence: 0.86,
    language: "zh",
    slots: [
      { name: "stay_date", status: "present", value: "明天" },
      { name: "room_type", status: "missing" }
    ],
    missingSlots: ["room_type"],
    ambiguities: [],
    requiresPmsEvidence: true
  });

  assert(parsed.ok, "intent frame must parse for clarification eval");
  const clarification = parsed.ok ? clarificationFromMissingSlot(parsed.frame) : undefined;
  assert(clarification === "请先提供要查询的房型。", "clarification must be focused on the missing slot");
}
