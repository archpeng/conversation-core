import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { RedactedSessionState } from "./continuity.js";
import type { GatedToolDefinition } from "./pi-session.js";

export type ProposalLoopResult = {
  result: AgentResult;
  auditIds: string[];
};

type ProposalArtifact = {
  path: string;
  content: string;
};

export async function runAdminProposalLoop(input: {
  turn: FeishuTurnInput;
  tools: readonly GatedToolDefinition[];
  state: RedactedSessionState;
}): Promise<ProposalLoopResult | undefined> {
  if (!isProposalRequest(input.turn.message.text)) return undefined;

  const proposalId = proposalRef(input.state);
  const workspaceRoot = `/workspaces/${proposalId}/proposal`;
  const artifacts = proposalArtifacts({ workspaceRoot, rule: input.turn.message.text });
  const auditIds: string[] = [];

  for (const artifact of artifacts) {
    const written = await writeProposalArtifact(input.tools, artifact);
    if (!written.ok) return { result: written.result, auditIds };
    auditIds.push(written.auditId);
  }

  return {
    result: {
      type: "proposal",
      proposalId,
      title: "proposal_created",
      summary: `Created proposal artifacts under ${workspaceRoot}: SKILL.md, eval-fixtures.json, risk-report.md. auditIds=${auditIds.join(",")}`,
      approvalRequired: true
    },
    auditIds
  };
}

function isProposalRequest(message: string): boolean {
  return /proposal|规则|rule|skill|eval|risk|风险|方案/i.test(message);
}

function proposalRef(state: RedactedSessionState): string {
  const messageRef = state.turnRefs.at(-1)?.messageRef ?? "message_unknown";
  return `${state.sessionRef}_${messageRef}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function proposalArtifacts(input: { workspaceRoot: string; rule: string }): ProposalArtifact[] {
  const rule = input.rule.trim().slice(0, 500);
  return [
    {
      path: `${input.workspaceRoot}/SKILL.md`,
      content: [
        "---",
        "name: proposed-rule",
        "description: Proposal-only skill draft generated for review; not installed or published.",
        "---",
        "",
        "# Proposed Rule",
        "",
        rule,
        "",
        "## Boundary",
        "",
        "This artifact is proposal-only and cannot mutate PMS production state."
      ].join("\n")
    },
    {
      path: `${input.workspaceRoot}/eval-fixtures.json`,
      content: JSON.stringify({
        status: "proposal_only",
        requestedRule: rule,
        expectedResult: "proposal_created",
        productionMutation: false
      }, null, 2)
    },
    {
      path: `${input.workspaceRoot}/risk-report.md`,
      content: [
        "# Risk Report",
        "",
        `Requested rule: ${rule}`,
        "",
        "- PMS safety: no PMS write or confirmation endpoint is called by this proposal loop.",
        "- Non-publication boundary: generated files stay in the proposal workspace for review only.",
        "- Required review: typed human review remains required before any separate production change."
      ].join("\n")
    }
  ];
}

async function writeProposalArtifact(tools: readonly GatedToolDefinition[], artifact: ProposalArtifact): Promise<{ ok: true; auditId: string } | { ok: false; result: AgentResult }> {
  const tool = tools.find((candidate) => candidate.name === "gated_proposal_write");
  if (!tool) return { ok: false, result: { type: "refusal", reason: "unsupported", message: "Proposal workspace write tool is not available." } };

  try {
    const toolResult = await tool.executePlan({ path: artifact.path, content: artifact.content });
    const details = toolResult.details as GatedToolResult<unknown>;
    if (details.outcome === "allow") return { ok: true, auditId: details.auditId };
    return { ok: false, result: { type: "refusal", reason: "policy", message: "Proposal artifact write was denied by policy." } };
  } catch {
    return { ok: false, result: { type: "refusal", reason: "unsupported", message: "Proposal artifact write failed." } };
  }
}
