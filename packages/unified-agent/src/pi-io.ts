import type { AgentSessionEvent, AgentSessionPort, AgentToolResult } from "./pi-session.js";

export type AssistantTurnToolResult = {
  toolCallId?: string;
  toolName: string;
  result: AgentToolResult<unknown>;
  isError: boolean;
};

export type AssistantTurn = {
  text: string;
  toolResults: readonly AssistantTurnToolResult[];
};

export async function promptAssistantText(piSession: AgentSessionPort, prompt: string): Promise<string> {
  return (await promptAssistantTurn(piSession, prompt)).text;
}

export async function promptAssistantTurn(piSession: AgentSessionPort, prompt: string): Promise<AssistantTurn> {
  const assistantText: string[] = [];
  const toolResults: AssistantTurnToolResult[] = [];
  const toolCallIds = new Set<string>();
  let unsubscribe: (() => void) | undefined;
  if (piSession.subscribe) {
    unsubscribe = piSession.subscribe((event) => collectAssistantTurnEvent(event, assistantText, toolResults, toolCallIds));
  }
  try {
    await piSession.prompt(prompt, { source: "rpc" });
  } finally {
    unsubscribe?.();
  }
  const text = assistantText.length > 0 ? assistantText.join("") : extractVisibleText(latestAssistantMessage(piSession.messages));
  return { text, toolResults };
}

function collectAssistantTurnEvent(event: AgentSessionEvent, assistantText: string[], toolResults: AssistantTurnToolResult[], toolCallIds: Set<string>): void {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta" && typeof event.assistantMessageEvent.delta === "string") {
    assistantText.push(event.assistantMessageEvent.delta);
    return;
  }
  if (event.type === "tool_execution_end" && !event.isError) {
    toolResults.push({ toolCallId: event.toolCallId, toolName: event.toolName, result: event.result as AgentToolResult<unknown>, isError: false });
    toolCallIds.add(event.toolCallId);
    return;
  }
  if (event.type === "turn_end") {
    const text = extractVisibleText(event.message);
    if (text && assistantText.length === 0) assistantText.push(text);
    collectTurnEndToolResults(event.toolResults, toolResults, toolCallIds);
  }
}

function collectTurnEndToolResults(messages: unknown, toolResults: AssistantTurnToolResult[], toolCallIds: Set<string>): void {
  if (!Array.isArray(messages)) return;
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) continue;
    const record = message as Record<string, unknown>;
    const toolCallId = typeof record.toolCallId === "string" ? record.toolCallId : undefined;
    const toolName = typeof record.toolName === "string" ? record.toolName : undefined;
    if (!toolCallId || !toolName || toolCallIds.has(toolCallId)) continue;
    const content = Array.isArray(record.content) ? record.content : [];
    toolResults.push({
      toolCallId,
      toolName,
      result: { content, details: record.details } as AgentToolResult<unknown>,
      isError: record.isError === true
    });
    toolCallIds.add(toolCallId);
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

export function extractVisibleText(message: unknown): string {
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
