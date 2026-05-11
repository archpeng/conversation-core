import type { AgentTask, AgentTaskStatus } from "@pms-agent-v2/product-contracts";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardHeader, CardText, CardTitle } from "./ui/card.js";

type TaskCardProps = {
  task: AgentTask;
  busyActionId?: string;
  onAction?: (task: AgentTask, cardId: string, actionId: string) => void;
};

export function TaskCard({ task, busyActionId, onAction }: TaskCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="break-words">{task.title}</CardTitle>
          <CardText className="mt-1 break-words">{task.summary}</CardText>
        </div>
        <Badge tone={toneForStatus(task.status)}>{labelForStatus(task.status)}</Badge>
      </CardHeader>
      {task.messages?.length ? (
        <div className="space-y-2">
          {task.messages.slice(0, 4).map((message) => (
            <div key={message} className="rounded-md border border-border bg-neutral-50 px-3 py-2 text-sm text-ink">
              {message}
            </div>
          ))}
        </div>
      ) : null}
      {task.actionCards?.map((card) => (
        <div key={card.id} className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-sm font-medium text-ink">{card.title}</div>
          <p className="mb-3 text-sm leading-6 text-muted">{card.summary}</p>
          <div className="flex flex-wrap gap-2">
            {card.actions.map((action) => (
              <Button
                key={action.id}
                disabled={action.disabled || busyActionId === `${task.id}:${card.id}:${action.id}`}
                variant={action.kind === "danger" ? "danger" : action.kind === "primary" ? "primary" : "secondary"}
                onClick={() => onAction?.(task, card.id, action.id)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {task.evidenceRefs?.length ? (
        <div className="mt-3 truncate text-xs text-muted">Evidence {task.evidenceRefs.length}</div>
      ) : null}
    </Card>
  );
}

function toneForStatus(status: AgentTaskStatus) {
  if (status === "failed" || status === "rejected" || status === "expired") return "danger";
  if (status === "awaiting_confirmation" || status === "needs_slots" || status === "draft_ready") return "warning";
  if (status === "committed") return "success";
  return "neutral";
}

function labelForStatus(status: AgentTaskStatus): string {
  const labels: Record<AgentTaskStatus, string> = {
    suggested: "建议",
    needs_slots: "待补充",
    draft_ready: "草稿",
    awaiting_confirmation: "待确认",
    committed: "已完成",
    rejected: "已拒绝",
    failed: "失败",
    expired: "过期",
    read_only: "只读"
  };
  return labels[status];
}
