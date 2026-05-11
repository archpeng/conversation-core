import { productError, validateActionCardExecutionInput } from "@pms-agent-v2/product-contracts";
import type { AgentTask, ActionCard } from "@pms-agent-v2/product-contracts";
import type { PendingActionCallbackFact, PmsEvidence } from "@pms-agent-v2/pms-platform-client";
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
  if (!card.operationRef || card.operationRef.type !== "pmsPendingAction") return json(400, productError("invalid_request", "Action card is missing a typed PMS operation ref."));
  if (actionId !== "confirm" && actionId !== "cancel") return json(400, productError("unsupported", "Unsupported action card operation."));

  try {
    const evidence = actionId === "confirm"
      ? await pmsClient.confirmPendingAction({
        tenantId: card.operationRef.tenantId,
        propertyId: context.config.defaultPropertyId,
        pendingActionId: card.operationRef.pendingActionId,
        pendingActionRef: card.operationRef.pendingActionRef ?? card.operationRef.pendingActionId,
        cardPayloadRef: card.operationRef.cardPayloadRef,
        actor: { type: "human", id: input.value.actor.id, ...(input.value.actor.displayName ? { displayName: input.value.actor.displayName } : {}) }
      })
      : await pmsClient.cancelPendingAction({
        tenantId: card.operationRef.tenantId,
        propertyId: context.config.defaultPropertyId,
        pendingActionId: card.operationRef.pendingActionId,
        pendingActionRef: card.operationRef.pendingActionRef ?? card.operationRef.pendingActionId,
        cardPayloadRef: card.operationRef.cardPayloadRef,
        actor: { type: "human", id: input.value.actor.id, ...(input.value.actor.displayName ? { displayName: input.value.actor.displayName } : {}) },
        reason: input.value.reason ?? "cancelled from typed mobile card"
      });
    const updated = taskAfterAction(task, card, actionId, evidence);
    context.tasks.add(updated);
    return json(200, { ok: true, task: updated });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform pending action callback failed."));
  }
}

function taskAfterAction(task: AgentTask, card: ActionCard, actionId: "confirm" | "cancel", evidence: PmsEvidence<PendingActionCallbackFact>): AgentTask {
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
    messages: mergeStrings(task.messages, [`Typed card ${actionId} returned ${evidence.data.status}.`])
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

function mergeStrings(left: readonly string[] | undefined, right: readonly string[] | undefined): string[] {
  return Array.from(new Set([...(left ?? []), ...(right ?? [])].filter((item) => item.trim().length > 0)));
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
