import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle, contextBundlePrompt, type WorkspaceAdvisoryContextInput } from "./context-bundle.js";
import { continuityPrompt, createRedactedSessionState, rememberRefs, rememberTurn, type RedactedSessionState } from "./continuity.js";
import type { PiAgentSession, PiAssistantEvent, PiCreateAgentSession, PiResourceLoaderFactory, PiToolDefinition } from "./pi-session.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile, type UnifiedAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { synthesizeTextReply } from "./response-synthesis.js";
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

  if (session.profile.id === "customer_pms") {
    const customerResult = await runCustomerPmsLoop({ turn, tools: session.tools, state: session.state });
    if (customerResult) {
      rememberRefs(session.state, customerResult);
      return customerResult.result;
    }
  }

  if (session.profile.id === "admin_customization") {
    const proposalResult = await runAdminProposalLoop({ turn, tools: session.tools, state: session.state });
    if (proposalResult) return proposalResult.result;
  }

  const text = assistantText.trim() || fallbackNaturalReply(turn);
  return synthesizeTextReply({
    text,
    evidenceRefs: options.evidenceRefs,
    pmsEvidence: options.pmsEvidence,
    context: buildContextBundle({
      state: session.state,
      userMessage: turn.message.text,
      workspaceAdvisory: options.workspaceAdvisory,
      pmsEvidence: options.pmsEvidence,
      modelPriorSummary: options.modelPriorSummary
    })
  }).result;
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
    "User message:",
    turn.message.text
  ].join("\n");
}
