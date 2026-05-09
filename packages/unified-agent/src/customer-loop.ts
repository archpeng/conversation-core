import type { AgentResult, FeishuTurnInput, PmsApprovalCard } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { AvailabilitySearchResult, PmsEvidence, RoomAvailability } from "@pms-agent-v2/pms-platform-client";
import type { GatedToolDefinition } from "./pi-session.js";
import type { RedactedSessionState } from "./continuity.js";
import { sessionSlotValue } from "./continuity.js";

export type CustomerLoopResult = {
  result: AgentResult;
  evidenceRefs?: string[];
  pendingActionRefs?: string[];
};

type Intent = "availability" | "prepare_confirm" | "natural_confirm" | "none";

export async function runCustomerPmsLoop(input: {
  turn: FeishuTurnInput;
  tools: readonly GatedToolDefinition[];
  state: RedactedSessionState;
}): Promise<CustomerLoopResult | undefined> {
  const intent = detectIntent(input.turn.message.text, input.state);

  if (intent === "availability") return availabilityReply(input.turn, input.tools, input.state);
  if (intent === "prepare_confirm") return prepareConfirmReply(input.turn, input.tools);
  if (intent === "natural_confirm") return naturalConfirmReply(input.turn, input.state);
  return undefined;
}

function detectIntent(message: string, state: RedactedSessionState): Intent {
  const text = message.toLowerCase();
  if (/确认|confirm/.test(text)) return "natural_confirm";
  if (/预订|预定|reserve|book/.test(text)) return "prepare_confirm";
  if (/有房|空房|availability|available|room/.test(text)) return "availability";
  if (state.evidenceRefs.length > 0 && /继续|那|明天|tomorrow|follow/.test(text)) return "availability";
  return "none";
}

async function availabilityReply(turn: FeishuTurnInput, tools: readonly GatedToolDefinition[], state: RedactedSessionState): Promise<CustomerLoopResult> {
  if (!hasDateCue(turn.message.text) && !sessionSlotValue(state, "stay_date")) {
    return { result: { type: "refusal", reason: "invalid_request", message: "请先提供入住和离店日期。" } };
  }
  if (!hasRoomTypeCue(turn.message.text) && !sessionSlotValue(state, "room_type") && !hasFollowUpEvidenceCue(turn.message.text, state)) {
    return { result: { type: "refusal", reason: "invalid_request", message: "请先提供要查询的房型。" } };
  }

  const evidence = await runEvidenceTool<AvailabilitySearchResult>(tools, "pms_availability_search", {});
  if (!evidence.ok) return { result: evidence.result };
  if (evidence.value.source.system !== "pms-platform" || evidence.value.source.method !== "searchAvailability") {
    return { result: { type: "refusal", reason: "unsupported", message: "PMS availability evidence is missing." } };
  }

  return {
    result: {
      type: "text",
      text: summarizeAvailability(evidence.value),
      evidenceRefs: [evidence.value.evidenceRef]
    },
    evidenceRefs: [evidence.value.evidenceRef]
  };
}

async function prepareConfirmReply(turn: FeishuTurnInput, tools: readonly GatedToolDefinition[]): Promise<CustomerLoopResult> {
  void turn;
  void tools;
  return { result: { type: "refusal", reason: "unsupported", message: "PMS booking preparation requires the LLM to compose the safe PMS workflow tools. Please retry when the LLM is available." } };
}

function naturalConfirmReply(turn: FeishuTurnInput, state: RedactedSessionState): CustomerLoopResult {
  const pendingActionId = state.pendingActionRefs.at(-1);
  if (!pendingActionId) {
    return { result: { type: "refusal", reason: "invalid_request", message: "请先通过确认卡片生成待审批操作；自然语言确认不会执行 PMS 变更。" } };
  }
  return {
    result: { type: "approval_card", card: approvalCard(turn.tenantId, pendingActionId) },
    pendingActionRefs: [pendingActionId]
  };
}

async function runEvidenceTool<T>(tools: readonly GatedToolDefinition[], toolName: string, params: Record<string, unknown>): Promise<{ ok: true; value: PmsEvidence<T> } | { ok: false; result: AgentResult }> {
  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) return { ok: false, result: { type: "refusal", reason: "unsupported", message: "Required PMS tool is not available." } };

  try {
    const toolResult = await tool.executePlan(params);
    const details = toolResult.details as GatedToolResult<PmsEvidence<T>>;
    if (details.outcome === "deny") return { ok: false, result: { type: "refusal", reason: "policy", message: "PMS request was denied by policy." } };
    if (details.outcome === "require_approval") return { ok: false, result: { type: "refusal", reason: "policy", message: "PMS request requires typed approval." } };
    if (!isPmsEvidence(details.value)) return { ok: false, result: { type: "refusal", reason: "unsupported", message: "PMS evidence envelope is missing." } };
    return { ok: true, value: details.value };
  } catch {
    return { ok: false, result: { type: "refusal", reason: "unsupported", message: "PMS evidence is temporarily unavailable." } };
  }
}

function summarizeAvailability(evidence: PmsEvidence<AvailabilitySearchResult>): string {
  const rooms = evidence.data.rooms.filter((room) => room.available);
  if (rooms.length === 0) return `PMS 证据显示未查到可订房型。evidenceRefs=${evidence.evidenceRef}`;

  const candidates = rooms.map(roomSummary).join("；");
  return `PMS 证据显示有 ${rooms.length} 个可订候选：${candidates}。evidenceRefs=${evidence.evidenceRef}`;
}

function roomSummary(room: RoomAvailability): string {
  const price = typeof room.priceCents === "number" ? `PMS priceCents=${room.priceCents}` : "价格未由 PMS 证据返回";
  return `${room.roomType}（${price}）`;
}

function approvalCard(tenantId: string, pendingActionId: string, expiresAt?: string): PmsApprovalCard {
  return {
    type: "pms_pending_action_card",
    ref: {
      type: "pms_pending_action",
      tenantId,
      pendingActionId,
      action: "reservation_confirm",
      ...(expiresAt ? { expiresAt } : {})
    },
    title: "确认预订草稿",
    summary: "PMS 已准备预订草稿待审批操作；点击确认只会确认草稿 pending-action，不代表最终预订已创建。",
    confirmLabel: "确认",
    cancelLabel: "取消"
  };
}

function hasFollowUpEvidenceCue(message: string, state: RedactedSessionState): boolean {
  return state.evidenceRefs.length > 0 && /继续|那|明天|tomorrow|follow/i.test(message);
}

function hasDateCue(message: string): boolean {
  return /\d{4}-\d{2}-\d{2}|今天|明天|后天|today|tomorrow/.test(message);
}

function hasRoomTypeCue(message: string): boolean {
  return /房型|大床|双床|套房|king|twin|suite|room type/i.test(message);
}

function isPmsEvidence(value: unknown): value is PmsEvidence<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const evidence = value as Record<string, unknown>;
  const source = evidence.source as Record<string, unknown> | undefined;
  return typeof evidence.evidenceRef === "string"
    && source?.system === "pms-platform"
    && typeof source?.method === "string"
    && typeof evidence.summary === "string"
    && typeof evidence.fetchedAt === "string"
    && evidence.scope !== undefined
    && "data" in evidence;
}
