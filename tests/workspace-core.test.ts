import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTenantWorkspace,
  readWorkspaceFile,
  resolveTenantPath,
  validateSkillProposalCompleteness,
  WorkspaceError,
  writeProposalFile,
  type TenantScope
} from "../packages/workspace-core/src/index.js";

const tenantId = "tenant_1";

describe("workspace-core tenant store", () => {
  it("initializes the exact W1 tenant workspace skeleton and starter files", async () => {
    const rootDir = await tempRoot();
    const workspace = await createTenantWorkspace(rootDir, tenantId);

    expect(workspace).toMatchObject({ tenantId, logicalRoot: "/workspaces/tenant_1/" });
    await expect(stat(path.join(workspace.localRoot, "active", "skills"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "active", "policies"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "proposals"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "sessions"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "memory", "advisory-notes"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "evals"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "audit", "workspace-events.jsonl"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.localRoot, "tmp"))).resolves.toMatchObject({});
    await expect(readFile(path.join(workspace.localRoot, "README.md"), "utf8")).resolves.toContain("tenantId=tenant_1");
    await expect(readFile(path.join(workspace.localRoot, "PROFILE.md"), "utf8")).resolves.toContain("Advisory workspace metadata only.");
  });

  it("reads and writes only safe tenant-scoped workspace files", async () => {
    const scope = await initializedScope();
    const written = await writeProposalFile(scope, "/workspaces/tenant_1/proposals/proposal_1/SKILL.md", "# Skill\n");
    const read = await readWorkspaceFile(scope, "/workspaces/tenant_1/proposals/proposal_1/SKILL.md");

    expect(written.zone).toBe("proposals");
    expect(read).toMatchObject({ content: "# Skill\n", fileKind: "markdown", zone: "proposals" });

    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/active/skills/SKILL.md", "# Active\n"),
      "operation_not_allowed"
    );
    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/audit/workspace-events.jsonl", "{}\n"),
      "operation_not_allowed"
    );
    await expectWorkspaceError(
      readWorkspaceFile(scope, "/workspaces/tenant_2/proposals/proposal_1/SKILL.md"),
      "tenant_scope_mismatch"
    );
    await expectWorkspaceError(
      readWorkspaceFile(scope, "/workspaces/tenant_1/proposals/proposal_1/../SKILL.md"),
      "unsafe_path"
    );
    await expectWorkspaceError(readWorkspaceFile(scope, path.join(scope.rootDir, "secret.md")), "invalid_logical_path");
    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/proposals/proposal_1/.env", "TOKEN=1"),
      "blocked_path"
    );
    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/proposals/proposal_1/private.key", "secret"),
      "blocked_path"
    );
    await expectWorkspaceError(
      writeProposalFile({ ...scope, maxBytes: 4 }, "/workspaces/tenant_1/proposals/proposal_1/notes.md", "too large"),
      "file_too_large"
    );
  });

  it("rejects symlink escapes before read or proposal write side effects", async () => {
    const scope = await initializedScope();
    const outsideDir = await tempRoot();
    await writeFile(path.join(outsideDir, "outside.md"), "outside", "utf8");
    await writeFile(path.join(outsideDir, "outside-write.md"), "original", "utf8");
    await mkdir(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1"));
    await symlink(path.join(outsideDir, "outside.md"), path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "outside.md"));
    await symlink(path.join(outsideDir, "outside-write.md"), path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "write-target.md"));
    await symlink(outsideDir, path.join(scope.rootDir, "workspaces", tenantId, "proposals", "linked"));

    await expectWorkspaceError(
      readWorkspaceFile(scope, "/workspaces/tenant_1/proposals/proposal_1/outside.md"),
      "symlink_escape"
    );
    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/proposals/proposal_1/write-target.md", "mutated"),
      "symlink_escape"
    );
    await expect(readFile(path.join(outsideDir, "outside-write.md"), "utf8")).resolves.toBe("original");
    await expectWorkspaceError(
      writeProposalFile(scope, "/workspaces/tenant_1/proposals/linked/nested/SKILL.md", "# Escape\n"),
      "symlink_escape"
    );
    await expect(stat(path.join(outsideDir, "nested"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("validates skill proposal completeness from required risk, eval, and status artifacts", async () => {
    const scope = await initializedScope();
    const proposalRoot = "/workspaces/tenant_1/proposals/proposal_1";

    await writeProposalFile(scope, `${proposalRoot}/SKILL.md`, "# Proposed Skill\n");
    await expect(validateSkillProposalCompleteness(scope, "proposal_1")).resolves.toMatchObject({
      complete: false,
      missing: ["eval-fixtures.json", "risk-report.md", "status.json"],
      invalid: []
    });

    await writeProposalFile(scope, `${proposalRoot}/eval-fixtures.json`, JSON.stringify([{ input: "hello", expected: "safe" }]));
    await writeProposalFile(scope, `${proposalRoot}/risk-report.md`, "# Risk\n\nNo production mutation.\n");
    await writeProposalFile(scope, `${proposalRoot}/status.json`, JSON.stringify({ state: "ready_for_review" }));
    await expect(validateSkillProposalCompleteness(scope, "proposal_1")).resolves.toMatchObject({
      complete: true,
      missing: [],
      invalid: [],
      statusState: "ready_for_review"
    });

    await writeProposalFile(scope, `${proposalRoot}/status.json`, JSON.stringify({ state: "active" }));
    await expect(validateSkillProposalCompleteness(scope, "proposal_1")).resolves.toMatchObject({
      complete: false,
      invalid: ["status.json"]
    });
  });

  it("exports a minimal resolver surface without embedding actor policy", async () => {
    const scope = await initializedScope();
    await writeProposalFile(scope, "/workspaces/tenant_1/proposals/proposal_1/manifest.json", "{}\n");

    await expect(resolveTenantPath(scope, "/workspaces/tenant_1/proposals/proposal_1/manifest.json", "read")).resolves.toMatchObject({
      tenantId: "tenant_1",
      zone: "proposals",
      fileKind: "json",
      relativePath: "proposals/proposal_1/manifest.json"
    });
  });
});

async function initializedScope(): Promise<TenantScope> {
  const rootDir = await tempRoot();
  await createTenantWorkspace(rootDir, tenantId);
  return { rootDir, tenantId };
}

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "pms-agent-workspace-core-"));
}

async function expectWorkspaceError(promise: Promise<unknown>, code: WorkspaceError["code"]): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "WorkspaceError", code });
}
