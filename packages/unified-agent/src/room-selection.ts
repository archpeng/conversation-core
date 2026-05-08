import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolRequest } from "@pms-agent-v2/gated-tools";
import type { AvailabilitySearchResult, PmsEvidence, RoomAvailability } from "@pms-agent-v2/pms-platform-client";
import type { ContextBundle } from "./context-bundle.js";
import type { PiAgentSession } from "./pi-session.js";
import { promptAssistantText } from "./pi-io.js";
import { synthesizeTextReply } from "./response-synthesis.js";

type PlannedAgentResult = {
  result: AgentResult;
  evidenceRefs?: string[];
  pendingActionRefs?: string[];
};

export type RoomCandidateSelection =
  | { ok: true; candidates: RoomAvailability[] }
  | { ok: false; planned: PlannedAgentResult };

type RoomTypeResolution =
  | { ok: true; roomIds: string[]; roomType?: string }
  | { ok: false; message?: string };

export async function selectRoomCandidates(
  piSession: PiAgentSession,
  turn: FeishuTurnInput,
  evidence: PmsEvidence<AvailabilitySearchResult>,
  workflowParams: Record<string, unknown>,
  roomTypeText: string | undefined,
  context: ContextBundle
): Promise<RoomCandidateSelection> {
  const requestedQuantity = requestedWorkflowQuantity(workflowParams);
  const availableRooms = evidence.data.rooms.filter((room) => room.available === true && typeof room.roomId === "string" && room.roomId.trim().length > 0);
  if (availableRooms.length === 0) return { ok: false, planned: noAvailableRoomsReply(evidence, context) };
  if (!roomTypeText) {
    if (availableRooms.length < requestedQuantity) return { ok: false, planned: insufficientCandidateReply(evidence, availableRooms.length, requestedQuantity, undefined, context) };
    return { ok: true, candidates: availableRooms.slice(0, requestedQuantity) };
  }

  const resolution = await resolveRoomTypeFromEvidence(piSession, turn, evidence, availableRooms, requestedQuantity, roomTypeText);
  if (!resolution.ok) return { ok: false, planned: roomTypeClarificationReply(evidence, availableRooms, resolution.message, context) };
  const selected = validatedResolvedRooms(availableRooms, resolution.roomIds, resolution.roomType);
  if (!selected) return { ok: false, planned: roomTypeClarificationReply(evidence, availableRooms, undefined, context) };
  if (selected.length < requestedQuantity) return { ok: false, planned: insufficientCandidateReply(evidence, selected.length, requestedQuantity, resolution.roomType, context) };
  return { ok: true, candidates: selected.slice(0, requestedQuantity) };
}

export function requestedWorkflowQuantity(workflowParams: Record<string, unknown>): number {
  return typeof workflowParams.quantity === "number" && Number.isInteger(workflowParams.quantity) && workflowParams.quantity > 0 ? workflowParams.quantity : 1;
}

export function roomSelection(room: RoomAvailability, evidenceRef: string): NonNullable<GatedToolRequest["selections"]>[number] {
  return {
    roomId: room.roomId,
    selectedCandidateRef: `${evidenceRef}:${room.roomId}`,
    roomType: room.roomType
  };
}

export function requestedRoomTypeText(readParams: Record<string, unknown>, workflowParams: Record<string, unknown>): string | undefined {
  return nonEmptyText(workflowParams.roomTypeText) ?? nonEmptyText(workflowParams.roomType) ?? nonEmptyText(readParams.roomType);
}

export function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function omitParam(params: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...params };
  delete copy[key];
  return copy;
}

function roomTypeResolutionPrompt(turn: FeishuTurnInput, evidence: PmsEvidence<AvailabilitySearchResult>, availableRooms: readonly RoomAvailability[], requestedQuantity: number, roomTypeText: string): string {
  return [
    "Resolve a spoken room type preference using only PMS availability evidence candidates.",
    "Return exactly one JSON object and no markdown.",
    "Allowed successful shape: {\"ok\":true,\"roomType\":\"exact candidate roomType\",\"roomIds\":[\"room id from candidates\"]}.",
    "Allowed clarification shape: {\"ok\":false,\"message\":\"short clarification in the user's language; do not mention raw room IDs\"}.",
    "Choose roomIds only from candidates below. If the wording is ambiguous, no match, or not enough rooms are available, return ok=false with a clarification question.",
    `requestedRoomTypeText=${roomTypeText}`,
    `requestedQuantity=${requestedQuantity}`,
    `evidenceRefs=${evidence.evidenceRef}`,
    "Available candidates:",
    JSON.stringify(availableRooms.map((room) => ({ roomId: room.roomId, roomType: room.roomType, available: room.available })), null, 2),
    "User message:",
    turn.message.text
  ].join("\n");
}

async function resolveRoomTypeFromEvidence(
  piSession: PiAgentSession,
  turn: FeishuTurnInput,
  evidence: PmsEvidence<AvailabilitySearchResult>,
  availableRooms: readonly RoomAvailability[],
  requestedQuantity: number,
  roomTypeText: string
): Promise<RoomTypeResolution> {
  const reply = await promptAssistantText(piSession, roomTypeResolutionPrompt(turn, evidence, availableRooms, requestedQuantity, roomTypeText));
  const parsed = parseRoomTypeResolution(reply);
  return parsed ?? { ok: false };
}

function parseRoomTypeResolution(text: string): RoomTypeResolution | undefined {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    const value = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    if (value.ok === true && Array.isArray(value.roomIds)) {
      const roomIds = value.roomIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (roomIds.length === 0) return undefined;
      return {
        ok: true,
        roomIds,
        ...(typeof value.roomType === "string" && value.roomType.trim().length > 0 ? { roomType: value.roomType } : {})
      };
    }
    if (value.ok === false) {
      return { ok: false, ...(typeof value.message === "string" && value.message.trim().length > 0 ? { message: value.message } : {}) };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function validatedResolvedRooms(availableRooms: readonly RoomAvailability[], roomIds: readonly string[], roomType: string | undefined): RoomAvailability[] | undefined {
  const byId = new Map(availableRooms.map((room) => [room.roomId, room]));
  const selected = roomIds.map((roomId) => byId.get(roomId)).filter((room): room is RoomAvailability => Boolean(room));
  if (selected.length !== roomIds.length) return undefined;
  if (roomType && selected.some((room) => room.roomType !== roomType)) return undefined;
  const uniqueIds = new Set(selected.map((room) => room.roomId));
  return selected.filter((room, index) => selected.findIndex((candidate) => candidate.roomId === room.roomId) === index && uniqueIds.has(room.roomId));
}

function noAvailableRoomsReply(evidence: PmsEvidence<AvailabilitySearchResult>, context: ContextBundle): PlannedAgentResult {
  const result = synthesizeTextReply({
    text: `PMS 证据显示该入住区间没有可订房间，无法准备预订审批卡。请调整日期或房型后再试。evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function insufficientCandidateReply(evidence: PmsEvidence<AvailabilitySearchResult>, availableCount: number, requestedQuantity: number, roomType: string | undefined, context: ContextBundle): PlannedAgentResult {
  const roomTypeText = roomType ? `“${roomType}”` : "匹配条件";
  const result = synthesizeTextReply({
    text: `PMS 证据显示${roomTypeText}当前可订 ${availableCount} 间，不足 ${requestedQuantity} 间，无法准备预订审批卡。是否调整间数或更换房型？evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function roomTypeClarificationReply(evidence: PmsEvidence<AvailabilitySearchResult>, availableRooms: readonly RoomAvailability[], message: string | undefined, context: ContextBundle): PlannedAgentResult {
  const safeMessage = message ? redactRoomIds(message, availableRooms).trim() : "";
  const options = roomTypeOptions(availableRooms).join("、");
  const text = safeMessage || `我查到该日期有这些可订房型：${options}。请确认你想订哪一种。`;
  const result = synthesizeTextReply({
    text: `${text} evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function roomTypeOptions(availableRooms: readonly RoomAvailability[]): string[] {
  const counts = new Map<string, number>();
  for (const room of availableRooms) {
    counts.set(room.roomType, (counts.get(room.roomType) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([roomType, count]) => `${roomType}（${count} 间）`);
}

function redactRoomIds(text: string, rooms: readonly RoomAvailability[]): string {
  return rooms.reduce((current, room) => current.split(room.roomId).join("[房间ID已隐藏]"), text);
}
