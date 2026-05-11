import { productError, reviewActionStatuses, type AgentTask, type ReviewActionStatus } from "@pms-agent-v2/product-contracts";
import { readSafetyAuditSummary, type SafetyAuditReviewSummary } from "../audit-readback.js";
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

export async function handleReviewActionListRoute(context: ProductRouteContext, status: string | undefined): Promise<ProductGatewayResponse> {
  const safetyAudits = await readSafetyAuditSummary(context.config.safetyAuditLogPath);
  const wanted = reviewStatus(status);
  const actions = context.tasks.list()
    .flatMap((task) => {
      const currentStatus = reviewStatus(task.status);
      if (!currentStatus || (wanted && currentStatus !== wanted)) return [];
      return [actionSummary(task, currentStatus, safetyAudits)];
    });
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { ok: true, actions }
  };
}

export async function handleReviewActionDetailRoute(context: ProductRouteContext, taskId: string): Promise<ProductGatewayResponse> {
  const task = context.tasks.get(taskId);
  if (!task) {
    return {
      status: 404,
      headers: { "content-type": "application/json" },
      body: productError("unsupported", "Review action was not found.")
    };
  }
  const status = reviewStatus(task.status);
  if (!status) {
    return {
      status: 400,
      headers: { "content-type": "application/json" },
      body: productError("invalid_request", "Review detail is available only for terminal action states.")
    };
  }
  const safetyAudits = await readSafetyAuditSummary(context.config.safetyAuditLogPath);
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { ok: true, action: { ...actionSummary(task, status, safetyAudits), task, ...actorFromTask(task) } }
  };
}

function taskAuditRefs(tasks: ReturnType<ProductRouteContext["tasks"]["list"]>): string[] {
  return Array.from(new Set(tasks.flatMap((task) => [
    ...(task.auditRefs ?? []),
    ...(task.actionCards?.flatMap((card) => card.auditRefs ?? []) ?? [])
  ])));
}

function actionSummary(task: AgentTask, status: ReviewActionStatus, safetyAudits: SafetyAuditReviewSummary) {
  return {
    taskId: task.id,
    title: task.title,
    status,
    updatedAt: task.updatedAt,
    evidenceRefs: Array.from(new Set([
      ...(task.evidenceRefs ?? []),
      ...(task.actionCards?.flatMap((card) => card.evidenceRefs ?? []) ?? [])
    ])),
    safetyAuditRefs: safetyAudits.recent.map((event) => event.id),
    pmsAuditRefs: taskAuditRefs([task])
  };
}

function reviewStatus(value: unknown): ReviewActionStatus | undefined {
  return reviewActionStatuses.find((status) => status === value);
}

function actorFromTask(task: AgentTask): { actor: { role: string; id: string } } | Record<string, never> {
  const actorMessage = task.messages?.find((message) => message.startsWith("Actor "));
  const match = /^Actor ([^:]+):([^ ]+) executed typed card\.$/.exec(actorMessage ?? "");
  if (!match || !match[1] || !match[2]) return {};
  return { actor: { role: match[1], id: match[2] } };
}
