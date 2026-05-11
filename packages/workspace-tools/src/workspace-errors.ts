export class WorkspaceToolError extends Error {
  constructor(readonly code: "invalid_input" | "edit_match_not_found" | "edit_match_ambiguous" | "symlink_escape", message: string) {
    super(message);
    this.name = "WorkspaceToolError";
  }
}
