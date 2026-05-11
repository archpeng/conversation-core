import { asRecord, optionalStringArray, requireNonEmptyString, requireOneOf, type Validation } from "./field-checks.js";

export const ledgerEntryKinds = ["turn", "read", "action", "error"] as const;

export type AgentLedgerEntryKind = (typeof ledgerEntryKinds)[number];

export type AgentLedgerEntry = {
  id: string;
  taskId: string;
  kind: AgentLedgerEntryKind;
  message: string;
  createdAt: string;
  evidenceRefs?: string[];
};

export function validateAgentLedgerEntry(input: unknown): Validation<AgentLedgerEntry> {
  const issues: string[] = [];
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["ledgerEntry must be an object"] };

  requireNonEmptyString(value.id, "ledgerEntry.id", issues);
  requireNonEmptyString(value.taskId, "ledgerEntry.taskId", issues);
  requireOneOf(value.kind, ledgerEntryKinds, "ledgerEntry.kind", issues);
  requireNonEmptyString(value.message, "ledgerEntry.message", issues);
  requireNonEmptyString(value.createdAt, "ledgerEntry.createdAt", issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, "ledgerEntry.evidenceRefs", issues);

  if (issues.length > 0 || !canBuildLedgerEntry(value)) return { ok: false, issues };
  return {
    ok: true,
    value: {
      id: value.id,
      taskId: value.taskId,
      kind: value.kind as AgentLedgerEntryKind,
      message: value.message,
      createdAt: value.createdAt,
      ...(evidenceRefs ? { evidenceRefs } : {})
    }
  };
}

function canBuildLedgerEntry(value: Record<string, unknown>): value is Record<string, string> {
  return typeof value.id === "string"
    && typeof value.taskId === "string"
    && typeof value.kind === "string"
    && typeof value.message === "string"
    && typeof value.createdAt === "string"
    && ledgerEntryKinds.includes(value.kind as AgentLedgerEntryKind);
}
