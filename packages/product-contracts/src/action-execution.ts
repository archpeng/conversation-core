import { validateAgentTask, type AgentTask } from "./agent-task.js";
import { asRecord, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";
import { mobileActorRoles, type MobileActorRole } from "./mobile-turn.js";

export const actionCardExecutionActions = ["confirm", "cancel"] as const;

export type ActionCardExecutionAction = (typeof actionCardExecutionActions)[number];

export type ActionCardExecutionInput = {
  sessionId: string;
  tenantId: string;
  propertyId: string;
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
  requireNonEmptyString(value.sessionId, "sessionId", issues);
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireNonEmptyString(value.propertyId, "propertyId", issues);
  const actor = asRecord(value.actor);
  if (!actor) {
    issues.push("actor must be an object");
  } else {
    requireOneOf(actor.role, mobileActorRoles, "actor.role", issues);
    requireNonEmptyString(actor.id, "actor.id", issues);
    requireOptionalString(actor.displayName, "actor.displayName", issues);
  }
  requireOptionalString(value.reason, "reason", issues);
  if (issues.length > 0 || !actor || typeof value.sessionId !== "string" || typeof value.tenantId !== "string" || typeof value.propertyId !== "string" || typeof actor.role !== "string" || typeof actor.id !== "string") return { ok: false, issues };
  return {
    ok: true,
    value: {
      sessionId: value.sessionId,
      tenantId: value.tenantId,
      propertyId: value.propertyId,
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
