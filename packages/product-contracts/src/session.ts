import { asRecord, requireNonEmptyString, requireOneOf, requireOptionalString, type Validation } from "./field-checks.js";
import { mobileActorRoles, type MobileActorRole } from "./mobile-turn.js";

export type MobileSession = {
  sessionId: string;
  tenantId: string;
  propertyId: string;
  actor: {
    role: MobileActorRole;
    id: string;
    displayName?: string;
  };
  expiresAt?: string;
};

export type MobileSessionResponse = {
  ok: true;
  session: MobileSession;
};

export function validateMobileSessionResponse(input: unknown): Validation<MobileSessionResponse> {
  const value = asRecord(input);
  if (!value) return { ok: false, issues: ["response must be an object"] };
  const issues: string[] = [];
  if (value.ok !== true) issues.push("ok must be true");
  const session = parseMobileSession(value.session, issues);
  if (issues.length > 0 || !session) return { ok: false, issues };
  return { ok: true, value: { ok: true, session } };
}

function parseMobileSession(input: unknown, issues: string[]): MobileSession | undefined {
  const value = asRecord(input);
  if (!value) {
    issues.push("session must be an object");
    return undefined;
  }
  requireNonEmptyString(value.sessionId, "session.sessionId", issues);
  requireNonEmptyString(value.tenantId, "session.tenantId", issues);
  requireNonEmptyString(value.propertyId, "session.propertyId", issues);
  requireOptionalString(value.expiresAt, "session.expiresAt", issues);
  const actor = asRecord(value.actor);
  if (!actor) {
    issues.push("session.actor must be an object");
    return undefined;
  }
  requireOneOf(actor.role, mobileActorRoles, "session.actor.role", issues);
  requireNonEmptyString(actor.id, "session.actor.id", issues);
  requireOptionalString(actor.displayName, "session.actor.displayName", issues);
  if (!canBuildSession(value, actor)) return undefined;
  const actorId = actor.id;
  if (typeof actorId !== "string") return undefined;
  return {
    sessionId: value.sessionId,
    tenantId: value.tenantId,
    propertyId: value.propertyId,
    actor: {
      role: actor.role as MobileActorRole,
      id: actorId,
      ...(typeof actor.displayName === "string" ? { displayName: actor.displayName } : {})
    },
    ...(typeof value.expiresAt === "string" ? { expiresAt: value.expiresAt } : {})
  };
}

function canBuildSession(value: Record<string, unknown>, actor: Record<string, unknown>): value is Record<string, string> {
  return typeof value.sessionId === "string"
    && typeof value.tenantId === "string"
    && typeof value.propertyId === "string"
    && typeof actor.role === "string"
    && mobileActorRoles.includes(actor.role as MobileActorRole)
    && typeof actor.id === "string";
}
