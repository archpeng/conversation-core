import { SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgentTask, MobileSession } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient, defaultScope, mergeTask } from "../../shared/api/client.js";
import { ReservationWorkflowView } from "../reservations/ReservationWorkflowView.js";
import { TaskCard } from "../../shared/components/TaskCard.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";
import { Textarea } from "../../shared/components/ui/textarea.js";

const quickPrompts = ["今天到店", "查可用房", "看房态", "今日库存"];

export function AgentFeed() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const initialScope = useMemo(() => defaultScope(), []);
  const [mobileSession, setMobileSession] = useState<MobileSession>();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [text, setText] = useState("今天到店情况");
  const [loading, setLoading] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client.getSession()
      .then(async (session) => {
        if (cancelled) return;
        setMobileSession(session);
        const response = await client.listTasks({ tenantId: session.tenantId, propertyId: session.propertyId, businessDate: initialScope.businessDate });
        if (!cancelled) setTasks(response.tasks);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, initialScope.businessDate]);

  async function submitTurn() {
    if (!text.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      if (!mobileSession) throw new Error("Mobile session is not ready.");
      const response = await client.sendTurn({
        channel: "mobile",
        tenantId: mobileSession.tenantId,
        propertyId: mobileSession.propertyId,
        sessionId: mobileSession.sessionId,
        messageId: `mobile-web-${Date.now()}`,
        actor: mobileSession.actor,
        message: { text: text.trim() },
        device: { platform: "web", locale: navigator.language },
        receivedAt: new Date().toISOString()
      });
      setTasks((current) => mergeTask(current, response.task));
      setText("");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(task: AgentTask, cardId: string, actionId: string) {
    const busyId = `${task.id}:${cardId}:${actionId}`;
    setBusyActionId(busyId);
    setError(undefined);
    try {
      if (!mobileSession) throw new Error("Mobile session is not ready.");
      const response = await client.executeAction(task.id, cardId, actionId, {
        sessionId: mobileSession.sessionId,
        tenantId: mobileSession.tenantId,
        propertyId: mobileSession.propertyId,
        actor: mobileSession.actor,
        ...(actionId === "cancel" ? { reason: "cancelled from mobile web" } : {})
      });
      setTasks((current) => mergeTask(current, response.task));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusyActionId(undefined);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Ask Agent</CardTitle>
        <CardText className="mb-3 mt-1">真实连接 Product Gateway；后端不可用时不会降级成 mock。</CardText>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Agent request" />
        <div className="mt-3 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button key={prompt} variant="secondary" onClick={() => setText(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
        <Button className="mt-3 w-full" variant="primary" onClick={submitTurn} disabled={loading || !mobileSession || !text.trim()}>
          <SendHorizontal className="h-4 w-4" />
          Send
        </Button>
      </Card>
      <ReservationWorkflowView session={mobileSession} onTask={(task) => setTasks((current) => mergeTask(current, task))} />
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {loading && tasks.length === 0 ? <div className="text-sm text-muted">Loading real backend feed...</div> : null}
      <div className="space-y-3">
        {tasks.map((task) => <TaskCard key={task.id} task={task} busyActionId={busyActionId} onAction={executeAction} />)}
      </div>
    </div>
  );
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Product gateway request failed.";
}
