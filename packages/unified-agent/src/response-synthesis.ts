import { validateAgentResult, type AgentResult, type PmsApprovalCard } from "@pms-agent-v2/adapter-contracts";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import type { ContextBundle } from "./context-bundle.js";

export type ResponseSynthesisDraft =
  | { readonly kind: "text_reply"; readonly text: string; readonly evidenceRefs?: readonly string[]; readonly currentPmsFact?: boolean }
  | { readonly kind: "clarification"; readonly message: string }
  | { readonly kind: "refusal"; readonly reason: "policy" | "unsupported" | "invalid_request"; readonly message: string }
  | { readonly kind: "approval_card"; readonly card: PmsApprovalCard }
  | { readonly kind: "proposal_created"; readonly proposalId: string; readonly title: string; readonly summary: string };

export type ResponseSynthesisInput = {
  readonly draft: ResponseSynthesisDraft;
  readonly context?: ContextBundle;
  readonly pmsEvidence?: readonly PmsEvidence<unknown>[];
};

export type ResponseSynthesisResult =
  | { readonly ok: true; readonly result: AgentResult }
  | { readonly ok: false; readonly reason: ResponseSynthesisFailureReason; readonly result: AgentResult };

export type ResponseSynthesisFailureReason =
  | "missing_pms_evidence"
  | "invalid_pms_evidence_ref"
  | "unsafe_output"
  | "mutation_claim_requires_approval"
  | "invalid_agent_result";

// C4 contract note: this is an output validation/synthesis boundary, not a prompt rule.
// Current PMS fact-bearing text requires pms-platform evidence refs; advisory context never satisfies that requirement.
export function synthesizeAgentResult(input: ResponseSynthesisInput): ResponseSynthesisResult {
  const draft = input.draft;

  if (draft.kind === "clarification") return validOrFailure({ type: "refusal", reason: "invalid_request", message: draft.message });
  if (draft.kind === "refusal") return validOrFailure({ type: "refusal", reason: draft.reason, message: draft.message });
  if (draft.kind === "approval_card") return validOrFailure({ type: "approval_card", card: draft.card });
  if (draft.kind === "proposal_created") {
    return validOrFailure({ type: "proposal", proposalId: draft.proposalId, title: draft.title, summary: draft.summary, approvalRequired: true });
  }

  const text = cleanOutputText(draft.text);
  if (containsUnsafeOutput(text)) return failure("unsafe_output", "Final output contains unsafe internal or secret-looking content.");
  if (claimsCompletedHighRiskMutation(text)) return failure("mutation_claim_requires_approval", "High-risk PMS changes require an approval card or safe refusal.");

  const requiresEvidence = draft.currentPmsFact === true || looksLikeCurrentPmsFactReply(text);
  const refs = uniqueRefs(draft.evidenceRefs ?? []);
  if (requiresEvidence) {
    if (refs.length === 0) return failure("missing_pms_evidence", "Current PMS facts require pms-platform evidence refs.");
    const currentRefs = currentPmsEvidenceRefs(input);
    if (!refs.every((ref) => currentRefs.has(ref))) {
      return failure("invalid_pms_evidence_ref", "Current PMS facts require current pms-platform evidence, not advisory context.");
    }
  }

  return validOrFailure({ type: "text", text, ...(refs.length > 0 ? { evidenceRefs: refs } : {}) });
}

export function synthesizeTextReply(input: Omit<ResponseSynthesisInput, "draft"> & {
  readonly text: string;
  readonly evidenceRefs?: readonly string[];
  readonly currentPmsFact?: boolean;
}): ResponseSynthesisResult {
  return synthesizeAgentResult({
    context: input.context,
    pmsEvidence: input.pmsEvidence,
    draft: { kind: "text_reply", text: input.text, evidenceRefs: input.evidenceRefs, currentPmsFact: input.currentPmsFact }
  });
}

export function looksLikeCurrentPmsFactReply(text: string): boolean {
  return /PMS\s*(证据|evidence).*?(有|未查到|available|unavailable|priceCents|状态)/i.test(text)
    || /(有\s*\d+\s*个可订候选|未查到可订房型|可订房型|空房\s*[:：]?\s*(有|无)|available\s*[:=]\s*(true|false))/i.test(text)
    || /(PMS\s*)?(priceCents=\d+|价格\s*[:：=]\s*\d+|\d+\s*元)/i.test(text)
    || /(预订|订单|reservation|pending action|pendingActionStatus|room state|roomState).*?(状态为|status\s*[:=]|已确认|confirmed|已取消|cancelled)/i.test(text);
}

function currentPmsEvidenceRefs(input: ResponseSynthesisInput): Set<string> {
  const refs = new Set<string>();
  for (const evidence of input.pmsEvidence ?? []) refs.add(evidence.evidenceRef);
  return refs;
}

function claimsCompletedHighRiskMutation(text: string): boolean {
  return /(PMS|预订|订单|reservation|booking).*?(已确认|已取消|已完成|已执行|已写入|已更新|confirmed|cancelled|completed|mutated)/i.test(text);
}

function containsUnsafeOutput(text: string): boolean {
  return /<\/?hidden_prompt>|tenant_access_token|authorization:\s*bearer|tool[_ -]?call|tool trace|stack trace|\b(room|pending|tenant|session|actor|message)_secret_[A-Za-z0-9_-]+\b/i.test(text);
}

function cleanOutputText(text: string): string {
  return text.replace(/[\r\t]+/g, " ").trim();
}

function uniqueRefs(refs: readonly string[]): string[] {
  return Array.from(new Set(refs.filter((ref) => typeof ref === "string" && ref.trim().length > 0)));
}

function validOrFailure(result: AgentResult): ResponseSynthesisResult {
  const validation = validateAgentResult(result);
  if (validation.ok) return { ok: true, result };
  return failure("invalid_agent_result", "Synthesized output was not a valid AgentResult.");
}

function failure(reason: ResponseSynthesisFailureReason, message: string): ResponseSynthesisResult {
  return { ok: false, reason, result: { type: "refusal", reason: reason === "unsafe_output" ? "policy" : "invalid_request", message } };
}
