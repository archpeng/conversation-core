import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MAX_WORKSPACE_FILE_BYTES,
  WorkspaceError,
  type TenantScope,
  type TenantWorkspace,
  type WorkspaceReadResult,
  type WorkspaceWriteResult
} from "./types.js";
import { assertIdentifier, prepareWritablePathWithinTenant, resolveTenantPath, tenantRootFor } from "./path-policy.js";

export async function createTenantWorkspace(rootDir: string, tenantId: string): Promise<TenantWorkspace> {
  assertIdentifier("tenantId", tenantId);
  const tenantRoot = tenantRootFor(rootDir, tenantId);

  await mkdir(path.join(tenantRoot, "active", "skills"), { recursive: true });
  await mkdir(path.join(tenantRoot, "active", "policies"), { recursive: true });
  await mkdir(path.join(tenantRoot, "proposals"), { recursive: true });
  await mkdir(path.join(tenantRoot, "sessions"), { recursive: true });
  await mkdir(path.join(tenantRoot, "memory", "advisory-notes"), { recursive: true });
  await mkdir(path.join(tenantRoot, "evals"), { recursive: true });
  await mkdir(path.join(tenantRoot, "audit"), { recursive: true });
  await mkdir(path.join(tenantRoot, "tmp"), { recursive: true });

  await writeFile(path.join(tenantRoot, "README.md"), `# Tenant Workspace\n\ntenantId=${tenantId}\n`, { flag: "wx" }).catch(ignoreAlreadyExists);
  await writeFile(path.join(tenantRoot, "PROFILE.md"), "# Tenant Profile\n\nAdvisory workspace metadata only.\n", { flag: "wx" }).catch(ignoreAlreadyExists);
  await writeFile(path.join(tenantRoot, "audit", "workspace-events.jsonl"), "", { flag: "wx" }).catch(ignoreAlreadyExists);

  return { tenantId, logicalRoot: `/workspaces/${tenantId}/`, localRoot: tenantRoot };
}

export async function readWorkspaceFile(scope: TenantScope, logicalPath: string): Promise<WorkspaceReadResult> {
  const resolved = await resolveTenantPath(scope, logicalPath, "read");
  const fileStat = await stat(resolved.localPath).catch(() => {
    throw new WorkspaceError("not_found", "Workspace file does not exist.");
  });
  if (!fileStat.isFile()) throw new WorkspaceError("unsupported_zone", "Workspace read target must be a file.");
  if (fileStat.size > resolved.maxBytes) throw new WorkspaceError("file_too_large", "Workspace file exceeds the configured read limit.");
  const content = await readFile(resolved.localPath, "utf8");
  return { ...resolved, content, bytes: Buffer.byteLength(content, "utf8") };
}

export async function writeProposalFile(scope: TenantScope, logicalPath: string, content: string): Promise<WorkspaceWriteResult> {
  const bytes = Buffer.byteLength(content, "utf8");
  const maxBytes = scope.maxBytes ?? DEFAULT_MAX_WORKSPACE_FILE_BYTES;
  if (bytes > maxBytes) throw new WorkspaceError("file_too_large", "Workspace file exceeds the configured write limit.");

  const resolved = await resolveTenantPath(scope, logicalPath, "write_proposal");
  await prepareWritablePathWithinTenant(resolved.localPath, resolved.tenantRoot, resolved.relativePath);
  await writeFile(resolved.localPath, content, "utf8");
  return { ...resolved, bytes };
}

function ignoreAlreadyExists(error: unknown): void {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") return;
  throw error;
}
