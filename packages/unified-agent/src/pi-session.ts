export type PiToolTextContent = {
  type: "text";
  text: string;
};

export type PiToolResult = {
  content: PiToolTextContent[];
  details: unknown;
};

export type PiToolDefinition<Parameters = Record<string, unknown>> = {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute(toolCallId: string, params: Parameters, signal?: AbortSignal, onUpdate?: unknown, context?: unknown): Promise<PiToolResult>;
};

export type PiAgentSession = {
  prompt(text: string, options?: { source?: string; streamingBehavior?: "steer" | "followUp" }): Promise<void>;
  dispose?(): void;
};

export type PiCreateAgentSessionOptions = {
  cwd?: string;
  tools: readonly string[];
  customTools: readonly PiToolDefinition[];
  resourceLoader?: unknown;
  sessionManager?: unknown;
  authStorage?: unknown;
  modelRegistry?: unknown;
};

export type PiCreateAgentSession = (options: PiCreateAgentSessionOptions) => Promise<{ session: PiAgentSession }>;

export type PiResourceLoaderFactory = (systemPrompt: string) => unknown;
