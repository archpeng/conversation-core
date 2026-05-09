import type { AgentResult, FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import type { TSchema } from "typebox";
import type { AgentSessionFactory, AgentSessionFactoryOptions, AgentSessionPort, GatedToolDefinition, ResourceLoaderFactory } from "./pi-session.js";
import type { WorkspaceAdvisoryContextInput } from "./context-bundle.js";
import type { UnifiedAgentProfile } from "./profile.js";
import type { RedactedSessionState } from "./continuity.js";

export type RegisteredGatedTool = GatedToolDefinition<TSchema, GatedToolResult<unknown>>;

export type UnifiedAgentSession = {
  agentRuntime: "pi-coding-agent";
  profile: UnifiedAgentProfile;
  piSession: AgentSessionPort;
  tools: readonly RegisteredGatedTool[];
  systemPrompt: string;
  systemPromptInjected: boolean;
  state: RedactedSessionState;
};

export type CreateUnifiedAgentSessionInput = {
  turn: FeishuTurnInput;
  gateway: SafetyGatewayPort;
  createAgentSession: AgentSessionFactory;
  createResourceLoader?: ResourceLoaderFactory;
  cwd?: string;
  sessionFile?: string;
  sessionManager?: AgentSessionFactoryOptions["sessionManager"];
  authStorage?: AgentSessionFactoryOptions["authStorage"];
  modelRegistry?: AgentSessionFactoryOptions["modelRegistry"];
  executors?: import("./tool-registration.js").UnifiedAgentToolExecutors;
};

export type UnifiedAgentTurnEvent =
  | { event: "pms_agent_turn_planned"; profile: UnifiedAgentProfile["id"]; plannerPath: "pi_native_tools" | "no_tool_results"; toolCount?: number }
  | { event: "pms_agent_tool_result"; profile: UnifiedAgentProfile["id"]; toolName: string; outcome: string; evidenceMethod?: string; diagnostics?: Record<string, unknown> }
  | { event: "pms_agent_turn_result"; profile: UnifiedAgentProfile["id"]; resultType: AgentResult["type"]; evidenceCount: number; pendingActionCount: number }
  | { event: "pms_agent_turn_failed"; stage: "create_or_run_turn"; status: 502; errorName: string; errorMessageHash: string };

export type RunAgentTurnOptions = {
  evidenceRefs?: readonly string[];
  pendingActionRefs?: readonly string[];
  workspaceAdvisory?: readonly WorkspaceAdvisoryContextInput[];
  pmsEvidence?: readonly PmsEvidence<unknown>[];
  modelPriorSummary?: string;
  eventSink?: (event: UnifiedAgentTurnEvent) => void;
};
