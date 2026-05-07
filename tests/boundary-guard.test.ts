import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanPath } from "../scripts/boundary-guard.mjs";

async function writeSeed(root, relativeFile, source) {
  const filePath = path.join(root, relativeFile);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source);
}

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
    await writeSeed(root, "packages/seed/src/bad.ts", source);

    const violations = await scanPath(root);
    expect(violations).toEqual([{ file: "packages/seed/src/bad.ts", rule }]);
  });

  it.each([
    ["packages/pms-platform-client/src/bad.ts", "import { createAgentSession } from '@pms-agent-v2/unified-agent';\nvoid createAgentSession;\n", "forbidden import: pms-platform-client -> unified-agent"],
    ["packages/safety-gateway/src/bad.ts", "export { PmsPlatformClient } from '@pms-agent-v2/pms-platform-client';\n", "forbidden import: safety-gateway -> pms-platform-client"],
    ["packages/safety-gateway/src/bad.ts", "const tools = require('@pms-agent-v2/gated-tools');\nvoid tools;\n", "forbidden import: safety-gateway -> gated-tools"],
    ["packages/adapter-contracts/src/bad.ts", "const service = await import('@pms-agent-v2/agent-service/runtime');\nvoid service;\n", "forbidden import: adapter-contracts -> agent-service"],
    ["packages/workspace-core/src/bad.ts", "import type { SafetyDecision } from '@pms-agent-v2/safety-gateway';\nexport type Decision = SafetyDecision;\n", "forbidden import: workspace-core -> safety-gateway"]
  ])("fails on forbidden package import %#", async (relativeFile, source, rule) => {
    const root = await mkdtemp(path.join(tmpdir(), "pms-agent-v2-boundary-"));
    await writeSeed(root, relativeFile, source);

    const violations = await scanPath(root);
    expect(violations).toEqual([{ file: relativeFile, rule }]);
  });

  it("allows explicitly documented cross-links", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pms-agent-v2-boundary-"));
    await writeSeed(
      root,
      "packages/unified-agent/src/ok.ts",
      "import type { PmsEvidence } from '@pms-agent-v2/pms-platform-client';\nexport type Evidence = PmsEvidence<unknown>;\n"
    );

    await expect(scanPath(root)).resolves.toEqual([]);
  });
});
