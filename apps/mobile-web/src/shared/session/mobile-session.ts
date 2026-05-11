import type { MobileActorRole } from "@pms-agent-v2/product-contracts";

export type MobileSessionContext = {
  sessionId: string;
  actor: {
    role: MobileActorRole;
    id: string;
    displayName?: string;
  };
};

const roles: readonly MobileActorRole[] = ["customer", "staff", "manager", "admin", "internal"];

export function defaultMobileSession(): MobileSessionContext {
  const role = mobileActorRole(import.meta.env.VITE_MOBILE_ACTOR_ROLE);
  const displayName = textEnv(import.meta.env.VITE_MOBILE_ACTOR_DISPLAY_NAME);
  return {
    sessionId: textEnv(import.meta.env.VITE_MOBILE_SESSION_ID) ?? "mobile-web-session",
    actor: {
      role,
      id: textEnv(import.meta.env.VITE_MOBILE_ACTOR_ID) ?? "mobile-web-staff",
      ...(displayName ? { displayName } : {})
    }
  };
}

function mobileActorRole(value: unknown): MobileActorRole {
  return isMobileActorRole(value) ? value : "staff";
}

function textEnv(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isMobileActorRole(value: unknown): value is MobileActorRole {
  return typeof value === "string" && roles.some((role) => role === value);
}
