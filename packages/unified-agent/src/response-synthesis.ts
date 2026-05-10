import { validateAgentResult, type AgentResult, type PmsApprovalCard } from "@pms-agent-v2/adapter-contracts";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import type { ContextBundle } from "./context-bundle.js";
import { claimsCompletedHighRiskMutation, cleanOutputText, containsUnsafeOutput, currentPmsEvidenceRefs, looksLikeCurrentPmsFactReply, uniqueRefs } from "./response-synthesis-policy.js";

export { looksLikeCurrentPmsFactReply } from "./response-synthesis-policy.js";

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

function validOrFailure(result: AgentResult): ResponseSynthesisResult {
  const validation = validateAgentResult(result);
  if (validation.ok) return { ok: true, result };
  return failure("invalid_agent_result", "Synthesized output was not a valid AgentResult.");
}

function failure(reason: ResponseSynthesisFailureReason, message: string): ResponseSynthesisResult {
  return { ok: false, reason, result: { type: "refusal", reason: reason === "unsafe_output" ? "policy" : "invalid_request", message } };
}
