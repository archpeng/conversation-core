import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle, contextBundlePrompt, type WorkspaceAdvisoryContextInput } from "./context-bundle.js";
import { continuityPrompt, createRedactedSessionState, rememberRefs, rememberTurn, type RedactedSessionState } from "./continuity.js";
import type { PiAgentSession, PiAssistantEvent, PiCreateAgentSession, PiResourceLoaderFactory, PiToolDefinition, PiToolResult } from "./pi-session.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile, type UnifiedAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { synthesizeTextReply } from "./response-synthesis.js";
import { buildVisibleGatedToolManifest, executeToolPlan, parseToolPlan } from "./tool-plan.js";
import { registerGatedTools, type UnifiedAgentToolExecutors } from "./tool-registration.js";

export type UnifiedAgentSession = {
  agentRuntime: "pi-coding-agent";
  profile: UnifiedAgentProfile;
  piSession: PiAgentSession;
  tools: readonly PiToolDefinition[];
  systemPrompt: string;
  systemPromptInjected: boolean;
  state: RedactedSessionState;
};

export type CreateUnifiedAgentSessionInput = {
  turn: FeishuTurnInput;
  gateway: SafetyGatewayPort;
  createAgentSession: PiCreateAgentSession;
  createResourceLoader?: PiResourceLoaderFactory;
  cwd?: string;
  sessionManager?: unknown;
  authStorage?: unknown;
  modelRegistry?: unknown;
  executors?: UnifiedAgentToolExecutors;
};

export type RunAgentTurnOptions = {
  evidenceRefs?: readonly string[];
  pendingActionRefs?: readonly string[];
  workspaceAdvisory?: readonly WorkspaceAdvisoryContextInput[];
  pmsEvidence?: readonly PmsEvidence<unknown>[];
  modelPriorSummary?: string;
};

export async function createUnifiedAgentSession(input: CreateUnifiedAgentSessionInput): Promise<UnifiedAgentSession> {
  const profile = loadAgentProfile(input.turn.actor.role);
  const actor = { profile: input.turn.actor.role, id: input.turn.actor.id };
  const tools = registerGatedTools({
    profile,
    gateway: input.gateway,
    actor,
    tenantId: input.turn.tenantId,
    executors: input.executors
  });
  const systemPrompt = buildSystemPrompt(profile);
  const resourceLoader = input.createResourceLoader ? await input.createResourceLoader(systemPrompt) : undefined;
  const { session } = await input.createAgentSession({
    cwd: input.cwd,
    tools: [],
    customTools: tools,
    ...(resourceLoader ? { resourceLoader } : {}),
    ...(input.sessionManager ? { sessionManager: input.sessionManager } : {}),
    ...(input.authStorage ? { authStorage: input.authStorage } : {}),
    ...(input.modelRegistry ? { modelRegistry: input.modelRegistry } : {})
  });

  return {
    agentRuntime: "pi-coding-agent",
    profile,
    piSession: session,
    tools,
    systemPrompt,
    systemPromptInjected: Boolean(input.createResourceLoader),
    state: createRedactedSessionState({ sessionId: input.turn.sessionId, actorId: input.turn.actor.id, profileId: profile.id })
  };
}

export async function runAgentTurn(session: UnifiedAgentSession, turn: FeishuTurnInput, options: RunAgentTurnOptions = {}): Promise<AgentResult> {
  rememberTurn(session.state, turn, options);
  const assistantText = await promptAssistantText(session.piSession, turnPrompt(session, turn, options));
  const plannerOutcome = await runAssistantToolPlan(session, assistantText, turn, options);
  if (plannerOutcome.kind === "handled") {
    rememberRefs(session.state, plannerOutcome);
    return plannerOutcome.result;
  }

  const fallbackResult = await runLegacySafetyScaffoldFallback({ session, turn, reason: plannerOutcome.reason });
  if (fallbackResult) {
    rememberRefs(session.state, fallbackResult);
    return fallbackResult.result;
  }

  const text = assistantText.trim() || fallbackNaturalReply(turn);
  return synthesizeTextReply({
    text,
    evidenceRefs: options.evidenceRefs,
    pmsEvidence: options.pmsEvidence,
    context: turnContext(session, turn, options)
  }).result;
}

type PlannerPathOutcome =
  | (PlannedAgentResult & { kind: "handled" })
  | { kind: "no_structured_plan"; reason: "assistant_output_not_json" };

type LegacySafetyScaffoldInput = {
  session: UnifiedAgentSession;
  turn: FeishuTurnInput;
  reason: "assistant_output_not_json";
};

type AssistantToolPlanJson =
  | { ok: true; hasPlan: true; value: unknown }
  | { ok: true; hasPlan: false }
  | { ok: false; hasPlan: true };

type PlannedAgentResult = {
  result: AgentResult;
  evidenceRefs?: string[];
  pendingActionRefs?: string[];
};

async function runAssistantToolPlan(session: UnifiedAgentSession, assistantText: string, turn: FeishuTurnInput, options: RunAgentTurnOptions): Promise<PlannerPathOutcome> {
  const json = parseAssistantToolPlanJson(assistantText);
  if (!json.hasPlan) return { kind: "no_structured_plan", reason: "assistant_output_not_json" };
  if (!json.ok) return { kind: "handled", result: { type: "refusal", reason: "invalid_request", message: "Invalid tool plan JSON." } };

  const manifest = buildVisibleGatedToolManifest(session.profile, session.tools);
  const parsed = parseToolPlan(json.value, manifest);
  if (!parsed.ok) {
    return { kind: "handled", result: { type: "refusal", reason: toolPlanRefusalReason(parsed.reason), message: `Invalid tool plan: ${parsed.reason}.` } };
  }

  const executed = await executeToolPlan(parsed.plan, session.tools);
  if (!executed.ok) return { kind: "handled", result: executed.result };
  return { kind: "handled", ...synthesizeToolResult(executed.toolResult, turnContext(session, turn, options), options) };
}

async function runLegacySafetyScaffoldFallback(input: LegacySafetyScaffoldInput): Promise<PlannedAgentResult | undefined> {
  void input.reason;
  // This branch is a legacy safety/compatibility scaffold. It runs only after the LLM
  // observed the turn and produced no structured ToolPlanAction JSON; it is not planner success.
  if (input.session.profile.id === "customer_pms") {
    return runCustomerPmsLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  if (input.session.profile.id === "admin_customization") {
    return runAdminProposalLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  return undefined;
}

function parseAssistantToolPlanJson(text: string): AssistantToolPlanJson {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return { ok: true, hasPlan: false };
  try {
    return { ok: true, hasPlan: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, hasPlan: true };
  }
}

function toolPlanRefusalReason(reason: string): "policy" | "unsupported" | "invalid_request" {
  if (reason === "raw_tool_not_visible") return "policy";
  if (reason === "tool_not_visible") return "unsupported";
  return "invalid_request";
}

function synthesizeToolResult(toolResult: PiToolResult, context: ReturnType<typeof turnContext>, options: RunAgentTurnOptions): PlannedAgentResult {
  const details = toolResult.details as Partial<GatedToolResult<unknown>>;
  if (details.outcome === "allow" && isPmsEvidence(details.value)) {
    const evidence = details.value;
    const result = synthesizeTextReply({
      text: `PMS evidence is available: ${evidence.summary}. evidenceRefs=${evidence.evidenceRef}`,
      evidenceRefs: [evidence.evidenceRef],
      pmsEvidence: [...(options.pmsEvidence ?? []), evidence],
      currentPmsFact: true,
      context
    }).result;
    return { result, evidenceRefs: [evidence.evidenceRef] };
  }

  const text = toolResult.content.map((item) => item.text).filter(Boolean).join("\n").trim() || "Gated action completed.";
  return { result: synthesizeTextReply({ text, context }).result };
}

function isPmsEvidence(value: unknown): value is PmsEvidence<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const evidence = value as Partial<PmsEvidence<unknown>>;
  return typeof evidence.evidenceRef === "string"
    && evidence.source?.system === "pms-platform"
    && typeof evidence.source.method === "string"
    && typeof evidence.summary === "string"
    && typeof evidence.fetchedAt === "string"
    && evidence.scope !== undefined
    && "data" in evidence;
}

function turnContext(session: UnifiedAgentSession, turn: FeishuTurnInput, options: RunAgentTurnOptions) {
  return buildContextBundle({
    state: session.state,
    userMessage: turn.message.text,
    workspaceAdvisory: options.workspaceAdvisory,
    pmsEvidence: options.pmsEvidence,
    modelPriorSummary: options.modelPriorSummary
  });
}

async function promptAssistantText(piSession: PiAgentSession, prompt: string): Promise<string> {
  const assistantText: string[] = [];
  let unsubscribe: (() => void) | undefined;
  if (piSession.subscribe) {
    unsubscribe = piSession.subscribe((event) => collectAssistantText(event, assistantText));
  }
  try {
    await piSession.prompt(prompt, { source: "pms-agent-v2" });
  } finally {
    unsubscribe?.();
  }
  if (assistantText.length > 0) return assistantText.join("");
  return extractVisibleText(latestAssistantMessage(piSession.messages));
}

function collectAssistantText(event: PiAssistantEvent, assistantText: string[]): void {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta" && typeof event.assistantMessageEvent.delta === "string") {
    assistantText.push(event.assistantMessageEvent.delta);
    return;
  }
  if (event.type === "turn_end") {
    const text = extractVisibleText(event.message);
    if (text && assistantText.length === 0) assistantText.push(text);
  }
}

function latestAssistantMessage(messages: unknown[] | undefined): unknown {
  if (!messages) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown } | undefined;
    if (message?.role === "assistant") return message;
  }
  return undefined;
}

function extractVisibleText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(extractContentPartText).filter(Boolean).join("\n");
  }
  const text = record.text;
  return typeof text === "string" ? text : "";
}

function extractContentPartText(part: unknown): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  const record = part as Record<string, unknown>;
  const text = record.text;
  if (typeof text === "string") return text;
  if (record.type === "text" && typeof record.content === "string") return record.content;
  return "";
}

function fallbackNaturalReply(turn: FeishuTurnInput): string {
  if (/^\s*(你好|您好|hello|hi|hey)\s*[！!。.]?\s*$/i.test(turn.message.text)) {
    return "你好，我是 PMS 智能助手。可以帮你查询房态、整理预订信息，或生成需要审批的预订确认卡片；如果要查房，请告诉我入住/离店日期和房型。";
  }
  return "我在。可以帮你查询 PMS 房态、整理预订信息，或生成需要审批的操作卡片。涉及实时房态、价格或订单状态时，我会以 PMS 平台证据为准。";
}

function turnPrompt(session: UnifiedAgentSession, turn: FeishuTurnInput, options: RunAgentTurnOptions): string {
  return [
    ...(session.systemPromptInjected ? [] : [session.systemPrompt]),
    "Continuity refs:",
    continuityPrompt(session.state),
    contextBundlePrompt(buildContextBundle({
      state: session.state,
      userMessage: turn.message.text,
      workspaceAdvisory: options.workspaceAdvisory,
      pmsEvidence: options.pmsEvidence,
      modelPriorSummary: options.modelPriorSummary
    })),
    "Visible gated tool manifest:",
    JSON.stringify(buildVisibleGatedToolManifest(session.profile, session.tools), null, 2),
    "ToolPlanAction JSON-only output contract:",
    "Return exactly one JSON object and no markdown or extra prose for actionable turns.",
    "Allowed shapes:",
    JSON.stringify([
      { type: "call_tool", toolName: "one visible gated tool name", params: {} },
      { type: "ask_clarification", message: "focused clarification question" },
      { type: "refuse", reason: "policy|unsupported|invalid_request", message: "safe refusal text" },
      { type: "require_approval", message: "approval-card/proposal required text" }
    ], null, 2),
    "Never call or name raw tools such as bash, read, write, edit, http, or http_request. Choose only from the visible gated tool manifest; runtime validation and Safety Gateway remain authoritative.",
    "User message:",
    turn.message.text
  ].join("\n");
}
