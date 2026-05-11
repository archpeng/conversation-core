import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AgentServiceRuntimeConfig = {
  host: string;
  port: number;
  inboundAuthToken?: string;
  pmsPlatformBaseUrl: string;
  pmsPlatformAuthToken?: string;
  proposalWorkspacePath: string;
  cwd: string;
  piMode: "real" | "stub";
  piSessionMode: "memory" | "persistent";
  piAgentDir: string;
  piSessionDir: string;
  piModelProvider?: string;
  piModelId?: string;
  logTurnEvents: boolean;
  safetyAuditLogPath: string;
  maxInboundBodyBytes: number;
  defaultHotelId: string;
  defaultPropertyId: string;
  defaultRoomId: string;
  defaultGuestName: string;
  defaultCheckInDate: string;
  defaultCheckOutDate: string;
  defaultRoomType?: string;
};

type Env = Record<string, string | undefined>;

export function loadAgentServiceRuntimeConfig(env: Env = process.env): AgentServiceRuntimeConfig {
  const cwd = resolve(env.PMS_AGENT_CWD?.trim() || defaultRuntimeCwd(process.cwd()));
  const checkInDate = env.PMS_AGENT_DEFAULT_CHECK_IN_DATE?.trim() || todayIsoDate();
  const checkOutDate = env.PMS_AGENT_DEFAULT_CHECK_OUT_DATE?.trim() || addBusinessDays(checkInDate, 1);
  return {
    host: env.PMS_AGENT_SERVICE_HOST?.trim() || "127.0.0.1",
    port: parsePort(env.PMS_AGENT_SERVICE_PORT, 8792),
    inboundAuthToken: env.PMS_AGENT_AUTH_TOKEN?.trim() || undefined,
    pmsPlatformBaseUrl: env.PMS_PLATFORM_BASE_URL?.trim() || "http://127.0.0.1:8791",
    pmsPlatformAuthToken: env.PMS_PLATFORM_AUTH_TOKEN?.trim() || undefined,
    proposalWorkspacePath: resolve(cwd, env.PMS_AGENT_PROPOSAL_WORKSPACE?.trim() || ".local/pms-agent-proposals"),
    cwd,
    piMode: env.PMS_AGENT_PI_MODE === "stub" ? "stub" : "real",
    piSessionMode: env.PMS_AGENT_PI_SESSION_MODE === "memory" ? "memory" : "persistent",
    piAgentDir: resolve(cwd, env.PMS_AGENT_PI_AGENT_DIR?.trim() || ".local/pi-agent"),
    piSessionDir: resolve(cwd, env.PMS_AGENT_PI_SESSION_DIR?.trim() || ".local/pi-agent/sessions"),
    piModelProvider: env.PMS_AGENT_PI_MODEL_PROVIDER?.trim() || undefined,
    piModelId: env.PMS_AGENT_PI_MODEL_ID?.trim() || undefined,
    logTurnEvents: env.PMS_AGENT_LOG_TURN_EVENTS === "true",
    safetyAuditLogPath: resolve(cwd, env.PMS_AGENT_SAFETY_AUDIT_LOG?.trim() || ".local/pms-agent-audit/safety-audit.jsonl"),
    maxInboundBodyBytes: parsePositiveInteger(env.PMS_AGENT_MAX_BODY_BYTES, 256 * 1024),
    defaultHotelId: env.PMS_AGENT_DEFAULT_HOTEL_ID?.trim() || "property-small-hotel",
    defaultPropertyId: env.PMS_AGENT_DEFAULT_PROPERTY_ID?.trim() || "property-small-hotel",
    defaultRoomId: env.PMS_AGENT_DEFAULT_ROOM_ID?.trim() || "room-A1",
    defaultGuestName: env.PMS_AGENT_DEFAULT_GUEST_NAME?.trim() || "Feishu Guest",
    defaultCheckInDate: checkInDate,
    defaultCheckOutDate: checkOutDate,
    defaultRoomType: env.PMS_AGENT_DEFAULT_ROOM_TYPE?.trim() || undefined
  };
}

function defaultRuntimeCwd(processCwd: string): string {
  const normalized = resolve(processCwd);
  if (normalized.endsWith("/apps/agent-service")) return resolve(normalized, "../..");
  return normalized;
}

function parsePort(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : fallback;
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addBusinessDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isMainModule(metaUrl: string): boolean {
  return metaUrl === `file://${process.argv[1]}` || fileURLToPath(metaUrl) === process.argv[1];
}
