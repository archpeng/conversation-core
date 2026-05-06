import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanPath } from "../scripts/boundary-guard.mjs";

describe("boundary guard", () => {
  it("passes the repository runtime surfaces", async () => {
    await expect(scanPath(path.resolve(import.meta.dirname, ".."))).resolves.toEqual([]);
  });

  it.each([
    ["import legacy from 'ai-conversation';\nvoid legacy;\n", "ai-conversation runtime dependency"],
    ["import fallback from 'ai-pms';\nvoid fallback;\n", "ai-pms runtime dependency"],
    ["import core from 'pi-agent-core';\nvoid core;\n", "pi-agent-core runtime dependency"],
    ["export const output = { body: { replies: [] } };\n", "old replies output contract"],
    ["export const moduleName = 'legacy-v1-compat';\n", "v1-v2 compatibility module"]
  ])("fails on seeded banned runtime surface %#", async (source, rule) => {
    const root = await mkdtemp(path.join(tmpdir(), "pms-agent-v2-boundary-"));
    const src = path.join(root, "packages", "seed", "src");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "bad.ts"), source);

    const violations = await scanPath(root);
    expect(violations).toEqual([{ file: "packages/seed/src/bad.ts", rule }]);
  });
});
