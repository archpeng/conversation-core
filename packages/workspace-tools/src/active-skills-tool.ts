import { readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { WORKSPACE_IDENTIFIER_PATTERN, WorkspaceError } from "@pms-agent-v2/workspace-core";
import { WorkspaceToolError } from "./workspace-errors.js";

export async function listActiveSkillNames(input: { rootDir: string; tenantId: string }): Promise<string[]> {
  assertIdentifier("tenantId", input.tenantId);
  const tenantRoot = path.resolve(input.rootDir, "workspaces", input.tenantId);
  const skillsDir = path.join(tenantRoot, "active", "skills");
  const [realTenantRoot, realSkillsDir] = await Promise.all([realpath(tenantRoot), realpath(skillsDir)]);
  assertInside(realSkillsDir, realTenantRoot);
  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json")))
    .map((entry) => entry.name)
    .sort();
}

function assertIdentifier(label: string, value: string): void {
  if (!WORKSPACE_IDENTIFIER_PATTERN.test(value)) throw new WorkspaceError("invalid_identifier", `${label} must match ${WORKSPACE_IDENTIFIER_PATTERN.source}.`);
}

function assertInside(realTarget: string, realRoot: string): void {
  const relative = path.relative(realRoot, realTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  throw new WorkspaceToolError("symlink_escape", "Workspace tool path resolves outside the tenant root.");
}
