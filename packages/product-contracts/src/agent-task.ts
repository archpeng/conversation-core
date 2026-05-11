import { parseActionCards, type ActionCard } from "./action-card.js";
import { asRecord, optionalStringArray, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";
import { parseObjectRefs, type ObjectRef } from "./object-ref.js";

export const agentTaskStatuses = ["suggested", "needs_slots", "draft_ready", "awaiting_confirmation", "committed", "rejected", "failed", "expired", "read_only"] as const;
export const agentTaskSources = ["agent", "pms", "gateway"] as const;

export type AgentTaskStatus = (typeof agentTaskStatuses)[number];
export type AgentTaskSource = (typeof agentTaskSources)[number];

export type AgentTask = {
  id: string;
  title: string;
  summary: string;
  status: AgentTaskStatus;
  source: AgentTaskSource;
  createdAt: string;
  updatedAt: string;
  evidenceRefs?: string[];
  auditRefs?: string[];
  objectRefs?: ObjectRef[];
  actionCards?: ActionCard[];
  messages?: string[];
};

export function validateAgentTask(input: unknown): Validation<AgentTask> {
  const issues: string[] = [];
  const task = parseAgentTask(input, "task", issues);
  if (issues.length > 0 || !task) return { ok: false, issues };
  return { ok: true, value: task };
}

export function parseAgentTasks(input: unknown, field: string, issues: string[]): AgentTask[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    issues.push(`${field} must be an array when present`);
    return undefined;
  }
  const tasks: AgentTask[] = [];
  for (const [index, item] of input.entries()) {
    const task = parseAgentTask(item, `${field}[${index}]`, issues);
    if (task) tasks.push(task);
  }
  return tasks;
}

function parseAgentTask(input: unknown, field: string, issues: string[]): AgentTask | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push(`${field} must be an object`);
    return undefined;
  }
  requireNonEmptyString(value.id, `${field}.id`, issues);
  requireNonEmptyString(value.title, `${field}.title`, issues);
  requireNonEmptyString(value.summary, `${field}.summary`, issues);
  requireOneOf(value.status, agentTaskStatuses, `${field}.status`, issues);
  requireOneOf(value.source, agentTaskSources, `${field}.source`, issues);
  requireNonEmptyString(value.createdAt, `${field}.createdAt`, issues);
  requireNonEmptyString(value.updatedAt, `${field}.updatedAt`, issues);
  requireOptionalString(value.summary, `${field}.summary`, issues);
  const evidenceRefs = optionalStringArray(value.evidenceRefs, `${field}.evidenceRefs`, issues);
  const auditRefs = optionalStringArray(value.auditRefs, `${field}.auditRefs`, issues);
  const messages = optionalStringArray(value.messages, `${field}.messages`, issues);
  const objectRefs = parseObjectRefs(value.objectRefs, `${field}.objectRefs`, issues);
  const actionCards = parseActionCards(value.actionCards, `${field}.actionCards`, issues);
  if (!canBuildAgentTask(value)) return undefined;
  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    status: value.status as AgentTaskStatus,
    source: value.source as AgentTaskSource,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(auditRefs ? { auditRefs } : {}),
    ...(objectRefs ? { objectRefs } : {}),
    ...(actionCards ? { actionCards } : {}),
    ...(messages ? { messages } : {})
  };
}

function canBuildAgentTask(value: Record<string, unknown>): value is Record<string, string> {
  return typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.summary === "string"
    && typeof value.status === "string"
    && typeof value.source === "string"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && agentTaskStatuses.includes(value.status as AgentTaskStatus)
    && agentTaskSources.includes(value.source as AgentTaskSource);
}
