export type IntentFrameIntent = "availability" | "prepare_confirm" | "natural_confirm" | "unknown";

export type IntentSlotName = "stay_date" | "room_type" | "pending_action";

export type IntentSlotState = {
  readonly name: IntentSlotName;
  readonly value?: string;
  readonly status: "present" | "missing" | "ambiguous";
};

export type IntentFrame = {
  readonly intent: IntentFrameIntent;
  readonly confidence: number;
  readonly language: "zh" | "en" | "mixed" | "unknown";
  readonly slots: readonly IntentSlotState[];
  readonly missingSlots: readonly IntentSlotName[];
  readonly ambiguities: readonly string[];
  readonly requiresPmsEvidence: boolean;
};

export type IntentFrameParseResult =
  | { readonly ok: true; readonly frame: IntentFrame }
  | { readonly ok: false; readonly reason: string };

const allowedIntents: readonly IntentFrameIntent[] = ["availability", "prepare_confirm", "natural_confirm", "unknown"];
const allowedSlots: readonly IntentSlotName[] = ["stay_date", "room_type", "pending_action"];
const allowedSlotStatuses: readonly IntentSlotState["status"][] = ["present", "missing", "ambiguous"];
const allowedLanguages: readonly IntentFrame["language"][] = ["zh", "en", "mixed", "unknown"];

const clarificationBySlot: Record<IntentSlotName, string> = {
  stay_date: "请先提供入住和离店日期。",
  room_type: "请先提供要查询的房型。",
  pending_action: "请先通过确认卡片生成待审批操作。"
};

// C0 contract note: this module validates an LLM-produced interface frame. It does not decide PMS facts,
// Safety Gateway policy, or a complete booking workflow; later slices may use the validated frame as substrate.
export function parseIntentFrame(value: unknown): IntentFrameParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "intent_frame_object_required" };
  const record = value as Record<string, unknown>;

  if (!isAllowed(record.intent, allowedIntents)) return { ok: false, reason: "invalid_intent" };
  if (typeof record.confidence !== "number" || !Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    return { ok: false, reason: "invalid_confidence" };
  }
  if (!isAllowed(record.language, allowedLanguages)) return { ok: false, reason: "invalid_language" };
  if (!Array.isArray(record.slots)) return { ok: false, reason: "invalid_slots" };
  if (!Array.isArray(record.missingSlots) || !record.missingSlots.every((slot) => isAllowed(slot, allowedSlots))) {
    return { ok: false, reason: "invalid_missing_slots" };
  }
  if (!Array.isArray(record.ambiguities) || !record.ambiguities.every((item) => typeof item === "string")) {
    return { ok: false, reason: "invalid_ambiguities" };
  }
  if (typeof record.requiresPmsEvidence !== "boolean") return { ok: false, reason: "invalid_requires_pms_evidence" };

  const slots = parseSlots(record.slots);
  if (!slots.ok) return slots;
  if (!missingSlotsMatchSlotState(record.missingSlots, slots.slots)) return { ok: false, reason: "inconsistent_missing_slots" };

  return {
    ok: true,
    frame: {
      intent: record.intent,
      confidence: record.confidence,
      language: record.language,
      slots: slots.slots,
      missingSlots: record.missingSlots,
      ambiguities: record.ambiguities,
      requiresPmsEvidence: record.requiresPmsEvidence
    }
  };
}

export function clarificationFromMissingSlot(frame: Pick<IntentFrame, "missingSlots">): string | undefined {
  const slot = frame.missingSlots[0];
  return slot ? clarificationBySlot[slot] : undefined;
}

function parseSlots(value: unknown[]): { readonly ok: true; readonly slots: readonly IntentSlotState[] } | { readonly ok: false; readonly reason: string } {
  const slots: IntentSlotState[] = [];
  for (const slot of value) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) return { ok: false, reason: "invalid_slot" };
    const record = slot as Record<string, unknown>;
    if (!isAllowed(record.name, allowedSlots)) return { ok: false, reason: "invalid_slot_name" };
    if (!isAllowed(record.status, allowedSlotStatuses)) return { ok: false, reason: "invalid_slot_status" };
    if (record.value !== undefined && typeof record.value !== "string") return { ok: false, reason: "invalid_slot_value" };
    slots.push({ name: record.name, status: record.status, ...(record.value === undefined ? {} : { value: record.value }) });
  }
  return { ok: true, slots };
}

function missingSlotsMatchSlotState(missingSlots: readonly IntentSlotName[], slots: readonly IntentSlotState[]): boolean {
  const slotMissingNames = slots.filter((slot) => slot.status === "missing").map((slot) => slot.name);
  if (new Set(missingSlots).size !== missingSlots.length) return false;
  if (slotMissingNames.length !== missingSlots.length) return false;
  return slotMissingNames.every((slot) => missingSlots.includes(slot));
}

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
