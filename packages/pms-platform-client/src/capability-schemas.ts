import { assertArray, assertRecord, assertText, isPlainRecord } from "./schema-assertions.js";

export type PmsCapabilityManifest = {
  capabilities: string[];
};

export type HealthResult = {
  ok: boolean;
};

export function parseHealthResult(value: unknown): HealthResult {
  const object = assertRecord(value, "health response");
  return { ok: object.ok === true };
}

export function parseCapabilityManifest(value: unknown): PmsCapabilityManifest {
  const object = assertRecord(value, "capabilities response");
  const source = isPlainRecord(object.manifest) ? object.manifest : object;
  const rawCapabilities = assertArray(source.capabilities, "capabilities");
  const capabilities = rawCapabilities.map((item, index) => {
    if (typeof item === "string") return assertText(item, `capabilities[${index}]`);
    const record = assertRecord(item, `capabilities[${index}]`);
    return assertText(record.name ?? record.operation, `capabilities[${index}].name`);
  });
  return { capabilities };
}
