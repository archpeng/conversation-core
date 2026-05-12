import { SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ActionCard, ActionCardAction, AgentTask, MobileSession, ObjectRef } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient } from "../../shared/api/client.js";
import { Badge } from "../../shared/components/ui/badge.js";
import { Button } from "../../shared/components/ui/button.js";
import { Textarea } from "../../shared/components/ui/textarea.js";
import { cn } from "../../shared/components/utils.js";
import { mergeTaskConversationItems, type ConversationItem, type StatusTone } from "./agent-conversation.js";

const quickPrompts = ["今天到店", "查可用房", "看房态", "今日库存"];

export function AgentFeed() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const itemCounter = useRef(0);
  const [mobileSession, setMobileSession] = useState<MobileSession>();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [text, setText] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [turnPending, setTurnPending] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    client.getSession()
      .then((session) => {
        if (!cancelled) setMobileSession(session);
      })
      .catch((cause) => {
        if (!cancelled) {
          appendStatus(`连接失败：${messageFor(cause)}`, "danger");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    const scrollIntoView = listEndRef.current?.scrollIntoView;
    if (typeof scrollIntoView === "function") scrollIntoView.call(listEndRef.current, { block: "end" });
  }, [items, turnPending, busyActionId]);

  function nextId(prefix: string): string {
    itemCounter.current += 1;
    return `${prefix}-${itemCounter.current}`;
  }

  function appendStatus(statusText: string, tone: StatusTone): void {
    setItems((current) => [...current, { id: nextId("status"), kind: "status", text: statusText, tone, at: new Date().toISOString() }]);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitText(text);
  }

  async function submitText(input: string) {
    const trimmed = input.trim();
    if (!trimmed || turnPending) return;
    setText("");
    setTurnPending(true);
    setItems((current) => [...current, { id: nextId("user"), kind: "user", text: trimmed, at: new Date().toISOString() }]);
    try {
      if (!mobileSession) throw new Error("Mobile session is not ready.");
      const response = await client.sendTurn({
        channel: "mobile",
        tenantId: mobileSession.tenantId,
        propertyId: mobileSession.propertyId,
        sessionId: mobileSession.sessionId,
        messageId: `mobile-web-${Date.now()}`,
        actor: mobileSession.actor,
        message: { text: trimmed },
        device: { platform: "web", locale: navigator.language },
        receivedAt: new Date().toISOString()
      });
      appendTask(response.task);
    } catch (cause) {
      appendStatus(`发送失败：${messageFor(cause)}`, "danger");
    } finally {
      setTurnPending(false);
    }
  }

  async function executeAction(taskId: string, card: ActionCard, action: ActionCardAction) {
    const busyId = `${taskId}:${card.id}:${action.id}`;
    setBusyActionId(busyId);
    try {
      if (!mobileSession) throw new Error("Mobile session is not ready.");
      const response = await client.executeAction(taskId, card.id, action.id, {
        sessionId: mobileSession.sessionId,
        tenantId: mobileSession.tenantId,
        propertyId: mobileSession.propertyId,
        actor: mobileSession.actor,
        ...(action.id === "cancel" ? { reason: "cancelled from mobile web" } : {})
      });
      appendTask(response.task);
    } catch (cause) {
      appendStatus(`操作失败：${messageFor(cause)}`, "danger");
    } finally {
      setBusyActionId(undefined);
    }
  }

  function appendTask(task: AgentTask): void {
    const at = new Date().toISOString();
    setItems((current) => mergeTaskConversationItems(current, task, at, nextId));
  }

  const online = Boolean(mobileSession) && !sessionLoading;
  const showQuickPrompts = items.length === 0 && !turnPending;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-[#f7f7f5] px-4 py-2 text-xs">
        <span className="font-medium text-ink">Agent 对话</span>
        <span className={cn("rounded px-2 py-1", online ? "bg-green-50 text-green-700" : sessionLoading ? "bg-neutral-100 text-muted" : "bg-red-50 text-red-700")}>
          {online ? "在线" : sessionLoading ? "连接中" : "不可用"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {items.length === 0 ? (
          <div className="mx-auto max-w-xs pt-16 text-center text-sm leading-6 text-muted">
            直接说要查什么或要处理什么，Agent 会把需要确认的动作放进对话里。
          </div>
        ) : null}
        <div className="space-y-3">
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} busyActionId={busyActionId} onAction={executeAction} onObjectQuery={(ref) => void submitText(objectQueryText(ref))} />
          ))}
          {turnPending ? <StatusBubble text="Agent 正在处理..." tone="info" /> : null}
          <div ref={listEndRef} />
        </div>
      </div>

      <form className="border-t border-border bg-white px-3 pb-3 pt-2" onSubmit={submitForm}>
        {showQuickPrompts ? (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {quickPrompts.map((prompt) => (
              <Button key={prompt} type="button" variant="secondary" className="min-h-8 shrink-0 px-3 py-1 text-xs" disabled={!mobileSession || turnPending} onClick={() => void submitText(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-11 max-h-28 flex-1 py-2"
            aria-label="Agent message"
            placeholder="发消息给 Agent"
          />
          <Button type="submit" variant="primary" className="h-11 min-h-11 w-11 px-0" disabled={sessionLoading || turnPending || !mobileSession || !text.trim()} aria-label="Send message">
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function ConversationRow({ item, busyActionId, onAction, onObjectQuery }: { item: ConversationItem; busyActionId?: string; onAction(taskId: string, card: ActionCard, action: ActionCardAction): void; onObjectQuery(ref: ObjectRef): void }) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-md bg-ink px-3 py-2 text-sm leading-6 text-white">
          {item.text}
        </div>
      </div>
    );
  }
  if (item.kind === "agent") {
    return (
      <div className="max-w-[88%] rounded-md bg-white px-3 py-2 text-sm leading-6 text-ink">
        <div className="whitespace-pre-wrap">{item.text}</div>
        <ObjectRefChips refs={item.objectRefs} onObjectQuery={onObjectQuery} />
        <EvidenceDisclosure evidenceRefs={item.evidenceRefs} />
      </div>
    );
  }
  if (item.kind === "actionCard") {
    return <ActionCardBubble taskId={item.taskId} card={item.card} busyActionId={busyActionId} onAction={onAction} />;
  }
  return <StatusBubble text={item.text} tone={item.tone} />;
}

function ObjectRefChips({ refs, onObjectQuery }: { refs: readonly ObjectRef[]; onObjectQuery(ref: ObjectRef): void }) {
  const reservationRefs = refs.filter((ref) => ref.kind === "reservation").slice(0, 4);
  if (reservationRefs.length === 0) return null;
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {reservationRefs.map((ref) => (
        <button
          key={`${ref.kind}:${ref.id}`}
          type="button"
          className="shrink-0 rounded border border-border bg-neutral-50 px-2 py-1 text-xs text-ink"
          onClick={() => onObjectQuery(ref)}
        >
          {ref.label ?? ref.id}
        </button>
      ))}
    </div>
  );
}

function objectQueryText(ref: ObjectRef): string {
  if (ref.kind === "reservation") return `查询预订 ${ref.id} 的客人详情`;
  return `查询 ${ref.kind} ${ref.id}`;
}

function ActionCardBubble({ taskId, card, busyActionId, onAction }: { taskId: string; card: ActionCard; busyActionId?: string; onAction(taskId: string, card: ActionCard, action: ActionCardAction): void }) {
  return (
    <div className="max-w-[92%] rounded-md border border-border bg-white px-3 py-2 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-medium text-ink">{card.title}</div>
        <Badge tone={toneForMutation(card.mutationStatus)}>{labelForMutation(card.mutationStatus)}</Badge>
      </div>
      <p className="leading-6 text-muted">{card.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            disabled={action.disabled || busyActionId === `${taskId}:${card.id}:${action.id}`}
            variant={action.kind === "danger" ? "danger" : action.kind === "primary" ? "primary" : "secondary"}
            onClick={() => onAction(taskId, card, action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StatusBubble({ text, tone }: { text: string; tone: StatusTone }) {
  const tones: Record<StatusTone, string> = {
    info: "bg-neutral-100 text-muted",
    success: "bg-green-50 text-green-700",
    warning: "bg-yellow-50 text-yellow-700",
    danger: "bg-red-50 text-red-700"
  };
  return <div className={cn("mx-auto max-w-[92%] rounded px-3 py-2 text-center text-xs", tones[tone])}>{text}</div>;
}

function EvidenceDisclosure({ evidenceRefs }: { evidenceRefs: readonly string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (evidenceRefs.length === 0) return null;
  const label = `PMS 证据 ${evidenceRefs.length} 条`;
  return (
    <div className="mt-2 text-xs text-muted">
      <button type="button" className="inline-flex items-center" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <Badge tone="neutral">{label}</Badge>
      </button>
      {expanded ? (
        <ol className="mt-2 space-y-1 border-l border-border pl-3">
          {evidenceRefs.map((ref, index) => (
            <li key={`${ref}-${index}`} className="space-y-0.5">
              <div>{`证据 ${index + 1}`}</div>
              <code className="block break-all rounded bg-neutral-100 px-2 py-1 font-mono text-[11px] leading-4 text-neutral-700">{ref}</code>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function toneForMutation(status: ActionCard["mutationStatus"]) {
  if (status === "committed") return "success";
  if (status === "failed" || status === "rejected" || status === "expired") return "danger";
  if (status === "awaitingConfirmation" || status === "draftOnly") return "warning";
  return "neutral";
}

function labelForMutation(status: ActionCard["mutationStatus"]): string {
  const labels: Record<ActionCard["mutationStatus"], string> = {
    none: "无操作",
    draftOnly: "草稿",
    awaitingConfirmation: "待确认",
    committed: "已完成",
    rejected: "已拒绝",
    expired: "过期",
    failed: "失败"
  };
  return labels[status];
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Product gateway request failed.";
}
