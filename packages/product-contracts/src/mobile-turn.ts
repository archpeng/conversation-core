import { asRecord, requireLiteral, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";

export const mobileActorRoles = ["customer", "staff", "manager", "admin", "internal"] as const;
export const mobileDevicePlatforms = ["web", "ios", "android"] as const;

export type MobileActorRole = (typeof mobileActorRoles)[number];
export type MobileDevicePlatform = (typeof mobileDevicePlatforms)[number];

export type MobileAgentTurnInput = {
  channel: "mobile";
  tenantId: string;
  propertyId?: string;
  sessionId: string;
  messageId: string;
  actor: {
    role: MobileActorRole;
    id: string;
    displayName?: string;
  };
  message: {
    text: string;
  };
  device?: {
    platform?: MobileDevicePlatform;
    locale?: string;
  };
  receivedAt: string;
};

export function validateMobileAgentTurnInput(input: unknown): Validation<MobileAgentTurnInput> {
  const issues: string[] = [];
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["input must be an object"] };

  requireLiteral(value.channel, "mobile", "channel", issues);
  requireNonEmptyString(value.tenantId, "tenantId", issues);
  requireOptionalString(value.propertyId, "propertyId", issues);
  requireNonEmptyString(value.sessionId, "sessionId", issues);
  requireNonEmptyString(value.messageId, "messageId", issues);
  requireNonEmptyString(value.receivedAt, "receivedAt", issues);

  const actor = asRecord(value.actor);
  if (!actor) {
    issues.push("actor must be an object");
  } else {
    requireOneOf(actor.role, mobileActorRoles, "actor.role", issues);
    requireNonEmptyString(actor.id, "actor.id", issues);
    requireOptionalString(actor.displayName, "actor.displayName", issues);
  }

  const message = asRecord(value.message);
  if (!message) {
    issues.push("message must be an object");
  } else {
    requireNonEmptyString(message.text, "message.text", issues);
  }

  validateDevice(value.device, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as MobileAgentTurnInput };
}

export function isMobileAgentTurnInput(input: unknown): input is MobileAgentTurnInput {
  return validateMobileAgentTurnInput(input).ok;
}

function validateDevice(value: unknown, issues: string[]): void {
  if (value === undefined) return;
  const device = asRecord(value);
  if (!device) {
    issues.push("device must be an object when present");
    return;
  }
  if (device.platform !== undefined) requireOneOf(device.platform, mobileDevicePlatforms, "device.platform", issues);
  requireOptionalString(device.locale, "device.locale", issues);
}
