import { validatePmsApprovalCard, type PmsApprovalCard } from "./approval-card.js";
import { asRecord, requireNonEmptyString, requireOneOf } from "./field-checks.js";

export type AgentTextResult = {
  type: "text";
  text: string;
  evidenceRefs?: string[];
};

export type AgentResult =
  | AgentTextResult
  | { type: "refusal"; reason: "policy" | "unsupported" | "invalid_request"; message: string }
  | { type: "proposal"; proposalId: string; title: string; summary: string; approvalRequired: true }
  | { type: "approval_card"; card: PmsApprovalCard };

export type AgentResultValidation =
  | { ok: true; value: AgentResult }
  | { ok: false; issues: string[] };

export function validateAgentResult(input: unknown): AgentResultValidation {
  const issues: string[] = [];
  const value = asRecord(input);

  if (!value) return { ok: false, issues: ["result must be an object"] };
  if ("replies" in value) issues.push("old replies output is not AgentResult");

  switch (value.type) {
    case "text":
      requireNonEmptyString(value.text, "text", issues);
      validateOptionalEvidenceRefs(value.evidenceRefs, issues);
      break;
    case "refusal":
      requireOneOf(value.reason, ["policy", "unsupported", "invalid_request"], "reason", issues);
      requireNonEmptyString(value.message, "message", issues);
      break;
    case "proposal":
      requireNonEmptyString(value.proposalId, "proposalId", issues);
      requireNonEmptyString(value.title, "title", issues);
      requireNonEmptyString(value.summary, "summary", issues);
      if (value.approvalRequired !== true) issues.push("approvalRequired must be true");
      break;
    case "approval_card": {
      const card = validatePmsApprovalCard(value.card);
      if (!card.ok) issues.push(...card.issues.map((issue) => `card.${issue}`));
      break;
    }
    default:
      issues.push("type is invalid");
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as AgentResult };
}

export function isAgentResult(input: unknown): input is AgentResult {
  return validateAgentResult(input).ok;
}

function validateOptionalEvidenceRefs(value: unknown, issues: string[]) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push("evidenceRefs must be an array when present");
    return;
  }
  for (const [index, item] of value.entries()) {
    requireNonEmptyString(item, `evidenceRefs[${index}]`, issues);
  }
}

