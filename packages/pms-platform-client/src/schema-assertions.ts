export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertLiteral<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) throw new Error(`${field} must be ${expected}`);
  return expected;
}

export function assertArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

export function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

export function assertText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

export function assertNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

export function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
