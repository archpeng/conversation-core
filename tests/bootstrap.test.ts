import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const workspaces = [
  "apps/agent-service",
  "packages/adapter-contracts",
  "packages/unified-agent",
  "packages/safety-gateway",
  "packages/gated-tools",
  "packages/pms-platform-client",
  "packages/evals"
];

describe("P0 bootstrap scaffold", () => {
  it("keeps every planned workspace present", async () => {
    for (const workspace of workspaces) {
      const manifest = JSON.parse(await readFile(path.join(root, workspace, "package.json"), "utf8"));
      expect(manifest.name).toMatch(/^@pms-agent-v2\//);
    }
  });

  it("keeps root scripts focused on build, test, eval, and boundary guard", async () => {
    const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    expect(Object.keys(manifest.scripts).sort()).toEqual(["build", "eval", "guard:boundaries", "start", "test"]);
  });
});
