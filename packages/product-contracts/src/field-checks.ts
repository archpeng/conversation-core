export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function requireLiteral(value: unknown, expected: string, field: string, issues: string[]): void {
  if (value !== expected) issues.push(`${field} must be ${expected}`);
}

export function requireNonEmptyString(value: unknown, field: string, issues: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
  }
}

export function requireOptionalString(value: unknown, field: string, issues: string[]): void {
  if (value !== undefined && typeof value !== "string") {
    issues.push(`${field} must be a string when present`);
  }
}

export function requireOptionalBoolean(value: unknown, field: string, issues: string[]): void {
  if (value !== undefined && typeof value !== "boolean") {
    issues.push(`${field} must be a boolean when present`);
  }
}

export function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string, issues: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push(`${field} is invalid`);
  }
}

export function optionalStringArray(value: unknown, field: string, issues: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }
  const items: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      issues.push(`${field}[${index}] must be a non-empty string`);
    } else {
      items.push(item);
    }
  }
  return items;
}
