import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import { buildContextBundle } from "./context-bundle.js";
import { createRedactedSessionState, rememberRefs, rememberTurn } from "./continuity.js";
import { promptAssistantTurn, type AssistantTurn } from "./pi-io.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { synthesizeTextReply } from "./response-synthesis.js";
import { registerGatedTools } from "./tool-registration.js";
import { evidenceRepairPrompt, fallbackNaturalReply, turnPrompt } from "./session-turn-prompt.js";
import { fallbackEvidenceSequenceTextReply, isPmsEvidence, synthesizeEvidenceSequenceTextReply, synthesizePrepareConfirmApproval, type PlannedAgentResult } from "./session-evidence.js";
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
  | { kind: "no_tool_results" };

type PostLlmSafetyScaffoldInput = {
  session: UnifiedAgentSession;
  turn: FeishuTurnInput;
  reason: "llm_unavailable";
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
    ...(input.sessionFile ? { sessionFile: input.sessionFile } : {}),
    tools: tools.map((tool) => tool.name),
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
  let assistantTurn: AssistantTurn = { text: "", toolResults: [] };
  let llmFailed = false;
  try {
    assistantTurn = await promptAssistantTurn(session.piSession, turnPrompt(session, turn, options));
  } catch {
    llmFailed = true;
  }
  const assistantText = assistantTurn.text;
  const plannerOutcome = runPiNativeToolResults(session, assistantTurn, turn, options);
  if (plannerOutcome.kind === "handled") {
    rememberRefs(session.state, plannerOutcome);
    emitFinalResultEvent(session, options, plannerOutcome);
    return plannerOutcome.result;
  }

  // Only run the deterministic safety scaffold when the LLM is genuinely unavailable.
  // An available LLM that returns natural language without calling tools means the
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
  const synthesized = synthesizeTextReply({
    text,
    evidenceRefs: options.evidenceRefs,
    pmsEvidence: options.pmsEvidence,
    context: turnContext(session, turn, options)
  });
  if (!synthesized.ok && needsEvidenceRepair(synthesized.reason)) {
    const repaired = await runEvidenceRepairTurn(session, turn, text, options);
    if (repaired?.kind === "handled") {
      rememberRefs(session.state, repaired);
      emitFinalResultEvent(session, options, repaired);
      return repaired.result;
    }
  }
  const result = synthesized.result;
  emitFinalResultEvent(session, options, { result, evidenceRefs: options.evidenceRefs ? [...options.evidenceRefs] : undefined, pendingActionRefs: options.pendingActionRefs ? [...options.pendingActionRefs] : undefined });
  return result;
}

function needsEvidenceRepair(reason: string): boolean {
  return reason === "missing_pms_evidence" || reason === "invalid_pms_evidence_ref";
}

async function runEvidenceRepairTurn(session: UnifiedAgentSession, turn: FeishuTurnInput, rejectedText: string, options: RunAgentTurnOptions): Promise<PlannerPathOutcome | undefined> {
  try {
    const repairTurn = await promptAssistantTurn(session.piSession, evidenceRepairPrompt(session, turn, rejectedText, options));
    const repaired = runPiNativeToolResults(session, repairTurn, turn, options);
    return repaired.kind === "handled" ? repaired : undefined;
  } catch {
    return undefined;
  }
}

function runPiNativeToolResults(session: UnifiedAgentSession, assistantTurn: AssistantTurn, turn: FeishuTurnInput, options: RunAgentTurnOptions): PlannerPathOutcome {
  if (assistantTurn.toolResults.length === 0) {
    emitEvent(options, { event: "pms_agent_turn_planned", profile: session.profile.id, plannerPath: "no_tool_results" });
    return { kind: "no_tool_results" };
  }

  emitEvent(options, {
    event: "pms_agent_turn_planned",
    profile: session.profile.id,
    plannerPath: "pi_native_tools",
    toolCount: assistantTurn.toolResults.length
  });

  const context = turnContext(session, turn, options);
  const evidence: PmsEvidence<unknown>[] = [];
  const publicTexts: string[] = [];

  for (const toolResult of assistantTurn.toolResults) {
    const details = gatedToolDetails(toolResult.result);
    emitToolResultEvent(session, options, toolResult.toolName, toolResult.result);
    if (!details) {
      publicTexts.push(toolContentText(toolResult.result));
      continue;
    }
    if (details.outcome === "deny") {
      return { kind: "handled", result: { type: "refusal", reason: "policy", message: "PMS request was denied by policy." } };
    }
    if (details.outcome === "require_approval") {
      return { kind: "handled", result: { type: "refusal", reason: "policy", message: "PMS request requires typed approval." } };
    }
    if (details.outcome === "allow" && "value" in details && isPmsEvidence(details.value)) {
      evidence.push(details.value);
      continue;
    }
    publicTexts.push(toolContentText(toolResult.result));
  }

  if (evidence.length > 0) {
    const approval = latestApproval(evidence);
    if (approval) {
      return { kind: "handled", ...approval, evidenceRefs: evidence.map((item) => item.evidenceRef) };
    }
    const synthesized = synthesizeEvidenceSequenceTextReply(assistantTurn.text, evidence, context, options);
    return { kind: "handled", ...(synthesized ?? fallbackEvidenceSequenceTextReply(evidence, context, options)) };
  }

  const text = assistantTurn.text.trim() || publicTexts.filter(Boolean).join("\n").trim() || "Gated action completed.";
  return {
    kind: "handled",
    result: synthesizeTextReply({ text, context }).result
  };
}

async function runPostLlmSafetyScaffoldFallback(input: PostLlmSafetyScaffoldInput): Promise<PlannedAgentResult | undefined> {
  void input.reason;
  // This bounded scaffold runs only when the LLM is genuinely unavailable (stub mode,
  // error, or empty output). It is not planner success and must not expand into the
  // primary business brain. When the LLM is available but did not call tools, the
  // LLM's text is synthesized directly.
  if (input.session.profile.id === "customer_pms") {
    return runCustomerPmsLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  if (input.session.profile.id === "admin_customization") {
    return runAdminProposalLoop({ turn: input.turn, tools: input.session.tools, state: input.session.state });
  }

  return undefined;
}

function latestApproval(evidence: readonly PmsEvidence<unknown>[]): PlannedAgentResult | undefined {
  for (let index = evidence.length - 1; index >= 0; index -= 1) {
    const approval = synthesizePrepareConfirmApproval(evidence[index]);
    if (approval) return approval;
  }
  return undefined;
}

function gatedToolDetails(toolResult: import("./pi-session.js").AgentToolResult<unknown>): GatedToolResult<unknown> | undefined {
  const details = toolResult.details as Record<string, unknown>;
  if (!details || typeof details !== "object") return undefined;
  if (details.outcome !== "allow" && details.outcome !== "deny" && details.outcome !== "require_approval") return undefined;
  return details as GatedToolResult<unknown>;
}

function toolContentText(toolResult: import("./pi-session.js").AgentToolResult<unknown>): string {
  return toolResult.content.map((item) => item.type === "text" ? item.text : "").filter(Boolean).join("\n").trim();
}

function emitToolResultEvent(session: UnifiedAgentSession, options: RunAgentTurnOptions, toolName: string, toolResult: import("./pi-session.js").AgentToolResult<unknown>): void {
  const details = gatedToolDetails(toolResult);
  const value = details && "value" in details ? details.value : undefined;
  const outcome = details?.outcome ?? "unknown";
  emitEvent(options, {
    event: "pms_agent_tool_result",
    profile: session.profile.id,
    toolName,
    outcome,
    ...(isPmsEvidence(value) ? { evidenceMethod: value.source.method, diagnostics: pmsEvidenceDiagnostics(value) } : {})
  });
}

function pmsEvidenceDiagnostics(evidence: PmsEvidence<unknown>): Record<string, unknown> {
  const data = evidence.data as Record<string, unknown> | undefined;
  if (evidence.source.method === "searchAvailability" && data) {
    return compactDiagnostics({
      roomCount: Array.isArray(data.rooms) ? data.rooms.length : undefined,
      roomTypes: data.availableRoomTypes,
      requestedRoomType: data.requestedRoomType,
      alternativeRoomTypes: data.alternativeRoomTypes
    });
  }
  if (evidence.source.method === "inventorySummary" && data) {
    const dates = Array.isArray(data.dates) ? data.dates : [];
    const first = dates[0] as Record<string, unknown> | undefined;
    return compactDiagnostics({
      dateCount: dates.length,
      firstDateTotal: first?.total,
      roomTypes: data.roomTypes
    });
  }
  return {};
}

function compactDiagnostics(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
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
