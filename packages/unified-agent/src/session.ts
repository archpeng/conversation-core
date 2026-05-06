import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import { continuityPrompt, createRedactedSessionState, rememberRefs, rememberTurn, type RedactedSessionState } from "./continuity.js";
import type { PiAgentSession, PiCreateAgentSession, PiResourceLoaderFactory, PiToolDefinition } from "./pi-session.js";
import { buildSystemPrompt } from "./prompt.js";
import { loadAgentProfile, type UnifiedAgentProfile } from "./profile.js";
import { runCustomerPmsLoop } from "./customer-loop.js";
import { runAdminProposalLoop } from "./proposal-loop.js";
import { registerGatedTools, type UnifiedAgentToolExecutors } from "./tool-registration.js";

export type UnifiedAgentSession = {
  agentRuntime: "pi-coding-agent";
  profile: UnifiedAgentProfile;
  piSession: PiAgentSession;
  tools: readonly PiToolDefinition[];
  systemPrompt: string;
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
  const { session } = await input.createAgentSession({
    cwd: input.cwd,
    tools: [],
    customTools: tools,
    ...(input.createResourceLoader ? { resourceLoader: input.createResourceLoader(systemPrompt) } : {}),
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
    state: createRedactedSessionState({ sessionId: input.turn.sessionId, actorId: input.turn.actor.id, profileId: profile.id })
  };
}

export async function runAgentTurn(session: UnifiedAgentSession, turn: FeishuTurnInput, options: RunAgentTurnOptions = {}): Promise<AgentResult> {
  rememberTurn(session.state, turn, options);
  await session.piSession.prompt(turnPrompt(session, turn), { source: "pms-agent-v2" });

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

  return { type: "text", text: "Agent turn completed." };
}

function turnPrompt(session: UnifiedAgentSession, turn: FeishuTurnInput): string {
  return [
    session.systemPrompt,
    "Continuity refs:",
    continuityPrompt(session.state),
    "User message:",
    turn.message.text
  ].join("\n");
}
