import type { PiAgentSession, PiAssistantEvent } from "./pi-session.js";

export function parseAssistantToolPlanJson(text: string): { ok: true; hasPlan: true; value: unknown } | { ok: true; hasPlan: false } | { ok: false; hasPlan: true } {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return { ok: true, hasPlan: false };
  try {
    return { ok: true, hasPlan: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, hasPlan: true };
  }
}

export async function promptAssistantText(piSession: PiAgentSession, prompt: string): Promise<string> {
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
