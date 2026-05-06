import { mkdir, realpath, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const WORKSPACE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const DEFAULT_MAX_WORKSPACE_FILE_BYTES = 256 * 1024;

const REQUIRED_SKILL_PROPOSAL_FILES = ["SKILL.md", "eval-fixtures.json", "risk-report.md", "status.json"] as const;
const ALLOWED_STATUS_STATES = new Set(["draft", "ready_for_review", "rejected"]);
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

export type TenantScope = {
  rootDir: string;
  tenantId: string;
  maxBytes?: number;
};

export type WorkspaceZone =
  | "metadata"
  | "active_skills"
  | "active_policies"
  | "proposals"
  | "sessions"
  | "memory_advisory"
  | "evals"
  | "audit"
  | "tmp";

export type WorkspaceOperation = "read" | "write_proposal";
export type WorkspaceFileKind = "markdown" | "json" | "jsonl";
export type ProposalStatusState = "draft" | "ready_for_review" | "rejected";

export type TenantWorkspace = {
  tenantId: string;
  logicalRoot: string;
  localRoot: string;
};

export type ResolvedTenantPath = {
  tenantId: string;
  logicalPath: string;
  localPath: string;
  tenantRoot: string;
  relativePath: string;
  zone: WorkspaceZone;
  fileKind: WorkspaceFileKind;
  maxBytes: number;
};

export type WorkspaceReadResult = ResolvedTenantPath & {
  content: string;
  bytes: number;
};

export type WorkspaceWriteResult = ResolvedTenantPath & {
  bytes: number;
};

export type ProposalCompletenessResult = {
  proposalId: string;
  proposalPath: string;
  complete: boolean;
  missing: string[];
  invalid: string[];
  statusState?: ProposalStatusState;
};

export type WorkspaceErrorCode =
  | "invalid_identifier"
  | "invalid_logical_path"
  | "tenant_scope_mismatch"
  | "unsafe_path"
  | "blocked_path"
  | "unsupported_file_kind"
  | "unsupported_zone"
  | "operation_not_allowed"
  | "file_too_large"
  | "symlink_escape"
  | "not_found"
  | "invalid_proposal";

export class WorkspaceError extends Error {
  constructor(readonly code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

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

export async function validateSkillProposalCompleteness(scope: TenantScope, proposalId: string): Promise<ProposalCompletenessResult> {
  assertIdentifier("proposalId", proposalId);
  const result: ProposalCompletenessResult = {
    proposalId,
    proposalPath: `/workspaces/${scope.tenantId}/proposals/${proposalId}/`,
    complete: false,
    missing: [],
    invalid: []
  };

  const files = new Map<string, string>();
  for (const filename of REQUIRED_SKILL_PROPOSAL_FILES) {
    const logicalPath = `/workspaces/${scope.tenantId}/proposals/${proposalId}/${filename}`;
    try {
      const read = await readWorkspaceFile(scope, logicalPath);
      if (read.bytes === 0) result.invalid.push(filename);
      files.set(filename, read.content);
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "not_found") result.missing.push(filename);
      else result.invalid.push(filename);
    }
  }

  const evalFixtures = files.get("eval-fixtures.json");
  if (evalFixtures !== undefined && !isJson(evalFixtures)) result.invalid.push("eval-fixtures.json");

  const status = files.get("status.json");
  if (status !== undefined) {
    const statusState = parseStatusState(status);
    if (statusState) result.statusState = statusState;
    else result.invalid.push("status.json");
  }

  result.invalid = Array.from(new Set(result.invalid));
  result.complete = result.missing.length === 0 && result.invalid.length === 0 && result.statusState !== undefined;
  return result;
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

function assertIdentifier(label: string, value: string): void {
  if (!WORKSPACE_IDENTIFIER_PATTERN.test(value)) throw new WorkspaceError("invalid_identifier", `${label} must match ${WORKSPACE_IDENTIFIER_PATTERN.source}.`);
}

function tenantRootFor(rootDir: string, tenantId: string): string {
  return path.resolve(rootDir, "workspaces", tenantId);
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

async function prepareWritablePathWithinTenant(localPath: string, tenantRoot: string, relativePath: string): Promise<void> {
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

function assertLocalPathInside(realTarget: string, realTenantRoot: string): void {
  const relative = path.relative(realTenantRoot, realTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  throw new WorkspaceError("symlink_escape", "Workspace path resolves outside the tenant root.");
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function parseStatusState(value: string): ProposalStatusState | undefined {
  try {
    const parsed = JSON.parse(value) as { state?: unknown; status?: unknown };
    const state = typeof parsed.state === "string" ? parsed.state : parsed.status;
    if (typeof state === "string" && ALLOWED_STATUS_STATES.has(state)) return state as ProposalStatusState;
    return undefined;
  } catch {
    return undefined;
  }
}

function ignoreAlreadyExists(error: unknown): void {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") return;
  throw error;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
