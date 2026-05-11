import { mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RedactedDecisionSummary, SafetyDecision } from "./decision.js";

export type SafetyAuditEvent = {
  id: string;
  at: string;
  outcome: SafetyDecision["outcome"];
  capabilityId: string;
  actorProfile: RedactedDecisionSummary["actorProfile"];
  workspaceKind: RedactedDecisionSummary["workspaceKind"];
  hasTenantScope: boolean;
  hasPendingAction: boolean;
  riskLevel: string;
  reasonCodes: readonly string[];
  summary: RedactedDecisionSummary;
};

export type AuditEventOptions = {
  id?: string;
  at?: string;
};

export type SafetyAuditSink = {
  append(event: SafetyAuditEvent): void;
};

export type SafetyAuditJsonlWriter = SafetyAuditSink & {
  flush(): string;
  events(): readonly SafetyAuditEvent[];
};

export function createSafetyAuditEvent(decision: SafetyDecision, options: AuditEventOptions = {}): SafetyAuditEvent {
  return {
    id: options.id ?? buildAuditId(decision),
    at: options.at ?? new Date().toISOString(),
    outcome: decision.outcome,
    capabilityId: decision.audit.capabilityId,
    actorProfile: decision.audit.actorProfile,
    workspaceKind: decision.audit.workspaceKind,
    hasTenantScope: decision.audit.hasTenantScope,
    hasPendingAction: decision.audit.hasPendingAction,
    riskLevel: decision.capability?.risk.level ?? "unknown",
    reasonCodes: decision.reasons.map((reason) => reason.code),
    summary: decision.audit
  };
}

export function serializeSafetyAuditEvent(event: SafetyAuditEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function createSafetyAuditJsonlWriter(): SafetyAuditJsonlWriter {
  const events: SafetyAuditEvent[] = [];
  const lines: string[] = [];

  return {
    append(event) {
      events.push(event);
      lines.push(serializeSafetyAuditEvent(event));
    },
    flush() {
      return lines.join("");
    },
    events() {
      return events;
    }
  };
}

export function createSafetyAuditJsonlFileWriter(filePath: string): SafetyAuditJsonlWriter {
  const events: SafetyAuditEvent[] = [];
  const lines: string[] = [];
  mkdirSync(dirname(filePath), { recursive: true });
  return {
    append(event) {
      const line = serializeSafetyAuditEvent(event);
      events.push(event);
      lines.push(line);
      appendFileSync(filePath, line, "utf8");
    },
    flush() {
      return lines.join("");
    },
    events() {
      return events;
    }
  };
}

export function redactValue(value: string): string {
  if (value.length <= 4) return "[redacted]";
  return `[redacted:${value.slice(-4)}]`;
}

let auditSequence = 0;

function buildAuditId(decision: SafetyDecision): string {
  const reason = decision.reasons[0]?.code ?? "none";
  auditSequence += 1;
  return `audit_${auditSequence}_${decision.outcome}_${decision.audit.capabilityId}_${reason}`;
}
