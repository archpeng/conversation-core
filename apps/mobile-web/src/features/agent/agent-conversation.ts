import type { ActionCard, AgentTask, ObjectRef } from "@pms-agent-v2/product-contracts";

export type ConversationItem =
  | { id: string; kind: "user"; text: string; at: string }
  | { id: string; kind: "agent"; text: string; evidenceRefs: string[]; objectRefs: ObjectRef[]; at: string }
  | { id: string; kind: "actionCard"; taskId: string; card: ActionCard; at: string }
  | { id: string; kind: "status"; text: string; tone: StatusTone; at: string };

export type StatusTone = "info" | "success" | "warning" | "danger";

export function conversationItemsForTask(task: AgentTask, at: string, nextId: (prefix: string) => string): ConversationItem[] {
  const items: ConversationItem[] = [];
  const text = textForTask(task);
  if (text) {
    items.push({ id: nextId("agent"), kind: "agent", text, evidenceRefs: task.evidenceRefs ?? [], objectRefs: task.objectRefs ?? [], at });
  }
  for (const card of task.actionCards ?? []) {
    items.push({ id: nextId("action"), kind: "actionCard", taskId: task.id, card, at });
  }
  if (!text && !task.actionCards?.length) {
    items.push({ id: nextId("status"), kind: "status", text: task.summary, tone: task.status === "failed" ? "danger" : "info", at });
  }
  return items;
}

export function mergeTaskConversationItems(current: readonly ConversationItem[], task: AgentTask, at: string, nextId: (prefix: string) => string): ConversationItem[] {
  const incoming = conversationItemsForTask(task, at, nextId);
  const incomingCards = new Map((task.actionCards ?? []).map((card) => [card.id, card]));
  const updated = current.map((item) => {
    if (item.kind !== "actionCard" || item.taskId !== task.id) return item;
    const replacement = incomingCards.get(item.card.id);
    if (replacement) return { ...item, card: replacement };
    if (isTerminalTaskStatus(task.status)) return { ...item, card: disabledCard(item.card, task.status) };
    return item;
  });
  const existingCardIds = existingActionCardIds(updated, task.id);
  const newItems = incoming.filter((item) => item.kind !== "actionCard" || item.taskId !== task.id || !existingCardIds.has(item.card.id));
  return [...updated, ...newItems];
}

function existingActionCardIds(items: readonly ConversationItem[], taskId: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.kind === "actionCard" && item.taskId === taskId) ids.add(item.card.id);
  }
  return ids;
}

function disabledCard(card: ActionCard, status: AgentTask["status"]): ActionCard {
  return {
    ...card,
    mutationStatus: mutationStatusForTask(status, card.mutationStatus),
    actions: card.actions.map((action) => ({ ...action, disabled: true }))
  };
}

function isTerminalTaskStatus(status: AgentTask["status"]): boolean {
  return status === "committed" || status === "rejected" || status === "failed" || status === "expired";
}

function mutationStatusForTask(status: AgentTask["status"], fallback: ActionCard["mutationStatus"]): ActionCard["mutationStatus"] {
  if (status === "committed" || status === "rejected" || status === "failed" || status === "expired") return status;
  return fallback;
}

function textForTask(task: AgentTask): string {
  const messages = task.messages?.filter((message) => message.trim()) ?? [];
  return messages.length > 0 ? messages.join("\n\n") : task.summary;
}
