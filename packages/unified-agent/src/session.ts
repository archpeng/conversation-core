import type { AgentResult, FeishuTurnInput, PmsApprovalCard } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import type { AvailabilitySearchResult, PmsEvidence, ReservationConfirmPreparation, RoomAvailability } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle, contextBundlePrompt, type WorkspaceAdvisoryContextInput } from "./context-bundle.js";
import { continuityPrompt, createRedactedSessionState, rememberRefs, rememberTurn, type RedactedSessionState } from "./continuity.js";
import type { PiAgentSession, PiAssistantEvent, PiCreateAgentSession, PiResourceLoaderFactory, PiToolDefinition, PiToolResult } from "./pi-session.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile, type UnifiedAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { synthesizeTextReply } from "./response-synthesis.js";
import { buildVisibleGatedToolManifest, executeToolPlan, parseToolPlan, type ToolPlanAction } from "./tool-plan.js";
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

export type UnifiedAgentTurnEvent =
  | { event: "pms_agent_turn_planned"; profile: UnifiedAgentProfile["id"]; plannerPath: "structured_tool_plan" | "no_structured_plan" | "invalid_tool_plan"; toolPlanType?: string; toolName?: string; paramKeys?: readonly string[] }
  | { event: "pms_agent_tool_result"; profile: UnifiedAgentProfile["id"]; toolName: string; outcome: string; evidenceMethod?: string; resultType: AgentResult["type"] }
  | { event: "pms_agent_turn_result"; profile: UnifiedAgentProfile["id"]; resultType: AgentResult["type"]; evidenceCount: number; pendingActionCount: number };

export type RunAgentTurnOptions = {
  evidenceRefs?: readonly string[];
  pendingActionRefs?: readonly string[];
  workspaceAdvisory?: readonly WorkspaceAdvisoryContextInput[];
  pmsEvidence?: readonly PmsEvidence<unknown>[];
  modelPriorSummary?: string;
  eventSink?: (event: UnifiedAgentTurnEvent) => void;
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
    emitFinalResultEvent(session, options, plannerOutcome);
    return plannerOutcome.result;
  }

  const fallbackResult = await runPostLlmSafetyScaffoldFallback({ session, turn, reason: plannerOutcome.reason });
  if (fallbackResult) {
    rememberRefs(session.state, fallbackResult);
    emitFinalResultEvent(session, options, fallbackResult);
    return fallbackResult.result;
  }

  const text = assistantText.trim() || fallbackNaturalReply(turn);
  const result = synthesizeTextReply({
    text,
    evidenceRefs: options.evidenceRefs,
    pmsEvidence: options.pmsEvidence,
    context: turnContext(session, turn, options)
  }).result;
  emitFinalResultEvent(session, options, { result, evidenceRefs: options.evidenceRefs ? [...options.evidenceRefs] : undefined, pendingActionRefs: options.pendingActionRefs ? [...options.pendingActionRefs] : undefined });
  return result;
}

type PlannerPathOutcome =
  | (PlannedAgentResult & { kind: "handled" })
  | { kind: "no_structured_plan"; reason: "assistant_output_not_json" };

type PostLlmSafetyScaffoldInput = {
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
  if (!json.hasPlan) {
    emitEvent(options, { event: "pms_agent_turn_planned", profile: session.profile.id, plannerPath: "no_structured_plan" });
    return { kind: "no_structured_plan", reason: "assistant_output_not_json" };
  }
  if (!json.ok) {
    emitEvent(options, { event: "pms_agent_turn_planned", profile: session.profile.id, plannerPath: "invalid_tool_plan" });
    return { kind: "handled", result: { type: "refusal", reason: "invalid_request", message: "Invalid tool plan JSON." } };
  }

  const manifest = buildVisibleGatedToolManifest(session.profile, session.tools);
  const parsed = parseToolPlan(json.value, manifest);
  if (!parsed.ok) {
    emitEvent(options, { event: "pms_agent_turn_planned", profile: session.profile.id, plannerPath: "invalid_tool_plan" });
    return { kind: "handled", result: { type: "refusal", reason: toolPlanRefusalReason(parsed.reason), message: `Invalid tool plan: ${parsed.reason}.` } };
  }

  emitEvent(options, toolPlanEvent(session, parsed.plan));
  if (parsed.plan.type === "bounded_read_then_workflow") {
    return executeBoundedReadThenWorkflowPlan(session, parsed.plan, turn, options);
  }
  const executed = await executeToolPlan(parsed.plan, session.tools);
  if (!executed.ok) return { kind: "handled", result: executed.result };
  const planned = await synthesizeToolResult(session, turn, executed.toolResult, turnContext(session, turn, options), options);
  emitToolResultEvent(session, options, parsed.plan.type === "call_tool" ? parsed.plan.toolName : "none", executed.toolResult, planned.result);
  return { kind: "handled", ...planned };
}

async function executeBoundedReadThenWorkflowPlan(session: UnifiedAgentSession, plan: Extract<ToolPlanAction, { type: "bounded_read_then_workflow" }>, turn: FeishuTurnInput, options: RunAgentTurnOptions): Promise<PlannerPathOutcome> {
  const readResult = await executeToolPlan({ type: "call_tool", toolName: plan.read.toolName, params: plan.read.params }, session.tools);
  if (!readResult.ok) return { kind: "handled", result: readResult.result };
  const readDetails = readResult.toolResult.details as Partial<GatedToolResult<unknown>>;
  const readValue = "value" in readDetails ? readDetails.value : undefined;
  const readEvidence = readDetails.outcome === "allow" && isPmsEvidence(readValue) ? readValue : undefined;
  if (!isAvailabilityEvidence(readEvidence)) {
    return { kind: "handled", result: { type: "refusal", reason: "unsupported", message: "PMS availability evidence is missing." } };
  }
  emitToolResultEvent(session, options, plan.read.toolName, readResult.toolResult, { type: "text", text: "PMS read evidence captured.", evidenceRefs: [readEvidence.evidenceRef] });

  const candidate = selectRoomCandidate(readEvidence, plan.workflow.params);
  if (!candidate) {
    const shortage = unavailableCandidateReply(readEvidence, turnContext(session, turn, options));
    return { kind: "handled", result: shortage.result, evidenceRefs: [readEvidence.evidenceRef] };
  }
  if (requestedWorkflowQuantity(plan.workflow.params) > 1) {
    const quantityBoundary = unsupportedMultiRoomReply(readEvidence, turnContext(session, turn, options));
    return { kind: "handled", result: quantityBoundary.result, evidenceRefs: [readEvidence.evidenceRef] };
  }

  const workflowParams = { ...plan.workflow.params, roomId: candidate.roomId, sourceEpisodeRefs: [readEvidence.evidenceRef] };
  const workflowResult = await executeToolPlan({ type: "call_tool", toolName: plan.workflow.toolName, params: workflowParams }, session.tools);
  if (!workflowResult.ok) return { kind: "handled", result: workflowResult.result, evidenceRefs: [readEvidence.evidenceRef] };
  const planned = await synthesizeToolResult(session, turn, workflowResult.toolResult, turnContext(session, turn, options), options);
  emitToolResultEvent(session, options, plan.workflow.toolName, workflowResult.toolResult, planned.result);
  return { kind: "handled", ...planned, evidenceRefs: [readEvidence.evidenceRef, ...(planned.evidenceRefs ?? [])] };
}

async function runPostLlmSafetyScaffoldFallback(input: PostLlmSafetyScaffoldInput): Promise<PlannedAgentResult | undefined> {
  void input.reason;
  // This bounded scaffold runs only after the LLM observed the turn and produced no
  // structured ToolPlanAction JSON; it is not planner success and must not expand into the primary business brain.
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

async function synthesizeToolResult(session: UnifiedAgentSession, turn: FeishuTurnInput, toolResult: PiToolResult, context: ReturnType<typeof turnContext>, options: RunAgentTurnOptions): Promise<PlannedAgentResult> {
  const details = toolResult.details as Partial<GatedToolResult<unknown>>;
  if (details.outcome === "allow" && isPmsEvidence(details.value)) {
    const evidence = details.value;
    const approval = synthesizePrepareConfirmApproval(evidence);
    if (approval) return approval;

    const llmReply = await promptAssistantText(session.piSession, evidenceReplyPrompt(turn, evidence));
    const synthesized = synthesizeEvidenceTextReply(llmReply, evidence, context, options);
    if (synthesized) return synthesized;
    return fallbackEvidenceTextReply(evidence, context, options);
  }

  const text = toolResult.content.map((item) => item.text).filter(Boolean).join("\n").trim() || "Gated action completed.";
  return { result: synthesizeTextReply({ text, context }).result };
}

function synthesizeEvidenceTextReply(text: string, evidence: PmsEvidence<unknown>, context: ReturnType<typeof turnContext>, options: RunAgentTurnOptions): PlannedAgentResult | undefined {
  if (!text.trim() || parseAssistantToolPlanJson(text).hasPlan) return undefined;
  const replyText = text.includes(evidence.evidenceRef) ? text : `${text.trim()} evidenceRefs=${evidence.evidenceRef}`;
  const synthesized = synthesizeTextReply({
    text: replyText,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [...(options.pmsEvidence ?? []), evidence],
    currentPmsFact: true,
    context
  });
  if (!synthesized.ok) return undefined;
  return { result: synthesized.result, evidenceRefs: [evidence.evidenceRef] };
}

function fallbackEvidenceTextReply(evidence: PmsEvidence<unknown>, context: ReturnType<typeof turnContext>, options: RunAgentTurnOptions): PlannedAgentResult {
  const result = synthesizeTextReply({
    text: `PMS evidence is available: ${evidence.summary}. evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [...(options.pmsEvidence ?? []), evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function synthesizePrepareConfirmApproval(evidence: PmsEvidence<unknown>): PlannedAgentResult | undefined {
  if (evidence.source.method !== "prepareReservationConfirm" || !isReservationConfirmPreparation(evidence.data)) return undefined;
  return {
    result: { type: "approval_card", card: approvalCard(evidence.scope.tenantId, evidence.data.pendingActionId, evidence.data.expiresAt) },
    evidenceRefs: [evidence.evidenceRef],
    pendingActionRefs: [evidence.data.pendingActionId]
  };
}

function isReservationConfirmPreparation(value: unknown): value is ReservationConfirmPreparation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ReservationConfirmPreparation>;
  return typeof record.pendingActionId === "string"
    && record.pendingActionId.trim().length > 0
    && record.confirmationMode === "typedCardOnly"
    && record.mutationStatus === "none"
    && (record.expiresAt === undefined || typeof record.expiresAt === "string");
}

function approvalCard(tenantId: string, pendingActionId: string, expiresAt?: string): PmsApprovalCard {
  return {
    type: "pms_pending_action_card",
    ref: {
      type: "pms_pending_action",
      tenantId,
      pendingActionId,
      action: "reservation_confirm",
      ...(expiresAt ? { expiresAt } : {})
    },
    title: "确认预订",
    summary: "PMS 已准备待审批操作；只有点击确认卡片才会继续执行。",
    confirmLabel: "确认",
    cancelLabel: "取消"
  };
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

function isAvailabilityEvidence(value: PmsEvidence<unknown> | undefined): value is PmsEvidence<AvailabilitySearchResult> {
  if (!value || value.source.method !== "searchAvailability") return false;
  const data = value.data as Partial<AvailabilitySearchResult> | undefined;
  return Boolean(data && Array.isArray(data.rooms));
}

function selectRoomCandidate(evidence: PmsEvidence<AvailabilitySearchResult>, workflowParams: Record<string, unknown>): RoomAvailability | undefined {
  const requestedQuantity = requestedWorkflowQuantity(workflowParams);
  const availableRooms = evidence.data.rooms.filter((room) => room.available === true && typeof room.roomId === "string" && room.roomId.trim().length > 0);
  if (availableRooms.length < requestedQuantity) return undefined;
  return availableRooms[0];
}

function requestedWorkflowQuantity(workflowParams: Record<string, unknown>): number {
  return typeof workflowParams.quantity === "number" && Number.isInteger(workflowParams.quantity) && workflowParams.quantity > 0 ? workflowParams.quantity : 1;
}

function unsupportedMultiRoomReply(evidence: PmsEvidence<AvailabilitySearchResult>, context: ReturnType<typeof turnContext>): PlannedAgentResult {
  const result = synthesizeTextReply({
    text: `当前 PMS 预订审批流一次只能准备一间房的确认卡；我不能把两间房请求伪装成单房审批。请确认是否先准备一间房，或等待多房预订能力。evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function unavailableCandidateReply(evidence: PmsEvidence<AvailabilitySearchResult>, context: ReturnType<typeof turnContext>): PlannedAgentResult {
  const result = synthesizeTextReply({
    text: `PMS 证据显示可用候选不足，无法准备预订审批卡。evidenceRefs=${evidence.evidenceRef}`,
    evidenceRefs: [evidence.evidenceRef],
    pmsEvidence: [evidence],
    currentPmsFact: true,
    context
  }).result;
  return { result, evidenceRefs: [evidence.evidenceRef] };
}

function toolPlanEvent(session: UnifiedAgentSession, plan: ToolPlanAction): UnifiedAgentTurnEvent {
  if (plan.type !== "call_tool") {
    return { event: "pms_agent_turn_planned", profile: session.profile.id, plannerPath: "structured_tool_plan", toolPlanType: plan.type };
  }
  return {
    event: "pms_agent_turn_planned",
    profile: session.profile.id,
    plannerPath: "structured_tool_plan",
    toolPlanType: plan.type,
    toolName: plan.toolName,
    paramKeys: Object.keys(plan.params).sort()
  };
}

function emitToolResultEvent(session: UnifiedAgentSession, options: RunAgentTurnOptions, toolName: string, toolResult: PiToolResult, result: AgentResult): void {
  const details = toolResult.details as Partial<GatedToolResult<unknown>>;
  const value = "value" in details ? details.value : undefined;
  emitEvent(options, {
    event: "pms_agent_tool_result",
    profile: session.profile.id,
    toolName,
    outcome: details.outcome ?? "unknown",
    ...(isPmsEvidence(value) ? { evidenceMethod: value.source.method } : {}),
    resultType: result.type
  });
}

function emitFinalResultEvent(session: UnifiedAgentSession, options: RunAgentTurnOptions, result: PlannedAgentResult): void {
  emitEvent(options, {
    event: "pms_agent_turn_result",
    profile: session.profile.id,
    resultType: result.result.type,
    evidenceCount: result.evidenceRefs?.length ?? 0,
    pendingActionCount: result.pendingActionRefs?.length ?? 0
  });
}

function emitEvent(options: RunAgentTurnOptions, event: UnifiedAgentTurnEvent): void {
  options.eventSink?.(event);
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

function evidenceReplyPrompt(turn: FeishuTurnInput, evidence: PmsEvidence<unknown>): string {
  return [
    "Final response synthesis after a gated PMS tool call.",
    "Reply naturally in the user's language, using only the PMS evidence summary below for current PMS facts.",
    "Include the exact evidenceRefs value in the final answer.",
    "If the user also requested a booking or other high-risk PMS change, explain that natural language cannot complete the mutation; ask only for the smallest missing confirmation or say an approval card/workflow is required.",
    "Do not invent room IDs, prices, pending action IDs, or completed mutation claims.",
    `PMS evidence method=${evidence.source.method}`,
    `PMS evidence summary=${evidence.summary}`,
    `evidenceRefs=${evidence.evidenceRef}`,
    "User message:",
    turn.message.text
  ].join("\n");
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
      {
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm" } }
      },
      { type: "ask_clarification", message: "focused clarification question" },
      { type: "refuse", reason: "policy|unsupported|invalid_request", message: "safe refusal text" },
      { type: "require_approval", message: "approval-card/proposal required text" }
    ], null, 2),
    "Never call or name raw tools such as bash, read, write, edit, http, or http_request. Choose only from the visible gated tool manifest; runtime validation and Safety Gateway remain authoritative.",
    "User message:",
    turn.message.text
  ].join("\n");
}
