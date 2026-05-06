import { describe, expect, it } from "vitest";
import {
  continuityPrompt,
  createRedactedSessionState,
  mergeIntentFrameIntoSessionState,
  parseIntentFrame,
  sessionRequiresPmsEvidence,
  sessionSlotValue
} from "../packages/unified-agent/src/index.js";

describe("C2 structured session state", () => {
  it("carries non-factual intent slots and opaque refs for follow-up turns", () => {
    const state = createRedactedSessionState({ sessionId: "session_raw_secret", actorId: "ou_raw_feishu_user", profileId: "customer_pms" });
    const frame = parseIntentFrame({
      intent: "availability",
      confidence: 0.83,
      language: "zh",
      slots: [
        { name: "stay_date", status: "present", value: "2026-05-07/2026-05-08" },
        { name: "room_type", status: "present", value: "大床房" }
      ],
      missingSlots: [],
      ambiguities: [],
      requiresPmsEvidence: true
    });

    expect(frame.ok).toBe(true);
    if (frame.ok) mergeIntentFrameIntoSessionState(state, frame.frame);

    expect(state.currentIntent).toBe("availability");
    expect(sessionSlotValue(state, "stay_date")).toBe("2026-05-07/2026-05-08");
    expect(sessionSlotValue(state, "room_type")).toBe("大床房");
    expect(sessionRequiresPmsEvidence(state)).toBe(true);
    expect(continuityPrompt(state)).toContain("pmsFactAuthority=refs_only_require_fresh_or_cited_pms_evidence");
  });

  it("keeps forbidden raw text, identifiers, PMS payloads, prices, room counts, and order state out of durable state", () => {
    const state = createRedactedSessionState({ sessionId: "session_raw_secret", actorId: "ou_raw_feishu_user", profileId: "customer_pms" });
    const frame = parseIntentFrame({
      intent: "availability",
      confidence: 0.76,
      language: "zh",
      slots: [
        { name: "stay_date", status: "present", value: "明天" },
        { name: "room_type", status: "missing" }
      ],
      missingSlots: ["room_type"],
      ambiguities: [],
      requiresPmsEvidence: true
    });

    expect(frame.ok).toBe(true);
    if (frame.ok) mergeIntentFrameIntoSessionState(state, frame.frame);

    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("session_raw_secret");
    expect(serialized).not.toContain("ou_raw_feishu_user");
    expect(serialized).not.toContain("查一下明天 588 元的大床房还有 3 间吗");
    expect(serialized).not.toContain("priceCents");
    expect(serialized).not.toContain("availableCount");
    expect(serialized).not.toContain("reservationStatus");
    expect(serialized).not.toContain("pendingActionStatus");
    expect(state.missingSlots).toEqual(["room_type"]);
    expect(state.safetyFlags).toContain("pms_fact_requires_evidence");
  });

  it("filters PMS-fact-looking slot values instead of promoting them into session truth", () => {
    const state = createRedactedSessionState({ sessionId: "session_fact", actorId: "actor_fact", profileId: "customer_pms" });
    const frame = parseIntentFrame({
      intent: "availability",
      confidence: 0.7,
      language: "zh",
      slots: [
        { name: "room_type", status: "present", value: "大床房 588 元 3 间" },
        { name: "stay_date", status: "present", value: "2026-05-07/2026-05-08" }
      ],
      missingSlots: [],
      ambiguities: [],
      requiresPmsEvidence: true
    });

    expect(frame.ok).toBe(true);
    if (frame.ok) mergeIntentFrameIntoSessionState(state, frame.frame);

    expect(sessionSlotValue(state, "room_type")).toBeUndefined();
    expect(sessionSlotValue(state, "stay_date")).toBe("2026-05-07/2026-05-08");
    expect(JSON.stringify(state)).not.toContain("588");
    expect(JSON.stringify(state)).not.toContain("3 间");
  });

  it("marks natural-language confirmation as approval-boundary state, not mutation authority", () => {
    const state = createRedactedSessionState({ sessionId: "session_confirm", actorId: "actor_confirm", profileId: "customer_pms" });
    const frame = parseIntentFrame({
      intent: "natural_confirm",
      confidence: 0.91,
      language: "zh",
      slots: [{ name: "pending_action", status: "present", value: "pending_action_ref" }],
      missingSlots: [],
      ambiguities: [],
      requiresPmsEvidence: true
    });

    expect(frame.ok).toBe(true);
    if (frame.ok) mergeIntentFrameIntoSessionState(state, frame.frame);

    expect(state.safetyFlags).toContain("pending_action_requires_approval");
    expect(state.safetyFlags).toContain("natural_language_not_mutation_approval");
    expect(JSON.stringify(state)).not.toContain("mutated");
    expect(JSON.stringify(state)).not.toContain("confirmed");
  });
});
