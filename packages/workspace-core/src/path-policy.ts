import { mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MAX_WORKSPACE_FILE_BYTES,
  WORKSPACE_IDENTIFIER_PATTERN,
  WorkspaceError,
  type ResolvedTenantPath,
  type TenantScope,
  type WorkspaceFileKind,
  type WorkspaceOperation,
  type WorkspaceZone
} from "./types.js";

const ALLOWED_EXTENSIONS = new Set([".md", ".json", ".jsonl"]);
const BLOCKED_EXACT_SEGMENTS = new Set([
  ".env",
  ".ssh",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "private-key",
  "secret",
  "token",
  "credential",
  "production",
  "root"
]);
const BLOCKED_EXTENSIONS = [".pem", ".key", ".p12", ".pfx", ".crt"];

export async function resolveTenantPath(scope: TenantScope, logicalPath: string, operation: WorkspaceOperation): Promise<ResolvedTenantPath> {
  const parsed = parseLogicalPath(scope, logicalPath);
  const zone = classifyZone(parsed.relativeSegments);
  const fileKind = classifyFileKind(parsed.relativeSegments.at(-1));

  if (operation === "write_proposal" && zone !== "proposals") {
    throw new WorkspaceError("operation_not_allowed", "Workspace core writes are proposal-zone only in W1.");
  }
  if (operation === "write_proposal" && parsed.relativeSegments.length < 3) {
    throw new WorkspaceError("operation_not_allowed", "Proposal writes must target a file under /proposals/{proposalId}/.");
  }
  if (operation === "read" && zone === "tmp") {
    throw new WorkspaceError("operation_not_allowed", "tmp files are not direct workspace read targets.");
  }
  if (zone === "active_skills" || zone === "active_policies" || zone === "audit") {
    if (operation === "write_proposal") throw new WorkspaceError("operation_not_allowed", "Active and audit zones cannot be written by proposal operations.");
  }

  const tenantRoot = tenantRootFor(scope.rootDir, scope.tenantId);
  const localPath = path.join(tenantRoot, ...parsed.relativeSegments);
  const maxBytes = scope.maxBytes ?? DEFAULT_MAX_WORKSPACE_FILE_BYTES;
  const resolved: ResolvedTenantPath = {
    tenantId: scope.tenantId,
    logicalPath,
    localPath,
    tenantRoot,
    relativePath: parsed.relativeSegments.join("/"),
    zone,
    fileKind,
    maxBytes
  };

  if (operation === "read") await assertExistingPathWithinTenant(resolved.localPath, tenantRoot);
  return resolved;
}

export function assertIdentifier(label: string, value: string): void {
  if (!WORKSPACE_IDENTIFIER_PATTERN.test(value)) throw new WorkspaceError("invalid_identifier", `${label} must match ${WORKSPACE_IDENTIFIER_PATTERN.source}.`);
}

export function tenantRootFor(rootDir: string, tenantId: string): string {
  return path.resolve(rootDir, "workspaces", tenantId);
}

export async function prepareWritablePathWithinTenant(localPath: string, tenantRoot: string, relativePath: string): Promise<void> {
  const realTenantRoot = await realpath(tenantRoot).catch(() => {
    throw new WorkspaceError("not_found", "Tenant workspace is not initialized.");
  });

  const parentSegments = relativePath.split("/").slice(0, -1);
  let current = tenantRoot;
  for (const segment of parentSegments) {
    current = path.join(current, segment);
    const existingRealPath = await realpath(current).catch((error: unknown) => {
      if (isNotFoundError(error)) return undefined;
      throw error;
    });
    if (existingRealPath) {
      assertLocalPathInside(existingRealPath, realTenantRoot);
      const currentStat = await stat(current);
      if (!currentStat.isDirectory()) throw new WorkspaceError("unsupported_zone", "Workspace write parent must be a directory.");
      continue;
    }
    await mkdir(current);
    assertLocalPathInside(await realpath(current), realTenantRoot);
  }

  const existingTargetRealPath = await realpath(localPath).catch((error: unknown) => {
    if (isNotFoundError(error)) return undefined;
    throw error;
  });
  if (existingTargetRealPath) assertLocalPathInside(existingTargetRealPath, realTenantRoot);
}

function parseLogicalPath(scope: TenantScope, logicalPath: string): { tenantId: string; relativeSegments: string[] } {
  assertIdentifier("tenantId", scope.tenantId);
  if (!logicalPath.startsWith("/workspaces/")) {
    throw new WorkspaceError("invalid_logical_path", "Workspace path must be a logical /workspaces/{tenantId}/ path.");
  }
  if (logicalPath.includes("\\") || /\/\//.test(logicalPath.slice(1))) {
    throw new WorkspaceError("unsafe_path", "Workspace path contains ambiguous separators.");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(logicalPath);
  } catch {
    throw new WorkspaceError("unsafe_path", "Workspace path contains invalid encoding.");
  }
  if (decoded !== logicalPath) throw new WorkspaceError("unsafe_path", "Workspace path must not use encoded segments.");

  const segments = logicalPath.split("/").slice(1);
  if (segments[0] !== "workspaces" || segments.length < 3) {
    throw new WorkspaceError("invalid_logical_path", "Workspace path must include a tenant identifier and file target.");
  }

  const tenantId = segments[1];
  assertIdentifier("path tenantId", tenantId);
  if (tenantId !== scope.tenantId) throw new WorkspaceError("tenant_scope_mismatch", "Workspace path tenant does not match the request scope.");

  const relativeSegments = segments.slice(2);
  if (relativeSegments.length === 0 || relativeSegments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new WorkspaceError("unsafe_path", "Workspace path must not contain empty, current, or parent segments.");
  }
  for (const segment of relativeSegments) assertSafeSegment(segment);
  return { tenantId, relativeSegments };
}

function classifyZone(relativeSegments: string[]): WorkspaceZone {
  const [first, second] = relativeSegments;
  if ((first === "README.md" || first === "PROFILE.md") && relativeSegments.length === 1) return "metadata";
  if (first === "active" && second === "skills" && relativeSegments.length >= 3) return "active_skills";
  if (first === "active" && second === "policies" && relativeSegments.length >= 3) return "active_policies";
  if (first === "proposals" && relativeSegments.length >= 3) {
    assertIdentifier("proposalId", relativeSegments[1]);
    return "proposals";
  }
  if (first === "sessions" && relativeSegments.length >= 3) {
    assertIdentifier("sessionId", relativeSegments[1]);
    return "sessions";
  }
  if (first === "memory" && second === "advisory-notes" && relativeSegments.length >= 3) return "memory_advisory";
  if (first === "evals" && relativeSegments.length >= 3) {
    assertIdentifier("runId", relativeSegments[1]);
    return "evals";
  }
  if (first === "audit" && relativeSegments.length === 2 && relativeSegments[1] === "workspace-events.jsonl") return "audit";
  if (first === "tmp" && relativeSegments.length >= 3) {
    assertIdentifier("runId", relativeSegments[1]);
    return "tmp";
  }
  throw new WorkspaceError("unsupported_zone", "Workspace path targets an unsupported W1 zone.");
}

function classifyFileKind(filename: string | undefined): WorkspaceFileKind {
  if (!filename) throw new WorkspaceError("unsupported_file_kind", "Workspace path must target a file.");
  const extension = path.extname(filename);
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new WorkspaceError("unsupported_file_kind", "Workspace file extension is not allowed.");
  if (extension === ".md") return "markdown";
  if (extension === ".json") return "json";
  return "jsonl";
}

function assertSafeSegment(segment: string): void {
  const lower = segment.toLowerCase();
  if (lower.startsWith(".env.")) throw new WorkspaceError("blocked_path", "Workspace path targets an environment file.");
  if (BLOCKED_EXACT_SEGMENTS.has(lower)) throw new WorkspaceError("blocked_path", "Workspace path contains a blocked segment.");
  if (lower.startsWith(".") && lower !== ".well-known") throw new WorkspaceError("blocked_path", "Workspace path contains a hidden segment.");
  if (BLOCKED_EXTENSIONS.some((extension) => lower.endsWith(extension))) throw new WorkspaceError("blocked_path", "Workspace path contains a blocked extension.");
}

async function assertExistingPathWithinTenant(localPath: string, tenantRoot: string): Promise<void> {
  const [realTenantRoot, realTarget] = await Promise.all([
    realpath(tenantRoot).catch(() => {
      throw new WorkspaceError("not_found", "Tenant workspace is not initialized.");
    }),
    realpath(localPath).catch(() => {
      throw new WorkspaceError("not_found", "Workspace file does not exist.");
    })
  ]);
  assertLocalPathInside(realTarget, realTenantRoot);
}

function assertLocalPathInside(realTarget: string, realTenantRoot: string): void {
  const relative = path.relative(realTenantRoot, realTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  throw new WorkspaceError("symlink_escape", "Workspace path resolves outside the tenant root.");
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
