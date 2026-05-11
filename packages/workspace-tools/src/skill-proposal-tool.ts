import { WORKSPACE_IDENTIFIER_PATTERN, WorkspaceError } from "@pms-agent-v2/workspace-core";
import { WorkspaceToolError } from "./workspace-errors.js";

export type WorkspaceCreateSkillProposalInputShape = {
  tenantId: string;
  proposalId: string;
  skillMarkdown: string;
  evalFixturesJson: string;
  riskReportMarkdown: string;
  statusJson: string;
};

const ALLOWED_PROPOSAL_STATUS_STATES = new Set(["draft", "ready_for_review", "rejected"]);

export function assertSkillProposalInput(input: WorkspaceCreateSkillProposalInputShape): void {
  assertIdentifier("proposalId", input.proposalId);
  if (!input.skillMarkdown.trim()) throw new WorkspaceToolError("invalid_input", "Skill proposal requires SKILL.md content.");
  if (!input.riskReportMarkdown.trim()) throw new WorkspaceToolError("invalid_input", "Skill proposal requires risk-report.md content.");
  assertJson("eval-fixtures.json", input.evalFixturesJson);
  assertAllowedStatusState(input.statusJson);
}

export function proposalRoot(tenantId: string, proposalId: string): string {
  return `/workspaces/${tenantId}/proposals/${proposalId}`;
}

function assertAllowedStatusState(value: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new WorkspaceToolError("invalid_input", "status.json must be valid JSON.");
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  const state = typeof record?.state === "string" ? record.state : record?.status;
  if (typeof state !== "string" || !ALLOWED_PROPOSAL_STATUS_STATES.has(state)) {
    throw new WorkspaceToolError("invalid_input", "status.json must use a non-active proposal state.");
  }
}

function assertJson(label: string, value: string): void {
  try {
    JSON.parse(value);
  } catch {
    throw new WorkspaceToolError("invalid_input", `${label} must be valid JSON.`);
  }
}

function assertIdentifier(label: string, value: string): void {
  if (!WORKSPACE_IDENTIFIER_PATTERN.test(value)) throw new WorkspaceError("invalid_identifier", `${label} must match ${WORKSPACE_IDENTIFIER_PATTERN.source}.`);
}
