export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function requireLiteral(value: unknown, expected: string, field: string, issues: string[]) {
  if (value !== expected) issues.push(`${field} must be ${expected}`);
}

export function requireNonEmptyString(value: unknown, field: string, issues: string[]) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
  }
}

export function requireOptionalString(value: unknown, field: string, issues: string[]) {
  if (value !== undefined && typeof value !== "string") {
    issues.push(`${field} must be a string when present`);
  }
}

export function requireOneOf(value: unknown, allowed: readonly string[], field: string, issues: string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.push(`${field} is invalid`);
  }
}
