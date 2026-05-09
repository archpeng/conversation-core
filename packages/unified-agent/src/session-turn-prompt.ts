import type { FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle, contextBundlePrompt } from "./context-bundle.js";
import { continuityPrompt } from "./continuity.js";
import type { RunAgentTurnOptions, UnifiedAgentSession } from "./session-types.js";

export function evidenceReplyPrompt(turn: FeishuTurnInput, evidence: PmsEvidence<unknown>): string {
  return [
    "Final response synthesis after a gated PMS tool call.",
    "Reply naturally in the user's language, using only the PMS evidence summary below for current PMS facts.",
    "Include the exact evidenceRefs value in the final answer.",
    "If the user also requested a booking or other high-risk PMS change, explain that natural language cannot complete the mutation; ask only for the smallest missing confirmation or say an approval card/workflow is required.",
    "Do not invent room IDs, prices, pending action IDs, or completed mutation claims.",
    `PMS evidence method=${evidence.source.method}`,
    `PMS evidence summary=${evidence.summary}`,
    `evidenceRefs=${evidence.evidenceRef}`,
    "User message:",
    turn.message.text
  ].join("\n");
}

export function fallbackNaturalReply(turn: FeishuTurnInput): string {
  if (/^\s*(你好|您好|hello|hi|hey)\s*[！!。.]?\s*$/i.test(turn.message.text)) {
    return "你好，我是 PMS 智能助手。可以帮你查询房态、整理预订信息，或生成需要审批的预订确认卡片；如果要查房，请告诉我入住/离店日期和房型。";
  }
  return "我在。可以帮你查询 PMS 房态、整理预订信息，或生成需要审批的操作卡片。涉及实时房态、价格或订单状态时，我会以 PMS 平台证据为准。";
}

export function evidenceRepairPrompt(session: UnifiedAgentSession, turn: FeishuTurnInput, rejectedText: string, options: RunAgentTurnOptions): string {
  return [
    "Evidence repair turn.",
    "Your previous draft attempted to answer current PMS facts without current PMS evidence accepted by the runtime.",
    "Do not answer current availability, inventory, room type, reservation, price, or pending-action facts from continuity alone.",
    "Call the visible PMS custom tool(s) needed for the user's latest question, then answer using only returned PMS evidence.",
    "If the user asks what room types the hotel has without dates, call pms_room_type_catalog. If the user asks what is bookable for a date range, call pms_availability_search.",
    "Visible Pi custom tools:",
    JSON.stringify(visibleToolPromptItems(session), null, 2),
    "Continuity refs:",
    continuityPrompt(session.state),
    contextBundlePrompt(buildContextBundle({
      state: session.state,
      userMessage: turn.message.text,
      workspaceAdvisory: options.workspaceAdvisory,
      pmsEvidence: options.pmsEvidence,
      modelPriorSummary: options.modelPriorSummary
    })),
    "Rejected draft:",
    rejectedText,
    "User message:",
    turn.message.text
  ].join("\n");
}

export function turnPrompt(session: UnifiedAgentSession, turn: FeishuTurnInput, options: RunAgentTurnOptions): string {
  return [
    ...(session.systemPromptInjected ? [] : [session.systemPrompt]),
    "Continuity refs:",
    continuityPrompt(session.state),
    contextBundlePrompt(buildContextBundle({
      state: session.state,
      userMessage: turn.message.text,
      workspaceAdvisory: options.workspaceAdvisory,
      pmsEvidence: options.pmsEvidence,
      modelPriorSummary: options.modelPriorSummary
    })),
    "Visible Pi custom tools:",
    JSON.stringify(visibleToolPromptItems(session), null, 2),
    "Use the visible Pi custom tools directly when current PMS facts or PMS workflow evidence are needed.",
    "You may call multiple PMS tools in sequence when the answer depends on more than one fact. Example: if pms_availability_search returns 12 candidates and the user asks why there are 13 rooms total, call pms_inventory_summary before answering.",
    "Tool semantics: pms_availability_search returns room candidates available for every night in the requested stay. It is not total hotel inventory.",
    "For room-type catalog questions such as 有哪些房型 or 有什么房型 without dates, call pms_room_type_catalog. For 可订房型, 可选房型, or 可用房型 tied to dates or booking context, call pms_availability_search.",
    "For multi-room booking requests with guest, dates, room type, and quantity known, call pms_reservation_group_prepare_booking to prepare the approval card instead of manually chaining group draft tools.",
    "Safe workflow tools are draft, quote, and prepare-confirm only. Final PMS confirm/cancel is never available as a natural-language tool and must happen only through an approval card/gateway.",
    "Do not call or name raw tools such as bash, read, write, edit, http, or http_request.",
    "If required slots are missing, ask one focused clarification question in natural language.",
    "User message:",
    turn.message.text
  ].join("\n");
}

function visibleToolPromptItems(session: UnifiedAgentSession): readonly Record<string, unknown>[] {
  const visibleNames = new Set(session.profile.visibleToolNames);
  return session.tools
    .filter((tool) => visibleNames.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
}
