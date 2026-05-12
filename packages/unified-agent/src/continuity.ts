import type { AgentObjectRef, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { IntentFrame, IntentFrameIntent, IntentSlotName } from "./intent-frame.js";

export type RedactedTurnRef = {
  messageRef: string;
  receivedAt: string;
};

export type SessionSlotMemory = {
  name: IntentSlotName;
  value: string;
  source: "intent_frame";
};

export type SessionSafetyFlag =
  | "memory_not_pms_fact_authority"
  | "pms_fact_requires_evidence"
  | "pending_action_requires_approval"
  | "natural_language_not_mutation_approval";

export type RedactedSessionState = {
  sessionRef: string;
  actorRef: string;
  profileId: string;
  turnRefs: RedactedTurnRef[];
  currentIntent?: IntentFrameIntent;
  slots: SessionSlotMemory[];
  missingSlots: IntentSlotName[];
  evidenceRefs: string[];
  objectRefs: AgentObjectRef[];
  pendingActionRefs: string[];
  draftRefs: string[];
  cardRefs: string[];
  safetyFlags: SessionSafetyFlag[];
};

export function createRedactedSessionState(input: { sessionId: string; actorId: string; profileId: string }): RedactedSessionState {
  return {
    sessionRef: redactedRef("session", input.sessionId),
    actorRef: redactedRef("actor", input.actorId),
    profileId: input.profileId,
    turnRefs: [],
    slots: [],
    missingSlots: [],
    evidenceRefs: [],
    objectRefs: [],
    pendingActionRefs: [],
    draftRefs: [],
    cardRefs: [],
    safetyFlags: ["memory_not_pms_fact_authority"]
  };
}

export function rememberTurn(state: RedactedSessionState, turn: FeishuTurnInput, refs: { evidenceRefs?: readonly string[]; objectRefs?: readonly AgentObjectRef[]; pendingActionRefs?: readonly string[]; draftRefs?: readonly string[]; cardRefs?: readonly string[] } = {}): void {
  state.turnRefs.push({ messageRef: redactedRef("message", turn.messageId), receivedAt: turn.receivedAt });
  state.turnRefs = state.turnRefs.slice(-2);
  rememberRefs(state, refs);
}

export function rememberRefs(state: RedactedSessionState, refs: { evidenceRefs?: readonly string[]; objectRefs?: readonly AgentObjectRef[]; pendingActionRefs?: readonly string[]; draftRefs?: readonly string[]; cardRefs?: readonly string[] } = {}): void {
  state.evidenceRefs = mergeRefs(state.evidenceRefs, refs.evidenceRefs);
  state.objectRefs = mergeObjectRefs(state.objectRefs, refs.objectRefs);
  state.pendingActionRefs = mergeRefs(state.pendingActionRefs, refs.pendingActionRefs);
  state.draftRefs = mergeRefs(state.draftRefs, refs.draftRefs);
  state.cardRefs = mergeRefs(state.cardRefs, refs.cardRefs);
}

// C2 contract note: session continuity stores normalized intent/slot/opaque-ref hints only.
// It is not PMS fact authority; current availability, price, room state, order state, and pending action status still require PMS evidence.
export function mergeIntentFrameIntoSessionState(state: RedactedSessionState, frame: IntentFrame): void {
  state.currentIntent = frame.intent;
  state.missingSlots = [...frame.missingSlots];
  for (const slot of frame.slots) {
    const value = safeSessionSlotValue(slot.value);
    if (slot.status !== "present" || !value) continue;
    state.slots = upsertSlot(state.slots, { name: slot.name, value, source: "intent_frame" });
  }
  if (frame.requiresPmsEvidence) addSafetyFlag(state, "pms_fact_requires_evidence");
  if (frame.intent === "natural_confirm" || frame.intent === "prepare_confirm") addSafetyFlag(state, "pending_action_requires_approval");
  if (frame.intent === "natural_confirm") addSafetyFlag(state, "natural_language_not_mutation_approval");
}

export function sessionSlotValue(state: RedactedSessionState, name: IntentSlotName): string | undefined {
  return state.slots.find((slot) => slot.name === name)?.value;
}

export function sessionRequiresPmsEvidence(state: RedactedSessionState): boolean {
  return state.safetyFlags.includes("pms_fact_requires_evidence") || state.currentIntent === "availability" || state.currentIntent === "prepare_confirm";
}

export function continuityPrompt(state: RedactedSessionState): string {
  return [
    `sessionRef=${state.sessionRef}`,
    `actorRef=${state.actorRef}`,
    `recentMessages=${state.turnRefs.map((turn) => turn.messageRef).join(",") || "none"}`,
    `currentIntent=${state.currentIntent ?? "unknown"}`,
    `slotMemory=${state.slots.map((slot) => `${slot.name}:${slot.value}`).join(",") || "none"}`,
    `missingSlots=${state.missingSlots.join(",") || "none"}`,
    `evidenceRefs=${state.evidenceRefs.join(",") || "none"}`,
    `recentObjectRefs=${state.objectRefs.map(objectRefPrompt).join(",") || "none"}`,
    `pendingActionRefs=${state.pendingActionRefs.join(",") || "none"}`,
    `draftRefs=${state.draftRefs.join(",") || "none"}`,
    `cardRefs=${state.cardRefs.join(",") || "none"}`,
    `pmsFactAuthority=refs_only_require_fresh_or_cited_pms_evidence`,
    `safetyFlags=${state.safetyFlags.join(",") || "none"}`
  ].join("\n");
}

function mergeRefs(existing: string[], incoming: readonly string[] | undefined): string[] {
  if (!incoming) return existing;
  return Array.from(new Set([...existing, ...incoming])).slice(-8);
}

function mergeObjectRefs(existing: AgentObjectRef[], incoming: readonly AgentObjectRef[] | undefined): AgentObjectRef[] {
  if (!incoming) return existing;
  const byKey = new Map(existing.map((ref) => [`${ref.kind}:${ref.id}`, ref]));
  for (const ref of incoming) {
    const key = `${ref.kind}:${ref.id}`;
    const current = byKey.get(key);
    byKey.set(key, {
      ...ref,
      ...(current?.label && !ref.label ? { label: current.label } : {}),
      evidenceRefs: mergeRefs(current?.evidenceRefs ?? [], ref.evidenceRefs)
    });
  }
  return Array.from(byKey.values()).slice(-8);
}

function objectRefPrompt(ref: AgentObjectRef): string {
  const label = ref.label ? `:${safeObjectLabel(ref.label)}` : "";
  const evidence = ref.evidenceRefs?.length ? `:evidence=${ref.evidenceRefs.length}` : "";
  return `${ref.kind}:${ref.id}${label}${evidence}`;
}

function safeObjectLabel(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/pms_ev_[A-Za-z0-9_:-]+/g, "pms_ev_redacted").slice(0, 64);
}

function safeSessionSlotValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/pms_ev_|priceCents|availableCount|reservationStatus|pendingActionStatus|roomState|orderStatus/i.test(trimmed)) return undefined;
  if (/[¥￥$]\s*\d|\d+\s*元|\d+\s*(间|rooms?)\b/i.test(trimmed)) return undefined;
  if (/\b(open_id|union_id|tenant_access_token)\b|^ou_/i.test(trimmed)) return undefined;
  return trimmed;
}

function upsertSlot(slots: SessionSlotMemory[], next: SessionSlotMemory): SessionSlotMemory[] {
  return [...slots.filter((slot) => slot.name !== next.name), next].slice(-8);
}

function addSafetyFlag(state: RedactedSessionState, flag: SessionSafetyFlag): void {
  if (!state.safetyFlags.includes(flag)) state.safetyFlags.push(flag);
}

function redactedRef(prefix: string, value: string): string {
  return `${prefix}_${fnv1a(value)}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
