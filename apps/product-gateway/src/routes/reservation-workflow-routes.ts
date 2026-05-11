import {
  productError,
  validateReservationDraftUpdateInput,
  validateReservationGroupDraftInput,
  validateReservationGroupUpdateInput,
  validateReservationSingleDraftInput,
  validateReservationWorkflowRefInput
} from "@pms-agent-v2/product-contracts";
import type { ActionCard, AgentTask } from "@pms-agent-v2/product-contracts";
import type {
  PmsEvidence,
  ReservationConfirmPreparation,
  ReservationDraftFact,
  ReservationGroupDraftFact,
  ReservationGroupQuoteFact,
  ReservationQuoteFact
} from "@pms-agent-v2/pms-platform-client";
import type { ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleReservationWorkflowRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest): Promise<ProductGatewayResponse | undefined> {
  const route = parseReservationRoute(request.method, request.path);
  if (!route) return undefined;
  try {
    if (route.kind === "single-create") return json(200, { ok: true, task: await singleCreateTask(context, pmsClient, request.body) });
    if (route.kind === "single-update") return json(200, { ok: true, task: await singleUpdateTask(context, pmsClient, request.body, requiredRef(route.ref)) });
    if (route.kind === "single-quote") return json(200, { ok: true, task: await singleQuoteTask(context, pmsClient, request.body, requiredRef(route.ref)) });
    if (route.kind === "single-prepare") return json(200, { ok: true, task: await singlePrepareTask(context, pmsClient, request.body, requiredRef(route.ref)) });
    if (route.kind === "group-create") return json(200, { ok: true, task: await groupCreateTask(context, pmsClient, request.body) });
    if (route.kind === "group-update") return json(200, { ok: true, task: await groupUpdateTask(context, pmsClient, request.body, requiredRef(route.ref)) });
    if (route.kind === "group-quote") return json(200, { ok: true, task: await groupQuoteTask(context, pmsClient, request.body, requiredRef(route.ref)) });
    return json(200, { ok: true, task: await groupPrepareTask(context, pmsClient, request.body, requiredRef(route.ref)) });
  } catch (cause) {
    if (cause instanceof RouteValidationError) return json(400, productError("invalid_request", cause.message));
    return json(502, productError("backend_unavailable", "PMS Platform reservation workflow is unavailable."));
  }
}

export async function handlePendingActionStatusRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest, pendingActionId: string): Promise<ProductGatewayResponse> {
  const tenantId = request.query.get("tenantId") ?? context.config.defaultTenantId;
  const cardPayloadRef = request.query.get("cardPayloadRef") ?? undefined;
  if (!tenantId || !pendingActionId) return json(400, productError("invalid_request", "tenantId and pendingActionId are required."));
  try {
    const evidence = await pmsClient.pendingActionStatus({ tenantId, pendingActionId, ...(cardPayloadRef ? { cardPayloadRef } : {}) });
    return json(200, {
      ok: true,
      status: evidence.data.status,
      pendingActionId: evidence.data.pendingActionId,
      evidenceRefs: [evidence.evidenceRef]
    });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform pending action status is unavailable."));
  }
}

async function singleCreateTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown): Promise<AgentTask> {
  const input = valid(validateReservationSingleDraftInput(body));
  const evidence = await pmsClient.createReservationDraft(input);
  return addTask(context, draftTask("single", input.tenantId, evidence));
}

async function singleUpdateTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, draftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationDraftUpdateInput({ ...(asBody(body)), draftRef }));
  const evidence = await pmsClient.updateReservationDraft(input);
  return addTask(context, draftTask("single", input.tenantId, evidence));
}

async function singleQuoteTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, draftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationWorkflowRefInput({ ...(asBody(body)), draftRef }));
  const evidence = await pmsClient.quoteReservationDraft({ tenantId: input.tenantId, draftRef });
  return addTask(context, quoteTask("single", input.tenantId, draftRef, evidence));
}

async function singlePrepareTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, draftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationWorkflowRefInput({ ...(asBody(body)), draftRef }));
  if (!input.quoteRef) throw new RouteValidationError("quoteRef is required for prepare-confirm.");
  const evidence = await pmsClient.prepareReservationConfirm({ tenantId: input.tenantId, draftRef, quoteRef: input.quoteRef });
  return addTask(context, prepareTask("single", input.tenantId, evidence));
}

async function groupCreateTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown): Promise<AgentTask> {
  const input = valid(validateReservationGroupDraftInput(body));
  const evidence = await pmsClient.createReservationGroupDraft(input);
  return addTask(context, groupDraftTask(input.tenantId, evidence));
}

async function groupUpdateTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, groupDraftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationGroupUpdateInput({ ...(asBody(body)), groupDraftRef }));
  const evidence = await pmsClient.updateReservationGroupDraft(input);
  return addTask(context, groupDraftTask(input.tenantId, evidence));
}

async function groupQuoteTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, groupDraftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationWorkflowRefInput({ ...(asBody(body)), groupDraftRef }));
  const evidence = await pmsClient.quoteReservationGroupDraft({ tenantId: input.tenantId, groupDraftRef });
  return addTask(context, groupQuoteTaskFromEvidence(input.tenantId, groupDraftRef, evidence));
}

async function groupPrepareTask(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, body: unknown, groupDraftRef: string): Promise<AgentTask> {
  const input = valid(validateReservationWorkflowRefInput({ ...(asBody(body)), groupDraftRef }));
  if (!input.quoteRef) throw new RouteValidationError("quoteRef is required for prepare-confirm.");
  const evidence = await pmsClient.prepareReservationGroupConfirm({ tenantId: input.tenantId, groupDraftRef, quoteRef: input.quoteRef });
  return addTask(context, prepareTask("group", input.tenantId, evidence));
}

function draftTask(kind: "single" | "group", tenantId: string, evidence: PmsEvidence<ReservationDraftFact>): AgentTask {
  const ref = evidence.data.draftRef ?? evidence.data.draftId ?? "draft";
  return baseTask({
    id: `reservation_${kind}_draft_${ref}`,
    title: kind === "single" ? "单房预订草稿" : "团队预订草稿",
    summary: `Draft ${ref} is ${evidence.data.status}.`,
    status: "draft_ready",
    tenantId,
    evidenceRefs: [evidence.evidenceRef],
    messages: ["Draft only. No final PMS reservation was created."]
  });
}

function groupDraftTask(tenantId: string, evidence: PmsEvidence<ReservationGroupDraftFact>): AgentTask {
  const ref = evidence.data.groupDraftRef ?? evidence.data.groupDraftId ?? "group_draft";
  return baseTask({
    id: `reservation_group_draft_${ref}`,
    title: "团队预订草稿",
    summary: `Group draft ${ref} is ${evidence.data.status}.`,
    status: "draft_ready",
    tenantId,
    evidenceRefs: [evidence.evidenceRef],
    messages: ["Group draft only. No final PMS reservation was created."]
  });
}

function quoteTask(kind: "single" | "group", tenantId: string, draftRef: string, evidence: PmsEvidence<ReservationQuoteFact>): AgentTask {
  const quoteRef = evidence.data.quoteRef ?? evidence.data.quoteId ?? "quote";
  return baseTask({
    id: `reservation_${kind}_quote_${quoteRef}`,
    title: kind === "single" ? "单房预订报价" : "团队预订报价",
    summary: `Quote ${quoteRef} is ready for draft ${draftRef}.`,
    status: "draft_ready",
    tenantId,
    evidenceRefs: [evidence.evidenceRef],
    messages: ["Quote only. Use prepare-confirm to create a typed pending-action card."]
  });
}

function groupQuoteTaskFromEvidence(tenantId: string, groupDraftRef: string, evidence: PmsEvidence<ReservationGroupQuoteFact>): AgentTask {
  return quoteTask("group", tenantId, groupDraftRef, {
    ...evidence,
    data: { quoteRef: evidence.data.quoteRef, status: evidence.data.status }
  });
}

function prepareTask(kind: "single" | "group", tenantId: string, evidence: PmsEvidence<ReservationConfirmPreparation>): AgentTask {
  const cardPayloadRef = evidence.data.cardPayloadRef ?? `card_${evidence.data.pendingActionId}`;
  return baseTask({
    id: `reservation_${kind}_pending_${evidence.data.pendingActionId}`,
    title: kind === "single" ? "待确认单房预订" : "待确认团队预订",
    summary: `Pending action ${evidence.data.pendingActionId} requires typed card confirmation.`,
    status: "awaiting_confirmation",
    tenantId,
    evidenceRefs: [evidence.evidenceRef],
    messages: ["Prepare-confirm stopped at pending action. Natural language confirmation is not approval."],
    actionCards: [{
      id: cardPayloadRef,
      title: kind === "single" ? "确认单房预订" : "确认团队预订",
      summary: "This card is the only path to final PMS confirmation.",
      mutationStatus: "awaitingConfirmation",
      confirmationMode: "typedCardOnly",
      evidenceRefs: [evidence.evidenceRef],
      operationRef: {
        type: "pmsPendingAction",
        tenantId,
        pendingActionId: evidence.data.pendingActionId,
        ...(evidence.data.pendingActionRef ? { pendingActionRef: evidence.data.pendingActionRef } : {}),
        cardPayloadRef,
        action: "reservation_confirm"
      },
      actions: [
        { id: "confirm", label: "确认", kind: "primary", confirmationRequired: true },
        { id: "cancel", label: "取消", kind: "secondary" }
      ]
    }]
  });
}

function baseTask(input: {
  id: string;
  title: string;
  summary: string;
  status: AgentTask["status"];
  tenantId: string;
  evidenceRefs: string[];
  messages: string[];
  actionCards?: ActionCard[];
}): AgentTask {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    status: input.status,
    source: "gateway",
    createdAt: timestamp,
    updatedAt: timestamp,
    evidenceRefs: input.evidenceRefs,
    objectRefs: [{ kind: "property", id: input.tenantId, label: input.tenantId }],
    messages: input.messages,
    ...(input.actionCards ? { actionCards: input.actionCards } : {})
  };
}

function addTask(context: ProductRouteContext, task: AgentTask): AgentTask {
  context.tasks.add(task);
  return task;
}

function parseReservationRoute(method: string, path: string): { kind: RouteKind; ref?: string } | undefined {
  const upper = method.toUpperCase();
  if (upper === "POST" && path === "/api/reservation-workflows/single/drafts") return { kind: "single-create" };
  if (upper === "POST" && path === "/api/reservation-workflows/group/drafts") return { kind: "group-create" };
  const match = /^\/api\/reservation-workflows\/(single|group)\/drafts\/([^/]+)(?:\/(quote|prepare-confirm))?$/.exec(path);
  if (!match) return undefined;
  const scope = match[1] === "group" ? "group" : "single";
  const ref = decodeURIComponent(match[2] ?? "");
  const action = match[3];
  if (upper === "PATCH" && !action) return { kind: scope === "group" ? "group-update" : "single-update", ref };
  if (upper === "POST" && action === "quote") return { kind: scope === "group" ? "group-quote" : "single-quote", ref };
  if (upper === "POST" && action === "prepare-confirm") return { kind: scope === "group" ? "group-prepare" : "single-prepare", ref };
  return undefined;
}

function valid<T>(result: { ok: true; value: T } | { ok: false; issues: string[] }): T {
  if (!result.ok) throw new RouteValidationError(result.issues.join("; "));
  return result.value;
}

function requiredRef(value: string | undefined): string {
  if (!value) throw new RouteValidationError("workflow ref is required.");
  return value;
}

function asBody(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}

type RouteKind =
  | "single-create"
  | "single-update"
  | "single-quote"
  | "single-prepare"
  | "group-create"
  | "group-update"
  | "group-quote"
  | "group-prepare";

class RouteValidationError extends Error {}
