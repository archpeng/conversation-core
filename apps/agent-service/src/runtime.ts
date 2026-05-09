import { mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage, createAgentSession, DefaultResourceLoader, ModelRegistry, SessionManager, type ResourceLoader } from "@mariozechner/pi-coding-agent";
import { createAgentService, type AgentService } from "./index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "@pms-agent-v2/safety-gateway";
import type { AgentSessionFactory, AgentSessionFactoryOptions, ResourceLoaderFactory } from "@pms-agent-v2/unified-agent";
import { createRuntimeExecutors, type RuntimeExecutorConfig } from "./executors.js";
export { createRuntimeExecutors, type RuntimeExecutorConfig };

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
  maxInboundBodyBytes: number;
  defaultHotelId: string;
  defaultPropertyId: string;
  defaultRoomId: string;
  defaultGuestName: string;
  defaultCheckInDate: string;
  defaultCheckOutDate: string;
  defaultRoomType?: string;
};

export type StartedAgentHttpServer = {
  server: Server;
  url: string;
  close(): Promise<void>;
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

export function createRuntimeAgentService(config: AgentServiceRuntimeConfig): AgentService {
  return createAgentService({
    gateway: createRuntimeSafetyGateway(),
    createAgentSession: createRuntimePiSessionFactory(config),
    createResourceLoader: createRuntimeResourceLoaderFactory(config),
    cwd: config.cwd,
    piSessionDir: config.piSessionDir,
    executors: createRuntimeExecutors(config),
    eventSink: config.logTurnEvents ? (event) => console.log(JSON.stringify(event)) : undefined
  });
}

export async function startAgentHttpServer(config: AgentServiceRuntimeConfig, service = createRuntimeAgentService(config)): Promise<StartedAgentHttpServer> {
  const server = createServer((request, response) => {
    void handleHttpRequest(config, service, request, response);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(config.port, config.host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://${address.address}:${address.port}`;
  return {
    server,
    url,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })
  };
}

function createRuntimeResourceLoaderFactory(config: AgentServiceRuntimeConfig): ResourceLoaderFactory {
  return async (systemPrompt: string) => {
    ensureRuntimePiDirs(config);
    const loader = new DefaultResourceLoader({
      cwd: config.cwd,
      agentDir: config.piAgentDir,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      systemPromptOverride: () => systemPrompt
    });
    await loader.reload();
    return loader;
  };
}

function createRuntimeSafetyGateway(): SafetyGatewayPort {
  return {
    decide(request: GatedToolRequest): GatedDecision {
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      return { id: event.id };
    }
  };
}

function ensureRuntimePiDirs(config: AgentServiceRuntimeConfig): void {
  mkdirSync(config.piAgentDir, { recursive: true });
  if (config.piSessionMode === "persistent") mkdirSync(config.piSessionDir, { recursive: true });
}

export function createRuntimePiSessionFactory(config: AgentServiceRuntimeConfig, createSession: typeof createAgentSession = createAgentSession): AgentSessionFactory {
  if (config.piMode === "stub") {
    return async () => ({ session: { async prompt() {} } });
  }

  return async (options: AgentSessionFactoryOptions) => {
    ensureRuntimePiDirs(config);
    const authStorage = AuthStorage.create(join(config.piAgentDir, "auth.json"));
    const modelRegistry = ModelRegistry.create(authStorage, join(config.piAgentDir, "models.json"));
    const model = config.piModelProvider && config.piModelId ? modelRegistry.find(config.piModelProvider, config.piModelId) : undefined;
    if (config.piModelProvider && config.piModelId && !model) {
      throw new Error(`model_not_resolved: Pi ModelRegistry could not resolve ${config.piModelProvider}/${config.piModelId}`);
    }
    return piSessionResult(createSession({
      cwd: options.cwd ?? config.cwd,
      agentDir: config.piAgentDir,
      tools: options.tools as string[],
      customTools: options.customTools as never[],
      authStorage,
      modelRegistry,
      ...(options.resourceLoader ? { resourceLoader: options.resourceLoader as ResourceLoader } : {}),
      ...(model ? { model } : {}),
      sessionManager: runtimeSessionManager(config, options.sessionFile)
    }));
  };
}

function piSessionResult(value: ReturnType<typeof createAgentSession>): ReturnType<AgentSessionFactory> {
  // Pi SDK session factory and the local port expose equivalent runtime shapes but distinct type aliases.
  return value as unknown as ReturnType<AgentSessionFactory>;
}

function runtimeSessionManager(config: AgentServiceRuntimeConfig, sessionFile?: string): ReturnType<typeof SessionManager.inMemory> {
  if (config.piSessionMode === "memory") return SessionManager.inMemory(config.cwd);
  if (sessionFile) return SessionManager.open(sessionFile, config.piSessionDir, config.cwd);
  return SessionManager.create(config.cwd, config.piSessionDir);
}

async function handleHttpRequest(config: AgentServiceRuntimeConfig, service: AgentService, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!authorized(config, request)) {
    writeJson(response, 401, { type: "refusal", reason: "policy", message: "Unauthorized PMS Agent request." });
    return;
  }

  let body: string | undefined;
  try {
    body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request, config.maxInboundBodyBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      writeJson(response, 413, { type: "refusal", reason: "invalid_request", message: "Request body too large." });
      return;
    }
    throw error;
  }
  const serviceResponse = await service.handle({
    method: request.method ?? "GET",
    path: url.pathname,
    body
  });
  writeJson(response, serviceResponse.status, serviceResponse.body);
}

function authorized(config: AgentServiceRuntimeConfig, request: IncomingMessage): boolean {
  if (!config.inboundAuthToken) return true;
  const header = request.headers["x-pms-agent-token"];
  const token = Array.isArray(header) ? header[0] : header;
  return token === config.inboundAuthToken;
}

class BodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
  }
}

function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        rejectBody(new BodyTooLargeError());
        return;
      }
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", rejectBody);
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
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
