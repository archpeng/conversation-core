import type {
  AgentSession,
  AgentSessionEvent,
  AgentToolResult,
  CreateAgentSessionOptions,
  ResourceLoader,
  ToolDefinition
} from "@mariozechner/pi-coding-agent";
import type { TSchema } from "typebox";

export type {
  AgentSession,
  AgentSessionEvent,
  AgentToolResult,
  CreateAgentSessionOptions,
  ResourceLoader,
  ToolDefinition
} from "@mariozechner/pi-coding-agent";

export type AgentSessionPort = {
  prompt: AgentSession["prompt"];
  subscribe?: (listener: (event: AgentSessionEvent) => void) => () => void;
  readonly messages?: unknown[];
  dispose?: AgentSession["dispose"];
};

export type GatedToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown> = Omit<ToolDefinition<TParams, TDetails>, "renderCall" | "renderResult"> & {
  executePlan(params: Record<string, unknown>): Promise<AgentToolResult<TDetails>>;
};

export type AgentSessionFactoryOptions = Omit<CreateAgentSessionOptions, "customTools" | "tools"> & {
  sessionFile?: string;
  tools: readonly string[];
  customTools: readonly GatedToolDefinition[];
};

export type AgentSessionFactory = (options: AgentSessionFactoryOptions) => Promise<{ session: AgentSessionPort }>;

export type ResourceLoaderFactory = (systemPrompt: string) => ResourceLoader | Promise<ResourceLoader>;
