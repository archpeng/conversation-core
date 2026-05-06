import type { FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";

export type RedactedTurnRef = {
  messageRef: string;
  receivedAt: string;
};

export type RedactedSessionState = {
  sessionRef: string;
  actorRef: string;
  profileId: string;
  turnRefs: RedactedTurnRef[];
  evidenceRefs: string[];
  pendingActionRefs: string[];
};

export function createRedactedSessionState(input: { sessionId: string; actorId: string; profileId: string }): RedactedSessionState {
  return {
    sessionRef: redactedRef("session", input.sessionId),
    actorRef: redactedRef("actor", input.actorId),
    profileId: input.profileId,
    turnRefs: [],
    evidenceRefs: [],
    pendingActionRefs: []
  };
}

export function rememberTurn(state: RedactedSessionState, turn: FeishuTurnInput, refs: { evidenceRefs?: readonly string[]; pendingActionRefs?: readonly string[] } = {}): void {
  state.turnRefs.push({ messageRef: redactedRef("message", turn.messageId), receivedAt: turn.receivedAt });
  state.turnRefs = state.turnRefs.slice(-2);
  rememberRefs(state, refs);
}

export function rememberRefs(state: RedactedSessionState, refs: { evidenceRefs?: readonly string[]; pendingActionRefs?: readonly string[] } = {}): void {
  state.evidenceRefs = mergeRefs(state.evidenceRefs, refs.evidenceRefs);
  state.pendingActionRefs = mergeRefs(state.pendingActionRefs, refs.pendingActionRefs);
}

export function continuityPrompt(state: RedactedSessionState): string {
  return [
    `sessionRef=${state.sessionRef}`,
    `actorRef=${state.actorRef}`,
    `recentMessages=${state.turnRefs.map((turn) => turn.messageRef).join(",") || "none"}`,
    `evidenceRefs=${state.evidenceRefs.join(",") || "none"}`,
    `pendingActionRefs=${state.pendingActionRefs.join(",") || "none"}`
  ].join("\n");
}

function mergeRefs(existing: string[], incoming: readonly string[] | undefined): string[] {
  if (!incoming) return existing;
  return Array.from(new Set([...existing, ...incoming])).slice(-8);
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
