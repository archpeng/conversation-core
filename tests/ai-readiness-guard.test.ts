import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanPath } from "../scripts/ai-readiness-guard.mjs";

async function writeSeed(root: string, relativeFile: string, source: string): Promise<void> {
  const filePath = path.join(root, relativeFile);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source);
}

describe("AI-readiness guard", () => {
  it("passes the repository source and test budgets", async () => {
    await expect(scanPath(path.resolve(import.meta.dirname, ".."))).resolves.toEqual([]);
  });

  it.each([
    ["const value = input as Partial<{ ok: string }>;\nvoid value;\n", "forbidden cast: partial"],
    ["const value = input as never;\nvoid value;\n", "forbidden cast: never"],
    ["const value = input as unknown as { ok: string };\nvoid value;\n", "forbidden cast: double"],
    ["const value: any = input;\nvoid value;\n", "forbidden any type"]
  ])("fails on seeded risky source typing %#", async (source, rule) => {
    const root = await mkdtemp(path.join(tmpdir(), "pms-agent-ai-readiness-"));
    await writeSeed(root, "packages/seed/src/bad.ts", `const input = {};\n${source}`);

    await expect(scanPath(root)).resolves.toEqual([{ file: "packages/seed/src/bad.ts", rule }]);
  });

  it("fails on oversized source files while allowing test files below the test budget", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pms-agent-ai-readiness-"));
    const sourceLines = Array.from({ length: 351 }, (_, index) => `export const value${index} = ${index};`).join("\n");
    const testLines = Array.from({ length: 500 }, (_, index) => `const value${index} = ${index};`).join("\n");
    await writeSeed(root, "packages/seed/src/large.ts", sourceLines);
    await writeSeed(root, "tests/large.test.ts", testLines);

    await expect(scanPath(root)).resolves.toEqual([{ file: "packages/seed/src/large.ts", rule: "line budget exceeded: 351/350" }]);
  });
});
