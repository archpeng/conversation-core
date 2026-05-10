import { WorkspaceError, type ProposalCompletenessResult, type ProposalStatusState, type TenantScope } from "./types.js";
import { assertIdentifier } from "./path-policy.js";
import { readWorkspaceFile } from "./file-operations.js";

const REQUIRED_SKILL_PROPOSAL_FILES = ["SKILL.md", "eval-fixtures.json", "risk-report.md", "status.json"] as const;
const ALLOWED_STATUS_STATES = new Set(["draft", "ready_for_review", "rejected"]);

export async function validateSkillProposalCompleteness(scope: TenantScope, proposalId: string): Promise<ProposalCompletenessResult> {
  assertIdentifier("proposalId", proposalId);
  const result: ProposalCompletenessResult = {
    proposalId,
    proposalPath: `/workspaces/${scope.tenantId}/proposals/${proposalId}/`,
    complete: false,
    missing: [],
    invalid: []
  };

  const files = new Map<string, string>();
  for (const filename of REQUIRED_SKILL_PROPOSAL_FILES) {
    const logicalPath = `/workspaces/${scope.tenantId}/proposals/${proposalId}/${filename}`;
    try {
      const read = await readWorkspaceFile(scope, logicalPath);
      if (read.bytes === 0) result.invalid.push(filename);
      files.set(filename, read.content);
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "not_found") result.missing.push(filename);
      else result.invalid.push(filename);
    }
  }

  const evalFixtures = files.get("eval-fixtures.json");
  if (evalFixtures !== undefined && !isJson(evalFixtures)) result.invalid.push("eval-fixtures.json");

  const status = files.get("status.json");
  if (status !== undefined) {
    const statusState = parseStatusState(status);
    if (statusState) result.statusState = statusState;
    else result.invalid.push("status.json");
  }

  result.invalid = Array.from(new Set(result.invalid));
  result.complete = result.missing.length === 0 && result.invalid.length === 0 && result.statusState !== undefined;
  return result;
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function parseStatusState(value: string): ProposalStatusState | undefined {
  try {
    const parsed = JSON.parse(value) as { state?: unknown; status?: unknown };
    const state = typeof parsed.state === "string" ? parsed.state : parsed.status;
    if (typeof state === "string" && ALLOWED_STATUS_STATES.has(state)) return state as ProposalStatusState;
    return undefined;
  } catch {
    return undefined;
  }
}
