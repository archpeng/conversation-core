import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import { buildContextBundle } from "./context-bundle.js";
import { createRedactedSessionState, rememberRefs, rememberTurn } from "./continuity.js";
import { parseAssistantToolPlanJson, promptAssistantText } from "./pi-io.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { synthesizeTextReply } from "./response-synthesis.js";
import { omitParam, requestedRoomTypeText, roomSelection, selectRoomCandidates } from "./room-selection.js";
import { buildVisibleGatedToolManifest, executeToolPlan, parseToolPlan, type ToolPlanAction } from "./tool-plan.js";
import { registerGatedTools } from "./tool-registration.js";
import { fallbackNaturalReply, turnPrompt } from "./session-turn-prompt.js";
import { isAvailabilityEvidence, isPmsEvidence, synthesizeToolResult, type PlannedAgentResult } from "./session-evidence.js";
import type {
  CreateUnifiedAgentSessionInput,
  RunAgentTurnOptions,
  UnifiedAgentSession,
  UnifiedAgentTurnEvent
} from "./session-types.js";

export type {
  CreateUnifiedAgentSessionInput,
  RegisteredGatedTool,
  RunAgentTurnOptions,
  UnifiedAgentSession,
  UnifiedAgentTurnEvent
} from "./session-types.js";

type PlannerPathOutcome =
  | (PlannedAgentResult & { kind: "handled" })
  | { kind: "no_structured_plan"; reason: "assistant_output_not_json" };

type PostLlmSafetyScaffoldInput = {
  session: UnifiedAgentSession;
  turn: FeishuTurnInput;
  reason: "llm_unavailable";
};

type AssistantToolPlanJson =
  | { ok: true; hasPlan: true; value: unknown }
  | { ok: true; hasPlan: false }
  | { ok: false; hasPlan: true };

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
    ...(input.sessionFile ? { sessionFile: input.sessionFile } : {}),
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
  let assistantText: string;
  let llmFailed = false;
  try {
    assistantText = await promptAssistantText(session.piSession, turnPrompt(session, turn, options));
  } catch {
    assistantText = "";
    llmFailed = true;
  }
  const plannerOutcome = await runAssistantToolPlan(session, assistantText, turn, options);
  if (plannerOutcome.kind === "handled") {
    rememberRefs(session.state, plannerOutcome);
    emitFinalResultEvent(session, options, plannerOutcome);
    return plannerOutcome.result;
  }

  // Only run the deterministic safety scaffold when the LLM is genuinely unavailable.
  // An available LLM that returns natural language without a JSON plan means the
  // LLM decided not to call tools -- we synthesize its text directly.
  const llmUnavailable = llmFailed || !assistantText.trim();
  if (llmUnavailable) {
    const fallbackResult = await runPostLlmSafetyScaffoldFallback({ session, turn, reason: "llm_unavailable" });
    if (fallbackResult) {
      rememberRefs(session.state, fallbackResult);
      emitFinalResultEvent(session, options, fallbackResult);
      return fallbackResult.result;
    }
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
  const roomTypeText = requestedRoomTypeText(plan.read.params, plan.workflow.params);
  const readParams = roomTypeText ? omitParam(plan.read.params, "roomType") : plan.read.params;
  const readResult = await executeToolPlan({ type: "call_tool", toolName: plan.read.toolName, params: readParams }, session.tools);
  if (!readResult.ok) return { kind: "handled", result: readResult.result };
  const readDetails = readResult.toolResult.details as Record<string, unknown>;
  const readValue = "value" in readDetails ? readDetails.value : undefined;
  const readEvidence = readDetails.outcome === "allow" && isPmsEvidence(readValue) ? readValue : undefined;
  if (!isAvailabilityEvidence(readEvidence)) {
    return { kind: "handled", result: { type: "refusal", reason: "unsupported", message: "PMS availability evidence is missing." } };
  }
  emitToolResultEvent(session, options, plan.read.toolName, readResult.toolResult, { type: "text", text: "PMS read evidence captured.", evidenceRefs: [readEvidence.evidenceRef] });

  const selection = await selectRoomCandidates(
    session.piSession,
    turn,
    readEvidence,
    plan.workflow.params,
    roomTypeText,
    turnContext(session, turn, options)
  );
  if (!selection.ok) {
    return { kind: "handled", result: selection.planned.result, evidenceRefs: [readEvidence.evidenceRef] };
  }
  const candidates = selection.candidates;

  const workflowParams = {
    ...plan.workflow.params,
    roomId: candidates[0]?.roomId,
    ...(candidates[0]?.roomType ? { roomType: candidates[0].roomType } : {}),
    ...(candidates.length > 1 ? { selections: candidates.map((candidate) => roomSelection(candidate, readEvidence.evidenceRef)) } : {}),
    sourceEpisodeRefs: [readEvidence.evidenceRef]
  };
  const workflowResult = await executeToolPlan({ type: "call_tool", toolName: plan.workflow.toolName, params: workflowParams }, session.tools);
  if (!workflowResult.ok) return { kind: "handled", result: workflowResult.result, evidenceRefs: [readEvidence.evidenceRef] };
  const planned = await synthesizeToolResult(session, turn, workflowResult.toolResult, turnContext(session, turn, options), options);
  emitToolResultEvent(session, options, plan.workflow.toolName, workflowResult.toolResult, planned.result);
  return { kind: "handled", ...planned, evidenceRefs: [readEvidence.evidenceRef, ...(planned.evidenceRefs ?? [])] };
}

async function runPostLlmSafetyScaffoldFallback(input: PostLlmSafetyScaffoldInput): Promise<PlannedAgentResult | undefined> {
  void input.reason;
  // This bounded scaffold runs only when the LLM is genuinely unavailable (stub mode,
  // error, or empty output). It is not planner success and must not expand into the
  // primary business brain. When the LLM is available but produced no structured
  // ToolPlanAction JSON, the LLM's text is synthesized directly -- the regex-based
  // fallback must not override an available model's natural-language decision.
  if (input.session.profile.id === "customer_pms") {
    return runCustomerPmsLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  if (input.session.profile.id === "admin_customization") {
    return runAdminProposalLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  return undefined;
}

function toolPlanRefusalReason(reason: string): "policy" | "unsupported" | "invalid_request" {
  if (reason === "raw_tool_not_visible") return "policy";
  if (reason === "tool_not_visible") return "unsupported";
  return "invalid_request";
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

function emitToolResultEvent(session: UnifiedAgentSession, options: RunAgentTurnOptions, toolName: string, toolResult: import("./pi-session.js").AgentToolResult<GatedToolResult<unknown>>, result: AgentResult): void {
  const details = toolResult.details as Record<string, unknown>;
  const value = "value" in details ? details.value : undefined;
  emitEvent(options, {
    event: "pms_agent_tool_result",
    profile: session.profile.id,
    toolName,
    outcome: typeof details.outcome === "string" ? details.outcome : "unknown",
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
