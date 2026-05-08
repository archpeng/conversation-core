import type { FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle, contextBundlePrompt } from "./context-bundle.js";
import { continuityPrompt } from "./continuity.js";
import { buildVisibleGatedToolManifest } from "./tool-plan.js";
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
    "Visible gated tool manifest:",
    JSON.stringify(buildVisibleGatedToolManifest(session.profile, session.tools), null, 2),
    "ToolPlanAction JSON-only output contract:",
    "Return exactly one JSON object and no markdown or extra prose for actionable turns.",
    "Allowed shapes:",
    JSON.stringify([
      { type: "call_tool", toolName: "one visible gated tool name", params: {} },
      {
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm" } }
      },
      { type: "ask_clarification", message: "focused clarification question" },
      { type: "refuse", reason: "policy|unsupported|invalid_request", message: "safe refusal text" },
      { type: "require_approval", message: "approval-card/proposal required text" }
    ], null, 2),
    "Never call or name raw tools such as bash, read, write, edit, http, or http_request. Choose only from the visible gated tool manifest; runtime validation and Safety Gateway remain authoritative.",
    "User message:",
    turn.message.text
  ].join("\n");
}
