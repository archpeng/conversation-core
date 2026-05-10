export const WORKSPACE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const DEFAULT_MAX_WORKSPACE_FILE_BYTES = 256 * 1024;

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
