import { describe, expect, it } from "vitest";
import { clarificationFromMissingSlot, parseIntentFrame, type IntentFrame } from "../packages/unified-agent/src/index.js";

describe("C0 intent frame contract", () => {
  it("accepts a valid LLM-produced intent frame without treating it as PMS evidence", () => {
    const frame: IntentFrame = {
      intent: "availability",
      confidence: 0.82,
      language: "zh",
      slots: [
        { name: "stay_date", status: "present", value: "2026-05-06/2026-05-07" },
        { name: "room_type", status: "missing" }
      ],
      missingSlots: ["room_type"],
      ambiguities: [],
      requiresPmsEvidence: true
    };

    const result = parseIntentFrame(frame);

    expect(result).toEqual({ ok: true, frame });
    expect(result.ok && result.frame.requiresPmsEvidence).toBe(true);
    expect(JSON.stringify(result)).not.toContain("pms_ev_");
  });

  it("fails safe for malformed model output", () => {
    expect(parseIntentFrame("availability")).toEqual({ ok: false, reason: "intent_frame_object_required" });
    expect(parseIntentFrame({ intent: "availability", confidence: 2, language: "zh", slots: [], missingSlots: [], ambiguities: [], requiresPmsEvidence: true }))
      .toEqual({ ok: false, reason: "invalid_confidence" });
    expect(parseIntentFrame({ intent: "cancel_reservation", confidence: 0.7, language: "zh", slots: [], missingSlots: [], ambiguities: [], requiresPmsEvidence: true }))
      .toEqual({ ok: false, reason: "invalid_intent" });
    expect(parseIntentFrame({ intent: "availability", confidence: 0.7, language: "zh", slots: [{ name: "price_policy", status: "present" }], missingSlots: [], ambiguities: [], requiresPmsEvidence: true }))
      .toEqual({ ok: false, reason: "invalid_slot_name" });
    expect(parseIntentFrame({ intent: "availability", confidence: 0.7, language: "zh", slots: [{ name: "room_type", status: "present", value: "suite" }], missingSlots: ["room_type"], ambiguities: [], requiresPmsEvidence: true }))
      .toEqual({ ok: false, reason: "inconsistent_missing_slots" });
  });

  it("derives one focused clarification from structural missing slots", () => {
    const result = parseIntentFrame({
      intent: "availability",
      confidence: 0.74,
      language: "mixed",
      slots: [
        { name: "stay_date", status: "missing" },
        { name: "room_type", status: "present", value: "suite" }
      ],
      missingSlots: ["stay_date"],
      ambiguities: [],
      requiresPmsEvidence: true
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? clarificationFromMissingSlot(result.frame) : undefined).toBe("请先提供入住和离店日期。");
  });

  it("keeps the contract to interface validation instead of workflow intelligence", () => {
    const source = JSON.stringify(parseIntentFrame({
      intent: "unknown",
      confidence: 0.1,
      language: "unknown",
      slots: [],
      missingSlots: [],
      ambiguities: ["ambiguous user request"],
      requiresPmsEvidence: false
    }));

    expect(source).not.toContain("SafetyGateway");
    expect(source).not.toContain("gated_pms_read");
    expect(source).not.toContain("searchAvailability");
  });
});
