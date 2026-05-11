import { parseAgentTasks, validateAgentTask, type AgentTask } from "./agent-task.js";
import { asRecord, requireNonEmptyString, requireOneOf, type Validation } from "./field-checks.js";

export const productErrorCodes = ["invalid_request", "unauthorized", "backend_unavailable", "unsupported"] as const;

export type ProductErrorCode = (typeof productErrorCodes)[number];

export type ProductApiError = {
  ok: false;
  code: ProductErrorCode;
  message: string;
};

export type MobileAgentResponse = {
  ok: true;
  task: AgentTask;
};

export type TaskListResponse = {
  ok: true;
  tasks: AgentTask[];
};

export type ProductApiResponse = MobileAgentResponse | TaskListResponse | ProductApiError;

export function productError(code: ProductErrorCode, message: string): ProductApiError {
  return { ok: false, code, message };
}

export function validateMobileAgentResponse(input: unknown): Validation<MobileAgentResponse> {
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["response must be an object"] };
  const issues: string[] = [];
  if (value.ok !== true) issues.push("ok must be true");
  const task = validateAgentTask(value.task);
  if (!task.ok) issues.push(...task.issues.map((issue) => `task.${issue}`));
  if (issues.length > 0 || !task.ok) return { ok: false, issues };
  return { ok: true, value: { ok: true, task: task.value } };
}

export function validateTaskListResponse(input: unknown): Validation<TaskListResponse> {
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["response must be an object"] };
  const issues: string[] = [];
  if (value.ok !== true) issues.push("ok must be true");
  const tasks = parseAgentTasks(value.tasks, "tasks", issues);
  if (issues.length > 0 || !tasks) return { ok: false, issues };
  return { ok: true, value: { ok: true, tasks } };
}

export function validateProductApiError(input: unknown): Validation<ProductApiError> {
  const value = asRecord(input);
  const issues: string[] = [];
  if (!value) return { ok: false, issues: ["error must be an object"] };
  if (value.ok !== false) issues.push("ok must be false");
  requireOneOf(value.code, productErrorCodes, "code", issues);
  requireNonEmptyString(value.message, "message", issues);
  if (issues.length > 0 || typeof value.code !== "string" || typeof value.message !== "string") return { ok: false, issues };
  return { ok: true, value: { ok: false, code: value.code as ProductErrorCode, message: value.message } };
}
