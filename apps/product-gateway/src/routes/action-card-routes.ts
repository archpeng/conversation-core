import { productError, validateActionCardExecutionInput } from "@pms-agent-v2/product-contracts";
import type { ActionCardExecutionInput, AgentTask, ActionCard } from "@pms-agent-v2/product-contracts";
import type { PendingActionCallbackFact, PmsEvidence, TypedOperationFact } from "@pms-agent-v2/pms-platform-client";
import type { ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleActionCardExecutionRoute(
  context: ProductRouteContext,
  pmsClient: ProductGatewayPmsClient,
  request: ProductGatewayRequest,
  taskId: string,
  cardId: string,
  actionId: string
): Promise<ProductGatewayResponse> {
  const input = validateActionCardExecutionInput(request.body);
  if (!input.ok) return json(400, productError("invalid_request", `Invalid action input: ${input.issues.join("; ")}`));

  const task = context.tasks.get(taskId);
  if (!task) return json(404, productError("unsupported", "Task was not found in the product gateway ledger."));
  const card = task.actionCards?.find((item) => item.id === cardId);
  if (!card) return json(404, productError("unsupported", "Action card was not found in the product gateway ledger."));
  const action = card.actions.find((item) => item.id === actionId);
  if (!action) return json(404, productError("unsupported", "Action was not found on the card."));
  if (action.disabled) return json(400, productError("invalid_request", "Action is disabled."));
  if (!card.operationRef) return json(400, productError("invalid_request", "Action card is missing a typed PMS operation ref."));
  const authorization = authorizeExecution(context, card, input.value);
  if (!authorization.ok) return json(authorization.status, productError(authorization.code, authorization.message));

  try {
    const updated = card.operationRef.type === "pmsPendingAction"
      ? taskAfterPendingAction(task, card, actionId, input.value, await executePendingAction(context, pmsClient, card, actionId, input.value))
      : taskAfterTypedOperation(task, card, actionId, input.value, await executeTypedOperation(pmsClient, card, actionId, input.value));
    context.tasks.add(updated);
    return json(200, { ok: true, task: updated });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform pending action callback failed."));
  }
}

function authorizeExecution(context: ProductRouteContext, card: ActionCard, input: ActionCardExecutionInput): { ok: true } | { ok: false; status: 401 | 403; code: "unauthorized" | "forbidden"; message: string } {
  if (!input.sessionId.trim()) return { ok: false, status: 401, code: "unauthorized", message: "Mobile session is required for typed action execution." };
  const operationRef = card.operationRef;
  if (!operationRef) return { ok: false, status: 403, code: "forbidden", message: "Action card is missing a typed PMS operation ref." };
  const expectedTenant = operationRef.tenantId;
  if (!expectedTenant || input.tenantId !== expectedTenant) return { ok: false, status: 403, code: "forbidden", message: "Action tenant scope does not match the mobile session." };
  const expectedProperty = operationRef.type === "pmsOperation" ? operationRef.propertyId : context.config.defaultPropertyId;
  if (expectedProperty && input.propertyId !== expectedProperty) return { ok: false, status: 403, code: "forbidden", message: "Action property scope does not match the mobile session." };
  if (input.actor.role === "admin" || input.actor.role === "manager") return { ok: true };
  if (input.actor.role !== "staff") return { ok: false, status: 403, code: "forbidden", message: "Actor role cannot execute PMS mutations from mobile." };
  if (operationRef.type === "pmsPendingAction") return { ok: true };
  if (operationRef.operation === "maintenance_report" || operationRef.operation === "maintenance_restore_sellable") {
    return { ok: false, status: 403, code: "forbidden", message: "Maintenance sale-state operations require manager or admin role." };
  }
  return { ok: true };
}

async function executePendingAction(
  context: ProductRouteContext,
  pmsClient: ProductGatewayPmsClient,
  card: ActionCard,
  actionId: string,
  input: ActionCardExecutionInput
): Promise<PmsEvidence<PendingActionCallbackFact>> {
  if (!card.operationRef || card.operationRef.type !== "pmsPendingAction") throw new Error("missing pending action operation ref");
  if (actionId !== "confirm" && actionId !== "cancel") throw new Error("unsupported pending action");
  const actor = { type: "human" as const, id: input.actor.id, ...(input.actor.displayName ? { displayName: input.actor.displayName } : {}) };
  return actionId === "confirm"
    ? pmsClient.confirmPendingAction({
      tenantId: card.operationRef.tenantId,
      propertyId: context.config.defaultPropertyId,
      pendingActionId: card.operationRef.pendingActionId,
      pendingActionRef: card.operationRef.pendingActionRef ?? card.operationRef.pendingActionId,
      cardPayloadRef: card.operationRef.cardPayloadRef,
      actor
    })
    : pmsClient.cancelPendingAction({
      tenantId: card.operationRef.tenantId,
      propertyId: context.config.defaultPropertyId,
      pendingActionId: card.operationRef.pendingActionId,
      pendingActionRef: card.operationRef.pendingActionRef ?? card.operationRef.pendingActionId,
      cardPayloadRef: card.operationRef.cardPayloadRef,
      actor,
      reason: input.reason ?? "cancelled from typed mobile card"
    });
}

async function executeTypedOperation(
  pmsClient: ProductGatewayPmsClient,
  card: ActionCard,
  actionId: string,
  input: ActionCardExecutionInput
): Promise<PmsEvidence<TypedOperationFact>> {
  if (!card.operationRef || card.operationRef.type !== "pmsOperation") throw new Error("missing typed operation ref");
  if (actionId !== "confirm") throw new Error("unsupported typed operation action");
  return pmsClient.executeTypedOperation({
    tenantId: card.operationRef.tenantId,
    ...(card.operationRef.propertyId ? { propertyId: card.operationRef.propertyId } : {}),
    operation: card.operationRef.operation,
    targetRef: card.operationRef.targetRef,
    cardPayloadRef: card.operationRef.cardPayloadRef,
    actor: { type: "human", id: input.actor.id, ...(input.actor.displayName ? { displayName: input.actor.displayName } : {}) }
  });
}

function taskAfterPendingAction(task: AgentTask, card: ActionCard, actionId: string, input: ActionCardExecutionInput, evidence: PmsEvidence<PendingActionCallbackFact>): AgentTask {
  const timestamp = new Date().toISOString();
  const auditRefs = mergeStrings(task.auditRefs, evidence.data.auditRefs);
  const nextStatus = actionId === "confirm" ? taskStatusAfterConfirm(evidence.data.status) : "rejected";
  const nextCard: ActionCard = {
    ...card,
    mutationStatus: actionId === "confirm" ? cardStatusAfterConfirm(evidence.data.status) : "rejected",
    evidenceRefs: mergeStrings(card.evidenceRefs, [evidence.evidenceRef]),
    auditRefs: mergeStrings(card.auditRefs, evidence.data.auditRefs),
    actions: card.actions.map((item) => ({
      ...item,
      disabled: true
    }))
  };
  return {
    ...task,
    status: nextStatus,
    updatedAt: timestamp,
    evidenceRefs: mergeStrings(task.evidenceRefs, [evidence.evidenceRef]),
    ...(auditRefs.length > 0 ? { auditRefs } : {}),
    actionCards: task.actionCards?.map((item) => item.id === card.id ? nextCard : item),
    messages: mergeStrings(task.messages, [`Typed card ${actionId} returned ${evidence.data.status}.`, actorMessage(input)])
  };
}

function taskAfterTypedOperation(task: AgentTask, card: ActionCard, actionId: string, input: ActionCardExecutionInput, evidence: PmsEvidence<TypedOperationFact>): AgentTask {
  const timestamp = new Date().toISOString();
  const auditRefs = mergeStrings(task.auditRefs, evidence.data.auditRefs);
  const nextCard: ActionCard = {
    ...card,
    mutationStatus: cardStatusAfterOperation(evidence.data.status),
    evidenceRefs: mergeStrings(card.evidenceRefs, [evidence.evidenceRef]),
    auditRefs: mergeStrings(card.auditRefs, evidence.data.auditRefs),
    actions: card.actions.map((item) => ({ ...item, disabled: true }))
  };
  return {
    ...task,
    status: taskStatusAfterOperation(evidence.data.status),
    updatedAt: timestamp,
    evidenceRefs: mergeStrings(task.evidenceRefs, [evidence.evidenceRef]),
    ...(auditRefs.length > 0 ? { auditRefs } : {}),
    actionCards: task.actionCards?.map((item) => item.id === card.id ? nextCard : item),
    messages: mergeStrings(task.messages, [`Typed card ${actionId} returned ${evidence.data.status}.`, actorMessage(input)])
  };
}

function taskStatusAfterConfirm(status: PendingActionCallbackFact["status"]): AgentTask["status"] {
  if (status === "confirmed") return "committed";
  if (status === "expired") return "expired";
  return "failed";
}

function cardStatusAfterConfirm(status: PendingActionCallbackFact["status"]): ActionCard["mutationStatus"] {
  if (status === "confirmed") return "committed";
  if (status === "expired") return "expired";
  return "failed";
}

function taskStatusAfterOperation(status: TypedOperationFact["status"]): AgentTask["status"] {
  if (status === "confirmed") return "committed";
  if (status === "rejected") return "rejected";
  if (status === "expired") return "expired";
  return "failed";
}

function cardStatusAfterOperation(status: TypedOperationFact["status"]): ActionCard["mutationStatus"] {
  if (status === "confirmed") return "committed";
  if (status === "rejected") return "rejected";
  if (status === "expired") return "expired";
  return "failed";
}

function mergeStrings(left: readonly string[] | undefined, right: readonly string[] | undefined): string[] {
  return Array.from(new Set([...(left ?? []), ...(right ?? [])].filter((item) => item.trim().length > 0)));
}

function actorMessage(input: ActionCardExecutionInput): string {
  return `Actor ${input.actor.role}:${input.actor.id} executed typed card.`;
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
