import { validateAgentTask, type AgentTask } from "./agent-task.js";
import { asRecord, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";
import { mobileActorRoles, type MobileActorRole } from "./mobile-turn.js";

export const actionCardExecutionActions = ["confirm", "cancel"] as const;

export type ActionCardExecutionAction = (typeof actionCardExecutionActions)[number];

export type ActionCardExecutionInput = {
  actor: {
    role: MobileActorRole;
    id: string;
    displayName?: string;
  };
  reason?: string;
};

export type ActionCardExecutionResponse = {
  ok: true;
  task: AgentTask;
};

export function validateActionCardExecutionInput(input: unknown): Validation<ActionCardExecutionInput> {
  const issues: string[] = [];
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["input must be an object"] };
  const actor = asRecord(value.actor);
  if (!actor) {
    issues.push("actor must be an object");
  } else {
    requireOneOf(actor.role, mobileActorRoles, "actor.role", issues);
    requireNonEmptyString(actor.id, "actor.id", issues);
    requireOptionalString(actor.displayName, "actor.displayName", issues);
  }
  requireOptionalString(value.reason, "reason", issues);
  if (issues.length > 0 || !actor || typeof actor.role !== "string" || typeof actor.id !== "string") return { ok: false, issues };
  return {
    ok: true,
    value: {
      actor: {
        role: actor.role as MobileActorRole,
        id: actor.id,
        ...(typeof actor.displayName === "string" ? { displayName: actor.displayName } : {})
      },
      ...(typeof value.reason === "string" ? { reason: value.reason } : {})
    }
  };
}

export function validateActionCardExecutionResponse(input: unknown): Validation<ActionCardExecutionResponse> {
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["response must be an object"] };
  const issues: string[] = [];
  if (value.ok !== true) issues.push("ok must be true");
  const task = validateAgentTask(value.task);
  if (!task.ok) issues.push(...task.issues.map((issue) => `task.${issue}`));
  if (issues.length > 0 || !task.ok) return { ok: false, issues };
  return { ok: true, value: { ok: true, task: task.value } };
}
