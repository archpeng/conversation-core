import { assertText } from "./schema-assertions.js";

export function validateTenantScopedInput(input: { tenantId: string }): void {
  assertText(input.tenantId, "tenantId");
}
