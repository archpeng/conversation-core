import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductGatewayClient, type ShiftSummary } from "../../shared/api/client.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";

export function ReviewView() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const [summary, setSummary] = useState<ShiftSummary>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      setSummary(await client.getShiftSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review summary failed.");
    } finally {
      setLoading(false);
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
