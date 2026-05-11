import { asRecord, optionalStringArray, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";

export const objectRefKinds = ["property", "room", "roomType", "reservation", "pendingAction", "availability", "task"] as const;

export type ObjectRefKind = (typeof objectRefKinds)[number];

export type ObjectRef = {
  kind: ObjectRefKind;
  id: string;
  label?: string;
  evidenceRefs?: string[];
};

export function validateObjectRef(input: unknown, field = "objectRef"): Validation<ObjectRef> {
  const issues: string[] = [];
  const ref = parseObjectRef(input, field, issues);
  if (issues.length > 0 || !ref) return { ok: false, issues };
  return { ok: true, value: ref };
}

export function parseObjectRefs(input: unknown, field: string, issues: string[]): ObjectRef[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }
  const refs: ObjectRef[] = [];
  for (const [index, item] of input.entries()) {
    const ref = parseObjectRef(item, `${field}[${index}]`, issues);
    if (ref) refs.push(ref);
  }
  return refs;
}

function parseObjectRef(input: unknown, field: string, issues: string[]): ObjectRef | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object`);
    return undefined;
  }
  requireOneOf(value.kind, objectRefKinds, `${field}.kind`, issues);
  requireNonEmptyString(value.id, `${field}.id`, issues);
  requireOptionalString(value.label, `${field}.label`, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, `${field}.evidenceRefs`, issues);
  if (typeof value.kind !== "string" || typeof value.id !== "string" || !objectRefKinds.includes(value.kind as ObjectRefKind) || !value.id.trim()) {
    return undefined;
  }
  return {
    kind: value.kind as ObjectRefKind,
    id: value.id,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}
