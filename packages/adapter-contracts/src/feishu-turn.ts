import { asRecord, requireLiteral, requireNonEmptyString, requireOptionalString } from "./field-checks.js";

export const feishuActorRoles = ["customer", "staff", "admin", "internal"] as const;

export type FeishuActorRole = (typeof feishuActorRoles)[number];

export type FeishuTurnInput = {
  channel: "feishu";
  tenantId: string;
  sessionId: string;
  messageId: string;
  actor: {
    role: FeishuActorRole;
    id: string;
    displayName?: string;
  };
  message: {
    text: string;
  };
  receivedAt: string;
};

export type FeishuTurnValidation =
  | { ok: true; value: FeishuTurnInput }
  | { ok: false; issues: string[] };

export function validateFeishuTurnInput(input: unknown): FeishuTurnValidation {
  const issues: string[] = [];
  const value = asRecord(input);

  if (!value) {
    return { ok: false, issues: ["input must be an object"] };
  }

  requireLiteral(value.channel, "feishu", "channel", issues);
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireNonEmptyString(value.sessionId, "sessionId", issues);
  requireNonEmptyString(value.messageId, "messageId", issues);
  requireNonEmptyString(value.receivedAt, "receivedAt", issues);

  const actor = asRecord(value.actor);
  if (!actor) {
    issues.push("actor must be an object");
  } else {
    if (!isFeishuActorRole(actor.role)) issues.push("actor.role is invalid");
    requireNonEmptyString(actor.id, "actor.id", issues);
    requireOptionalString(actor.displayName, "actor.displayName", issues);
  }

  const message = asRecord(value.message);
  if (!message) {
    issues.push("message must be an object");
  } else {
    requireNonEmptyString(message.text, "message.text", issues);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as FeishuTurnInput };
}

export function isFeishuTurnInput(input: unknown): input is FeishuTurnInput {
  return validateFeishuTurnInput(input).ok;
}

function isFeishuActorRole(value: unknown): value is FeishuActorRole {
  return typeof value === "string" && feishuActorRoles.includes(value as FeishuActorRole);
}

