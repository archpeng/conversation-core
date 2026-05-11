import { readSafetyAuditSummary } from "../audit-readback.js";
import type { ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleShiftSummaryRoute(context: ProductRouteContext): Promise<ProductGatewayResponse> {
  const tasks = context.tasks.list();
  const failed = tasks.filter((task) => task.status === "failed" || task.status === "rejected").length;
  const committed = tasks.filter((task) => task.status === "committed").length;
  const readOnly = tasks.filter((task) => task.status === "read_only").length;
  const auditRefs = taskAuditRefs(tasks);
  const safetyAudits = await readSafetyAuditSummary(context.config.safetyAuditLogPath);
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      ok: true,
      summary: {
        totalTasks: tasks.length,
        readOnly,
        committed,
        failed,
        latestTaskAt: tasks[0]?.updatedAt,
        pmsAuditRefs: {
          total: auditRefs.length,
          latest: auditRefs[0]
        },
        safetyAudits
      }
    }
  };
}

function taskAuditRefs(tasks: ReturnType<ProductRouteContext["tasks"]["list"]>): string[] {
  return Array.from(new Set(tasks.flatMap((task) => [
    ...(task.auditRefs ?? []),
    ...(task.actionCards?.flatMap((card) => card.auditRefs ?? []) ?? [])
  ])));
}
