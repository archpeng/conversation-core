import type { AgentResult, FeishuTurnInput, PmsApprovalCard } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { AvailabilitySearchResult, PmsEvidence, ReservationConfirmPreparation } from "@pms-agent-v2/pms-platform-client";
import type { ContextBundle } from "./context-bundle.js";
import { promptAssistantText } from "./pi-io.js";
import type { AgentToolResult } from "./pi-session.js";
import { synthesizeTextReply } from "./response-synthesis.js";
import { evidenceReplyPrompt } from "./session-turn-prompt.js";
import type { RunAgentTurnOptions, UnifiedAgentSession } from "./session-types.js";

export type PlannedAgentResult = {
  result: AgentResult;
  evidenceRefs?: string[];
  pendingActionRefs?: string[];
};

export async function synthesizeToolResult(session: UnifiedAgentSession, turn: FeishuTurnInput, toolResult: AgentToolResult<GatedToolResult<unknown>>, context: ContextBundle, options: RunAgentTurnOptions): Promise<PlannedAgentResult> {
  const details = toolResult.details as Record<string, unknown>;
  if (details.outcome === "allow" && isPmsEvidence(details.value)) {
    const evidence = details.value;
    const approval = synthesizePrepareConfirmApproval(evidence);
    if (approval) return approval;

    const llmReply = await promptAssistantText(session.piSession, evidenceReplyPrompt(turn, evidence));
    const synthesized = synthesizeEvidenceTextReply(llmReply, evidence, context, options);
    if (synthesized) return synthesized;
    return fallbackEvidenceTextReply(evidence, context, options);
  }

  const text = toolResult.content.map((item) => item.type === "text" ? item.text : "").filter(Boolean).join("\n").trim() || "Gated action completed.";
  return { result: synthesizeTextReply({ text, context }).result };
}

export function synthesizeEvidenceTextReply(text: string, evidence: PmsEvidence<unknown>, context: ContextBundle, options: RunAgentTurnOptions): PlannedAgentResult | undefined {
  return synthesizeEvidenceSequenceTextReply(text, [evidence], context, options);
}

export function synthesizeEvidenceSequenceTextReply(text: string, evidence: readonly PmsEvidence<unknown>[], context: ContextBundle, options: RunAgentTurnOptions): PlannedAgentResult | undefined {
  if (!text.trim() || evidence.length === 0) return undefined;
  const evidenceRefs = evidence.map((item) => item.evidenceRef);
  const missingRefs = evidenceRefs.filter((ref) => !text.includes(ref));
  const replyText = missingRefs.length === 0 ? text : `${text.trim()} evidenceRefs=${missingRefs.join(",")}`;
  const synthesized = synthesizeTextReply({
    text: replyText,
    evidenceRefs,
    pmsEvidence: [...(options.pmsEvidence ?? []), ...evidence],
    currentPmsFact: true,
    context
  });
  if (!synthesized.ok) return undefined;
  return { result: synthesized.result, evidenceRefs };
}

export function fallbackEvidenceTextReply(evidence: PmsEvidence<unknown>, context: ContextBundle, options: RunAgentTurnOptions): PlannedAgentResult {
  return fallbackEvidenceSequenceTextReply([evidence], context, options);
}

export function fallbackEvidenceSequenceTextReply(evidence: readonly PmsEvidence<unknown>[], context: ContextBundle, options: RunAgentTurnOptions): PlannedAgentResult {
  const evidenceRefs = evidence.map((item) => item.evidenceRef);
  const summaries = evidence.map((item) => item.summary).join("；");
  const result = synthesizeTextReply({
    text: `PMS evidence is available: ${summaries}. evidenceRefs=${evidenceRefs.join(",")}`,
    evidenceRefs,
    pmsEvidence: [...(options.pmsEvidence ?? []), ...evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs };
}

export function synthesizePrepareConfirmApproval(evidence: PmsEvidence<unknown>): PlannedAgentResult | undefined {
  if ((evidence.source.method !== "prepareReservationConfirm" && evidence.source.method !== "prepareReservationGroupConfirm") || !isReservationConfirmPreparation(evidence.data)) return undefined;
  return {
    result: { type: "approval_card", card: approvalCard(evidence.scope.tenantId, evidence.data) },
    evidenceRefs: [evidence.evidenceRef],
    pendingActionRefs: [evidence.data.pendingActionId]
  };
}

export function isReservationConfirmPreparation(value: unknown): value is ReservationConfirmPreparation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.pendingActionId === "string"
    && record.pendingActionId.trim().length > 0
    && record.confirmationMode === "typedCardOnly"
    && record.mutationStatus === "none"
    && (record.pendingActionRef === undefined || typeof record.pendingActionRef === "string")
    && (record.cardPayloadRef === undefined || typeof record.cardPayloadRef === "string")
    && (record.quoteRef === undefined || typeof record.quoteRef === "string")
    && (record.selectionCount === undefined || typeof record.selectionCount === "number")
    && (record.expiresAt === undefined || typeof record.expiresAt === "string");
}

export function approvalCard(tenantId: string, preparation: ReservationConfirmPreparation): PmsApprovalCard {
  return {
    type: "pms_pending_action_card",
    ref: {
      type: "pms_pending_action",
      tenantId,
      pendingActionId: preparation.pendingActionId,
      ...(preparation.pendingActionRef ? { pendingActionRef: preparation.pendingActionRef } : {}),
      ...(preparation.cardPayloadRef ? { cardPayloadRef: preparation.cardPayloadRef } : {}),
      ...(preparation.quoteRef ? { quoteRef: preparation.quoteRef } : {}),
      ...(preparation.selectionCount ? { selectionCount: preparation.selectionCount } : {}),
      action: "reservation_confirm",
      ...(preparation.expiresAt ? { expiresAt: preparation.expiresAt } : {})
    },
    title: "确认预订草稿",
    summary: "PMS 已准备预订草稿待审批操作；点击确认只会确认草稿 pending-action，不代表最终预订已创建。",
    confirmLabel: "确认",
    cancelLabel: "取消"
  };
}

export function isPmsEvidence(value: unknown): value is PmsEvidence<unknown> {
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

export function isAvailabilityEvidence(value: PmsEvidence<unknown> | undefined): value is PmsEvidence<AvailabilitySearchResult> {
  if (!value || value.source.method !== "searchAvailability") return false;
  const data = value.data as Record<string, unknown> | undefined;
  return Boolean(data && Array.isArray(data.rooms));
}
