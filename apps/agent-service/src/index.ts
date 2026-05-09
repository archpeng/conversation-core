import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  isAgentResult,
  validateFeishuTurnInput,
  type AgentResult,
  type FeishuTurnInput
} from "@pms-agent-v2/adapter-contracts";
import type { SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import {
  createUnifiedAgentSession,
  loadAgentProfile,
  runAgentTurn,
  type AgentSessionFactory,
  type AgentSessionFactoryOptions,
  type ResourceLoaderFactory,
  type UnifiedAgentSession,
  type UnifiedAgentToolExecutors,
  type UnifiedAgentTurnEvent
} from "@pms-agent-v2/unified-agent";

export type AgentServiceRequest = {
  method: string;
  path: string;
  body?: unknown;
};

export type AgentServiceResponse = {
  status: number;
  headers: { "content-type": "application/json" };
  body: unknown;
};

export type AgentService = {
  handle(request: AgentServiceRequest): Promise<AgentServiceResponse>;
};

export type CreateAgentServiceInput = {
  gateway: SafetyGatewayPort;
  createAgentSession: AgentSessionFactory;
  createResourceLoader?: ResourceLoaderFactory;
  cwd?: string;
  piSessionDir?: string;
  sessionManager?: AgentSessionFactoryOptions["sessionManager"];
  authStorage?: AgentSessionFactoryOptions["authStorage"];
  modelRegistry?: AgentSessionFactoryOptions["modelRegistry"];
  executors?: UnifiedAgentToolExecutors;
  eventSink?: (event: UnifiedAgentTurnEvent) => void;
};

const jsonHeaders = { "content-type": "application/json" } as const;
const runtimeFailureMessage = "助手暂时无法完成本轮处理，请稍后重试；如果你正在处理 PMS 操作，请重新发送上一条需求。";

type CachedUnifiedAgentSession = {
  session: UnifiedAgentSession;
  updatedAt: number;
};

const sessionCacheMaxEntries = 128;
const sessionCacheTtlMs = 2 * 60 * 60 * 1000;

export function createAgentService(input: CreateAgentServiceInput): AgentService {
  const sessions = new Map<string, CachedUnifiedAgentSession>();
  return {
    handle(request) {
      return handleAgentServiceRequest(input, request, sessions);
    }
  };
}

export async function handleAgentServiceRequest(input: CreateAgentServiceInput, request: AgentServiceRequest, sessions = new Map<string, CachedUnifiedAgentSession>()): Promise<AgentServiceResponse> {
  const method = request.method.toUpperCase();

  if (method === "GET" && request.path === "/health") {
    return json(200, healthBody());
  }

  if (method === "POST" && (request.path === "/v1/feishu-turn" || request.path === "/v1/eval-turn")) {
    return handleTurn(input, request.body, sessions);
  }

  return json(404, refusal("unsupported", "Unsupported route."));
}

async function handleTurn(input: CreateAgentServiceInput, body: unknown, sessions: Map<string, CachedUnifiedAgentSession>): Promise<AgentServiceResponse> {
  const decoded = decodeJsonBody(body);
  if (!decoded.ok) return json(400, refusal("invalid_request", "Request body must be JSON object."));

  const turn = validateFeishuTurnInput(decoded.value);
  if (!turn.ok) return json(400, refusal("invalid_request", "Invalid Feishu turn input."));

  try {
    const session = await getOrCreateUnifiedSession(input, sessions, turn.value);
    const result = await runAgentTurn(session, turn.value, { eventSink: input.eventSink });

    if (!isAgentResult(result)) {
      return json(502, refusal("unsupported", "Agent returned unsupported result."));
    }

    return json(200, result);
  } catch (error) {
    emitRuntimeFailure(input, error);
    return json(502, refusal("unsupported", runtimeFailureMessage));
  }
}

function emitRuntimeFailure(input: CreateAgentServiceInput, error: unknown): void {
  input.eventSink?.({
    event: "pms_agent_turn_failed",
    stage: "create_or_run_turn",
    status: 502,
    errorName: errorName(error),
    errorMessageHash: hashRedacted(errorMessage(error))
  });
}

async function getOrCreateUnifiedSession(input: CreateAgentServiceInput, sessions: Map<string, CachedUnifiedAgentSession>, turn: FeishuTurnInput): Promise<UnifiedAgentSession> {
  pruneSessionCache(sessions, Date.now());
  const key = sessionCacheKey(turn);
  const cached = sessions.get(key);
  if (cached) {
    cached.updatedAt = Date.now();
    return cached.session;
  }

  const session = await createUnifiedAgentSession({
    turn,
    gateway: input.gateway,
    createAgentSession: input.createAgentSession,
    createResourceLoader: input.createResourceLoader,
    cwd: input.cwd,
    sessionFile: input.piSessionDir ? sessionFileForConversation(input.piSessionDir, key, turn.channel) : undefined,
    sessionManager: input.sessionManager,
    authStorage: input.authStorage,
    modelRegistry: input.modelRegistry,
    executors: input.executors
  });
  sessions.set(key, { session, updatedAt: Date.now() });
  return session;
}

function pruneSessionCache(sessions: Map<string, CachedUnifiedAgentSession>, now: number): void {
  for (const [key, entry] of sessions) {
    if (now - entry.updatedAt > sessionCacheTtlMs) {
      disposeCachedSession(entry);
      sessions.delete(key);
    }
  }
  while (sessions.size > sessionCacheMaxEntries) {
    const oldest = sessions.keys().next().value;
    if (!oldest) return;
    const entry = sessions.get(oldest);
    if (entry) disposeCachedSession(entry);
    sessions.delete(oldest);
  }
}

function disposeCachedSession(entry: CachedUnifiedAgentSession): void {
  try {
    entry.session.piSession.dispose?.();
  } catch {
    // Cache eviction must not fail the next user turn.
  }
}

function sessionCacheKey(turn: FeishuTurnInput): string {
  const profile = loadAgentProfile(turn.actor.role).id;
  return [turn.channel, turn.tenantId, turn.sessionId, profile].join("\u001f");
}

function sessionFileForConversation(sessionDir: string, key: string, channel: string): string {
  const channelPrefix = channel.replace(/[^a-zA-Z0-9_-]/g, "_") || "conversation";
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return join(sessionDir, `${channelPrefix}-${digest}.jsonl`);
}

function hashRedacted(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : "UnknownError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function healthBody(): { status: "ok"; service: "pms-agent-v2-agent-service" } {
  return {
    status: "ok",
    service: "pms-agent-v2-agent-service"
  };
}

function json(status: number, body: unknown): AgentServiceResponse {
  return { status, headers: jsonHeaders, body };
}

function refusal(reason: Extract<AgentResult, { type: "refusal" }>["reason"], message: string): AgentResult {
  return { type: "refusal", reason, message };
}

function decodeJsonBody(body: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof body === "string") {
    try {
      return { ok: true, value: JSON.parse(body) };
    } catch {
      return { ok: false };
    }
  }

  if (body && typeof body === "object") return { ok: true, value: body };
  return { ok: false };
}
