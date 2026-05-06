export const riskLevels = ["low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof riskLevels)[number];

export type RiskCategory =
  | "pms_fact_read"
  | "pms_workflow_prepare"
  | "pms_mutation_confirm"
  | "proposal_workspace_change"
  | "sandbox_file_access"
  | "sandbox_command_execution"
  | "external_network";

export type CapabilityRisk = {
  level: RiskLevel;
  categories: readonly RiskCategory[];
};

export const capabilityRisks = {
  pmsRead: { level: "low", categories: ["pms_fact_read"] },
  pmsWorkflow: { level: "medium", categories: ["pms_workflow_prepare"] },
  pmsConfirm: { level: "high", categories: ["pms_mutation_confirm"] },
  proposalRead: { level: "low", categories: ["proposal_workspace_change"] },
  proposalWrite: { level: "medium", categories: ["proposal_workspace_change"] },
  proposalEdit: { level: "medium", categories: ["proposal_workspace_change"] },
  sandboxRead: { level: "medium", categories: ["sandbox_file_access"] },
  sandboxWrite: { level: "high", categories: ["sandbox_file_access"] },
  sandboxEdit: { level: "high", categories: ["sandbox_file_access"] },
  sandboxBash: { level: "critical", categories: ["sandbox_command_execution"] },
  httpRequest: { level: "critical", categories: ["external_network"] }
} as const satisfies Record<string, CapabilityRisk>;
