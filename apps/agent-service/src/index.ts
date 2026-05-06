import {
  isAgentResult,
  validateFeishuTurnInput,
  type AgentResult,
  type FeishuTurnInput
} from "@pms-agent-v2/adapter-contracts";
import type { SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import {
  createUnifiedAgentSession,
  runAgentTurn,
  type PiCreateAgentSession,
  type PiResourceLoaderFactory,
  type UnifiedAgentToolExecutors
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
  createAgentSession: PiCreateAgentSession;
  createResourceLoader?: PiResourceLoaderFactory;
  cwd?: string;
  sessionManager?: unknown;
  authStorage?: unknown;
  modelRegistry?: unknown;
  executors?: UnifiedAgentToolExecutors;
};

const jsonHeaders = { "content-type": "application/json" } as const;

export function createAgentService(input: CreateAgentServiceInput): AgentService {
  return {
    handle(request) {
      return handleAgentServiceRequest(input, request);
    }
  };
}

export async function handleAgentServiceRequest(input: CreateAgentServiceInput, request: AgentServiceRequest): Promise<AgentServiceResponse> {
  const method = request.method.toUpperCase();

  if (method === "GET" && request.path === "/health") {
    return json(200, healthBody());
  }

  if (method === "POST" && (request.path === "/v1/feishu-turn" || request.path === "/v1/eval-turn")) {
    return handleTurn(input, request.body);
  }

  return json(404, refusal("unsupported", "Unsupported route."));
}

async function handleTurn(input: CreateAgentServiceInput, body: unknown): Promise<AgentServiceResponse> {
  const decoded = decodeJsonBody(body);
  if (!decoded.ok) return json(400, refusal("invalid_request", "Request body must be JSON object."));

  const turn = validateFeishuTurnInput(decoded.value);
  if (!turn.ok) return json(400, refusal("invalid_request", "Invalid Feishu turn input."));

  try {
    const session = await createUnifiedAgentSession({
      turn: turn.value,
      gateway: input.gateway,
      createAgentSession: input.createAgentSession,
      createResourceLoader: input.createResourceLoader,
      cwd: input.cwd,
      sessionManager: input.sessionManager,
      authStorage: input.authStorage,
      modelRegistry: input.modelRegistry,
      executors: input.executors
    });
    const result = await runAgentTurn(session, turn.value);

    if (!isAgentResult(result)) {
      return json(502, refusal("unsupported", "Agent returned unsupported result."));
    }

    return json(200, result);
  } catch {
    return json(502, refusal("unsupported", "Agent turn failed."));
  }
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
