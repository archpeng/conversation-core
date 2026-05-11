import { readFile } from "node:fs/promises";

export type SafetyAuditReviewSummary = {
  total: number;
  allow: number;
  deny: number;
  requireApproval: number;
  latestAt?: string;
  recent: SafetyAuditReviewEvent[];
};

export type SafetyAuditReviewEvent = {
  id: string;
  at: string;
  outcome: string;
  capabilityId: string;
  riskLevel: string;
};

export async function readSafetyAuditSummary(filePath: string | undefined): Promise<SafetyAuditReviewSummary> {
  if (!filePath) return emptySummary();
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return emptySummary();
  }
  const events = text.split("\n").flatMap(parseAuditLine).sort((left, right) => right.at.localeCompare(left.at));
  return {
    total: events.length,
    allow: events.filter((event) => event.outcome === "allow").length,
    deny: events.filter((event) => event.outcome === "deny").length,
    requireApproval: events.filter((event) => event.outcome === "require_approval").length,
    ...(events[0]?.at ? { latestAt: events[0].at } : {}),
    recent: events.slice(0, 5)
  };
}

function parseAuditLine(line: string): SafetyAuditReviewEvent[] {
  if (!line.trim()) return [];
  try {
    const record = asRecord(JSON.parse(line));
    if (!record) return [];
    if (typeof record.id !== "string" || typeof record.at !== "string" || typeof record.outcome !== "string" || typeof record.capabilityId !== "string") return [];
    return [{
      id: record.id,
      at: record.at,
      outcome: record.outcome,
      capabilityId: record.capabilityId,
      riskLevel: typeof record.riskLevel === "string" ? record.riskLevel : "unknown"
    }];
  } catch {
    return [];
  }
}

function emptySummary(): SafetyAuditReviewSummary {
  return {
    total: 0,
    allow: 0,
    deny: 0,
    requireApproval: 0,
    recent: []
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
