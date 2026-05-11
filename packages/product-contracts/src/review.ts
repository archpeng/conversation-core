import { validateAgentTask, type AgentTask } from "./agent-task.js";
import { asRecord, optionalStringArray, requireNonEmptyString, requireOneOf, type Validation } from "./field-checks.js";

export const reviewActionStatuses = ["committed", "rejected", "failed", "expired"] as const;

export type ReviewActionStatus = (typeof reviewActionStatuses)[number];

export type ReviewActionSummary = {
  taskId: string;
  title: string;
  status: ReviewActionStatus;
  updatedAt: string;
  evidenceRefs: string[];
  safetyAuditRefs: string[];
  pmsAuditRefs: string[];
};

export type ReviewActionDetail = ReviewActionSummary & {
  task: AgentTask;
  actor?: {
    role?: string;
    id?: string;
    displayName?: string;
  };
};

export type ReviewActionListResponse = {
  ok: true;
  actions: ReviewActionSummary[];
};

export type ReviewActionDetailResponse = {
  ok: true;
  action: ReviewActionDetail;
};

export function validateReviewActionListResponse(input: unknown): Validation<ReviewActionListResponse> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["response must be an object"] };
  if (value.ok !== true) issues.push("ok must be true");
  const actions = parseSummaries(value.actions, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { ok: true, actions } };
}

export function validateReviewActionDetailResponse(input: unknown): Validation<ReviewActionDetailResponse> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["response must be an object"] };
  if (value.ok !== true) issues.push("ok must be true");
  const action = parseDetail(value.action, "action", issues);
  if (issues.length > 0 || !action) return { ok: false, issues };
  return { ok: true, value: { ok: true, action } };
}

function parseSummaries(input: unknown, issues: string[]): ReviewActionSummary[] {
  if (!Array.isArray(input)) {
    issues.push("actions must be an array");
    return [];
  }
  return input.flatMap((item, index) => {
    const summary = parseSummary(item, `actions[${index}]`, issues);
    return summary ? [summary] : [];
  });
}

function parseDetail(input: unknown, field: string, issues: string[]): ReviewActionDetail | undefined {
  const summary = parseSummary(input, field, issues);
  const value = asRecord(input);
  if (!summary || !value) return undefined;
  const task = validateAgentTask(value.task);
  if (!task.ok) issues.push(...task.issues.map((issue) => `${field}.task.${issue}`));
  if (!task.ok) return undefined;
  const actor = parseActor(value.actor);
  return {
    ...summary,
    task: task.value,
    ...(actor ? { actor } : {})
  };
}

function parseSummary(input: unknown, field: string, issues: string[]): ReviewActionSummary | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object`);
    return undefined;
  }
  requireNonEmptyString(value.taskId, `${field}.taskId`, issues);
  requireNonEmptyString(value.title, `${field}.title`, issues);
  requireOneOf(value.status, reviewActionStatuses, `${field}.status`, issues);
  requireNonEmptyString(value.updatedAt, `${field}.updatedAt`, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, `${field}.evidenceRefs`, issues) ?? [];
  const safetyAuditRefs = optionalStringArray(value.safetyAuditRefs, `${field}.safetyAuditRefs`, issues) ?? [];
  const pmsAuditRefs = optionalStringArray(value.pmsAuditRefs, `${field}.pmsAuditRefs`, issues) ?? [];
  if (typeof value.taskId !== "string" || typeof value.title !== "string" || typeof value.status !== "string" || typeof value.updatedAt !== "string") return undefined;
  return {
    taskId: value.taskId,
    title: value.title,
    status: value.status as ReviewActionStatus,
    updatedAt: value.updatedAt,
    evidenceRefs,
    safetyAuditRefs,
    pmsAuditRefs
  };
}

function parseActor(input: unknown): ReviewActionDetail["actor"] | undefined {
  const value = asRecord(input);
  if (!value) return undefined;
  return {
    ...(typeof value.role === "string" ? { role: value.role } : {}),
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    ...(typeof value.displayName === "string" ? { displayName: value.displayName } : {})
  };
}
