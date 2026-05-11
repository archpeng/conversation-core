import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { AgentTask } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient, defaultScope } from "../../shared/api/client.js";
import { TaskCard } from "../../shared/components/TaskCard.js";
import { Button } from "../../shared/components/ui/button.js";
import { defaultMobileSession } from "../../shared/session/mobile-session.js";

export function TasksView() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const scope = useMemo(() => defaultScope(), []);
  const mobileSession = useMemo(() => defaultMobileSession(), []);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string>();

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await client.listTasks(scope);
      setTasks(response.tasks);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(task: AgentTask, cardId: string, actionId: string) {
    const busyId = `${task.id}:${cardId}:${actionId}`;
    setBusyActionId(busyId);
    setError(undefined);
    try {
      const response = await client.executeAction(task.id, cardId, actionId, {
        actor: mobileSession.actor,
        ...(actionId === "cancel" ? { reason: "cancelled from mobile web" } : {})
      });
      setTasks((current) => [response.task, ...current.filter((item) => item.id !== response.task.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusyActionId(undefined);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Tasks</h2>
          <p className="text-sm text-muted">只读任务和 Agent 卡片。</p>
        </div>
        <Button onClick={refresh} disabled={loading} aria-label="Refresh tasks">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {tasks.length === 0 ? <div className="text-sm text-muted">Tap refresh to load real gateway tasks.</div> : null}
      {tasks.map((task) => <TaskCard key={task.id} task={task} busyActionId={busyActionId} onAction={executeAction} />)}
    </div>
  );
}
