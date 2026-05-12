import { asRecord, requireNonEmptyString, requireOneOf, requireOptionalString } from "./field-checks.js";

export const agentObjectRefKinds = ["property", "room", "roomType", "reservation", "pendingAction", "availability", "task"] as const;

export type AgentObjectRefKind = (typeof agentObjectRefKinds)[number];

export type AgentObjectRef = {
  kind: AgentObjectRefKind;
  id: string;
  label?: string;
  evidenceRefs?: string[];
};

export function parseAgentObjectRefs(input: unknown, field: string, issues: string[]): AgentObjectRef[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }

  const refs: AgentObjectRef[] = [];
  for (const [index, item] of input.entries()) {
    const ref = parseAgentObjectRef(item, `${field}[${index}]`, issues);
    if (ref) refs.push(ref);
  }
  return refs;
}

function parseAgentObjectRef(input: unknown, field: string, issues: string[]): AgentObjectRef | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object`);
    return undefined;
  }

  requireOneOf(value.kind, agentObjectRefKinds, `${field}.kind`, issues);
  requireNonEmptyString(value.id, `${field}.id`, issues);
  requireOptionalString(value.label, `${field}.label`, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, `${field}.evidenceRefs`, issues);

  if (typeof value.kind !== "string" || !agentObjectRefKinds.includes(value.kind as AgentObjectRefKind)) return undefined;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return undefined;
  return {
    kind: value.kind as AgentObjectRefKind,
    id: value.id,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}

function optionalStringArray(value: unknown, field: string, issues: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }

  const result: string[] = [];
  for (const [index, item] of value.entries()) {
    requireNonEmptyString(item, `${field}[${index}]`, issues);
    if (typeof item === "string" && item.trim().length > 0) result.push(item);
  }
  return result;
}
