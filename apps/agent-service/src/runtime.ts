import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage, createAgentSession, DefaultResourceLoader, getAgentDir, ModelRegistry, SessionManager, type ResourceLoader } from "@mariozechner/pi-coding-agent";
import { createAgentService, type AgentService } from "./index.js";
import type { GatedDecision, GatedToolExecutor, GatedToolRequest, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import { createPmsPlatformClient, type PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "@pms-agent-v2/safety-gateway";
import type { PiCreateAgentSession, PiResourceLoaderFactory, UnifiedAgentToolExecutors } from "@pms-agent-v2/unified-agent";

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
    piSessionMode: env.PMS_AGENT_PI_SESSION_MODE === "persistent" ? "persistent" : "memory",
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

function createRuntimeResourceLoaderFactory(config: AgentServiceRuntimeConfig): PiResourceLoaderFactory {
  return async (systemPrompt) => {
    const loader = new DefaultResourceLoader({
      cwd: config.cwd,
      agentDir: getAgentDir(),
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

export function createRuntimePiSessionFactory(config: AgentServiceRuntimeConfig, createSession: typeof createAgentSession = createAgentSession): PiCreateAgentSession {
  if (config.piMode === "stub") {
    return async () => ({ session: { async prompt() {} } });
  }

  return async (options) => {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const model = config.piModelProvider && config.piModelId ? modelRegistry.find(config.piModelProvider, config.piModelId) : undefined;
    if (config.piModelProvider && config.piModelId && !model) {
      throw new Error(`model_not_resolved: Pi ModelRegistry could not resolve ${config.piModelProvider}/${config.piModelId}`);
    }
    return createSession({
      cwd: options.cwd ?? config.cwd,
      tools: options.tools as string[],
      customTools: options.customTools as never[],
      authStorage,
      modelRegistry,
      ...(options.resourceLoader ? { resourceLoader: options.resourceLoader as ResourceLoader } : {}),
      ...(model ? { model } : {}),
      sessionManager: config.piSessionMode === "persistent" ? SessionManager.create(config.cwd) : SessionManager.inMemory(config.cwd)
    }) as unknown as ReturnType<PiCreateAgentSession>;
  };
}

export function createRuntimeExecutors(config: AgentServiceRuntimeConfig): UnifiedAgentToolExecutors {
  const client = createPmsPlatformClient({
    baseUrl: config.pmsPlatformBaseUrl,
    authToken: config.pmsPlatformAuthToken,
    fetch
  });

  return {
    pmsRead: async ({ request }) => {
      if (request.target === "availability" || request.target === undefined) {
        return client.searchAvailability({
          tenantId: tenantId(request),
          hotelId: config.defaultHotelId,
          checkInDate: request.checkInDate ?? config.defaultCheckInDate,
          checkOutDate: request.checkOutDate ?? config.defaultCheckOutDate,
          ...(request.quantity ? { quantity: request.quantity } : {}),
          ...(request.roomType ?? config.defaultRoomType ? { roomType: request.roomType ?? config.defaultRoomType } : {})
        });
      }
      return client.capabilitiesManifest({ tenantId: tenantId(request) });
    },
    pmsWorkflow: async ({ request }) => {
      const tenant = tenantId(request);
      const quantity = request.quantity ?? 1;
      if (quantity > 1) {
        const selections = requiredWorkflowSelections(request.selections, quantity);
        const sourceEvidenceRef = request.sourceEpisodeRefs?.[0];
        const groupDraft = await client.createReservationGroupDraft({
          tenantId: tenant,
          propertyId: config.defaultPropertyId,
          guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
          checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
          checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
          quantity,
          ...(request.roomType ? { roomType: request.roomType } : {}),
          ...(sourceEvidenceRef ? { sourceEvidenceRef } : {})
        });
        const groupDraftIdentifier = groupDraft.data.groupDraftRef ?? groupDraft.data.groupDraftId;
        await client.updateReservationGroupDraft({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required"),
          selections,
          ...(sourceEvidenceRef ? { sourceEvidenceRef } : {})
        });
        const quote = await client.quoteReservationGroupDraft({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required")
        });
        const prepared = await client.prepareReservationGroupConfirm({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required"),
          quoteRef: requiredWorkflowText(quote.data.quoteRef, "pms_workflow_quote_required")
        });
        await client.pendingActionStatus({
          tenantId: tenant,
          pendingActionRef: prepared.data.pendingActionRef ?? prepared.data.pendingActionId,
          ...(prepared.data.cardPayloadRef ? { cardPayloadRef: prepared.data.cardPayloadRef } : {})
        });
        return prepared;
      }

      const draft = request.draftId ? undefined : await client.createReservationDraft({
        tenantId: tenant,
        propertyId: config.defaultPropertyId,
        roomId: requiredWorkflowText(request.roomId, "pms_workflow_room_required"),
        guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
        checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
        checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
        ...(request.roomType ? { roomType: request.roomType } : {}),
        ...(request.sourceEpisodeRefs?.[0] ? { sourceEvidenceRef: request.sourceEpisodeRefs[0] } : {})
      });
      const draftIdentifier = request.draftId ?? draft?.data.draftRef ?? draft?.data.draftId;
      const selectedCandidateRef = request.sourceEpisodeRefs?.[0] ? `${request.sourceEpisodeRefs[0]}:${request.roomId}` : undefined;
      if (draft?.data.draftRef ?? draft?.data.draftId) {
        await client.updateReservationDraft({
          tenantId: tenant,
          draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required"),
          patch: {
            roomId: request.roomId,
            ...(selectedCandidateRef ? { selectedCandidateRef } : {})
          },
          ...(request.sourceEpisodeRefs?.[0] ? { sourceEvidenceRef: request.sourceEpisodeRefs[0] } : {})
        });
      }
      const quote = await client.quoteReservationDraft({
        tenantId: tenant,
        draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required")
      });

      const prepared = await client.prepareReservationConfirm({
        tenantId: tenant,
        draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required"),
        quoteRef: requiredWorkflowText(quote.data.quoteRef ?? quote.data.quoteId, "pms_workflow_quote_required")
      });
      await client.pendingActionStatus({
        tenantId: tenant,
        pendingActionRef: prepared.data.pendingActionId,
        ...(prepared.data.cardPayloadRef ? { cardPayloadRef: prepared.data.cardPayloadRef } : {})
      });
      return prepared;
    },
    pmsConfirm: async ({ request }) => client.pendingActionStatus({
      tenantId: tenantId(request),
      pendingActionId: request.pendingActionId ?? request.target ?? "missing-pending-action"
    }),
    proposalRead: proposalReadExecutor(config),
    proposalWrite: proposalWriteExecutor(config),
    proposalEdit: proposalWriteExecutor(config)
  };
}

function proposalReadExecutor(config: AgentServiceRuntimeConfig): GatedToolExecutor<unknown> {
  return ({ request }) => {
    const path = safeProposalPath(config.proposalWorkspacePath, request.target);
    return { path, content: readFileSync(path, "utf8") };
  };
}

function proposalWriteExecutor(config: AgentServiceRuntimeConfig): GatedToolExecutor<unknown> {
  return ({ request }) => {
    const path = safeProposalPath(config.proposalWorkspacePath, request.target);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, request.content ?? "", "utf8");
    return { path };
  };
}

function safeProposalPath(root: string, target: string | undefined): string {
  const relative = (target || "proposal.md").replace(/^\/+/, "");
  const path = resolve(root, relative);
  const normalizedRoot = resolve(root);
  if (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}/`)) {
    throw new Error("proposal path escapes workspace");
  }
  return path;
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

function requiredWorkflowSelections(value: GatedToolRequest["selections"], quantity: number): NonNullable<GatedToolRequest["selections"]> {
  if (!Array.isArray(value) || value.length < quantity) throw new Error("pms_workflow_group_selections_required");
  return value.slice(0, quantity);
}

function tenantId(request: GatedToolRequest): string {
  return request.tenantId ?? "default-tenant";
}

function requiredWorkflowText(value: string | undefined, message: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(message);
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
