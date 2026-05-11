import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReviewActionDetail, ReviewActionStatus, ReviewActionSummary } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient, type ShiftSummary } from "../../shared/api/client.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";

const filters: Array<ReviewActionStatus | "all"> = ["all", "committed", "rejected", "failed", "expired"];

export function ReviewView() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const [summary, setSummary] = useState<ShiftSummary>();
  const [actions, setActions] = useState<ReviewActionSummary[]>([]);
  const [detail, setDetail] = useState<ReviewActionDetail>();
  const [filter, setFilter] = useState<ReviewActionStatus | "all">("all");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      const [nextSummary, nextActions] = await Promise.all([
        client.getShiftSummary(),
        client.listReviewActions(filter === "all" ? undefined : filter)
      ]);
      setSummary(nextSummary);
      setActions(nextActions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review summary failed.");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(action: ReviewActionSummary) {
    setError(undefined);
    try {
      setDetail(await client.getReviewAction(action.taskId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review detail failed.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Review</h2>
          <p className="text-sm text-muted">回顾性班次摘要，不作为主工作台。</p>
        </div>
        <Button onClick={refresh} disabled={loading} aria-label="Refresh review">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <Card>
        <CardTitle>Shift Summary</CardTitle>
        {summary ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Tasks" value={summary.totalTasks} />
            <Metric label="Read-only" value={summary.readOnly} />
            <Metric label="Committed" value={summary.committed} />
            <Metric label="Failed" value={summary.failed} />
            <Metric label="Safety audit" value={summary.safetyAudits?.total ?? 0} />
            <Metric label="PMS audit refs" value={summary.pmsAuditRefs?.total ?? 0} />
          </div>
        ) : (
          <CardText className="mt-1">Tap refresh to read current gateway ledger.</CardText>
        )}
      </Card>
      <Card>
        <CardTitle>Action Ledger</CardTitle>
        <div className="my-3 flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button key={item} variant={filter === item ? "primary" : "secondary"} onClick={() => setFilter(item)}>
              {item}
            </Button>
          ))}
        </div>
        {actions.length === 0 ? <CardText>Refresh to load terminal actions.</CardText> : null}
        <div className="space-y-2">
          {actions.map((action) => (
            <button key={action.taskId} className="w-full rounded-md border border-border bg-neutral-50 px-3 py-2 text-left text-sm text-ink" onClick={() => openDetail(action)}>
              <div className="font-medium">{action.title}</div>
              <div className="text-xs text-muted">{action.status} · Evidence {action.evidenceRefs.length} · PMS audit {action.pmsAuditRefs.length}</div>
            </button>
          ))}
        </div>
      </Card>
      {detail ? (
        <Card>
          <CardTitle>{detail.title}</CardTitle>
          <CardText className="mt-1">{detail.status} · {detail.updatedAt}</CardText>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Evidence" value={detail.evidenceRefs.length} />
            <Metric label="Safety audit" value={detail.safetyAuditRefs.length} />
            <Metric label="PMS audit" value={detail.pmsAuditRefs.length} />
            <Metric label="Cards" value={detail.task.actionCards?.length ?? 0} />
          </div>
          {detail.actor ? <CardText className="mt-3">Actor {detail.actor.role}:{detail.actor.id}</CardText> : null}
          <RefList title="Evidence" refs={detail.evidenceRefs} />
          <RefList title="Safety audit" refs={detail.safetyAuditRefs} />
          <RefList title="PMS audit" refs={detail.pmsAuditRefs} />
        </Card>
      ) : null}
    </div>
  );
}

function RefList({ title, refs }: { title: string; refs: string[] }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 space-y-1">
      <div className="text-xs font-medium text-muted">{title}</div>
      {refs.map((ref) => (
        <div key={ref} className="break-all rounded-md border border-border bg-neutral-50 px-2 py-1 text-xs text-ink">
          {ref}
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-neutral-50 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
