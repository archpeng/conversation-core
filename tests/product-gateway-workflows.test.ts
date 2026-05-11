import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import { createProductGatewayService } from "../apps/product-gateway/src/index.js";
import { createTaskLedger } from "../apps/product-gateway/src/task-ledger.js";
import type { AgentClient } from "../apps/product-gateway/src/clients/agent-client.js";
import type { ProductGatewayConfig, ProductGatewayPmsClient, ProductGatewayRequest } from "../apps/product-gateway/src/types.js";
import type { AgentTask } from "../packages/product-contracts/src/index.js";

const config: ProductGatewayConfig = {
  host: "127.0.0.1",
  port: 0,
  maxInboundBodyBytes: 1024 * 1024,
  productGatewayAuthToken: "product-token",
  pmsAgentBaseUrl: "https://agent.local",
  pmsPlatformBaseUrl: "https://pms.local",
  defaultTenantId: "tenant_1",
  defaultPropertyId: "property_small_hotel"
};

describe("product gateway reservation workflows and typed operations", () => {
  it("prepares single and group reservation workflows only to pending action cards", async () => {
    const service = createProductGatewayService(config, { agentClient: fakeAgentClient(), pmsClient: fakePmsClient() });

    const singleDraft = await service.handle(request("POST", "/api/reservation-workflows/single/drafts", {
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      roomId: "room_1",
      guestName: "李女士",
      checkInDate: "2026-05-11",
      checkOutDate: "2026-05-12"
    }));
    const singleQuote = await service.handle(request("POST", "/api/reservation-workflows/single/drafts/draft_single_1/quote", { tenantId: "tenant_1" }));
    const singlePrepared = await service.handle(request("POST", "/api/reservation-workflows/single/drafts/draft_single_1/prepare-confirm", { tenantId: "tenant_1", quoteRef: "quote_single_1" }));

    expect(singleDraft.body).toMatchObject({ ok: true, task: { status: "draft_ready", evidenceRefs: ["pms_ev_tenant_1_createReservationDraft_1778457600000"] } });
    expect(singleQuote.body).toMatchObject({ ok: true, task: { status: "draft_ready", evidenceRefs: ["pms_ev_tenant_1_quoteReservationDraft_1778457600000"] } });
    expect(singlePrepared.body).toMatchObject({
      ok: true,
      task: {
        status: "awaiting_confirmation",
        actionCards: [expect.objectContaining({
          confirmationMode: "typedCardOnly",
          mutationStatus: "awaitingConfirmation",
          operationRef: expect.objectContaining({ type: "pmsPendingAction", pendingActionId: "pending_single_1" })
        })]
      }
    });

    const groupDraft = await service.handle(request("POST", "/api/reservation-workflows/group/drafts", {
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      guestName: "李女士",
      checkInDate: "2026-05-11",
      checkOutDate: "2026-05-12",
      quantity: 2
    }));
    const groupPrepared = await service.handle(request("POST", "/api/reservation-workflows/group/drafts/group_draft_1/prepare-confirm", { tenantId: "tenant_1", quoteRef: "quote_group_1" }));

    expect(groupDraft.body).toMatchObject({ ok: true, task: { status: "draft_ready" } });
    expect(groupPrepared.body).toMatchObject({ ok: true, task: { status: "awaiting_confirmation", actionCards: [expect.objectContaining({ operationRef: expect.objectContaining({ pendingActionId: "pending_group_1" }) })] } });
    expect(fakePmsClient().confirmPendingAction).toBeTypeOf("function");
  });

  it("executes typed PMS operations only from scoped action cards", async () => {
    const task = typedOperationTask("check_in", "RES-001");
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient(),
      tasks: createTaskLedger([task])
    });

    const textTurn = await service.handle(request("POST", "/api/mobile/turn", {
      channel: "mobile",
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      sessionId: "session_1",
      messageId: "message_1",
      actor: { role: "staff", id: "staff_1" },
      message: { text: "确认入住" },
      receivedAt: "2026-05-11T08:00:00.000Z"
    }));
    const executed = await service.handle(request("POST", "/api/tasks/task_checkin/action-cards/card_checkin/actions/confirm", actionInput("staff")));

    expect(textTurn.body).toMatchObject({ ok: true, task: { status: "read_only" } });
    expect(executed.body).toMatchObject({
      ok: true,
      task: {
        status: "committed",
        evidenceRefs: expect.arrayContaining(["pms_ev_tenant_1_executeTypedOperation_1778457600000"]),
        auditRefs: ["audit_check_in_1"],
        actionCards: [expect.objectContaining({ mutationStatus: "committed", auditRefs: ["audit_check_in_1"] })]
      }
    });
  });

  it("rejects wrong scope or role before PMS mutation execution", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient(),
      tasks: createTaskLedger([typedOperationTask("maintenance_restore_sellable", "room_1")])
    });

    const wrongTenant = await service.handle(request("POST", "/api/tasks/task_checkin/action-cards/card_checkin/actions/confirm", { ...actionInput("staff"), tenantId: "tenant_2" }));
    const wrongRole = await service.handle(request("POST", "/api/tasks/task_checkin/action-cards/card_checkin/actions/confirm", actionInput("customer")));

    expect(wrongTenant).toMatchObject({ status: 403, body: { ok: false, code: "forbidden" } });
    expect(wrongRole).toMatchObject({ status: 403, body: { ok: false, code: "forbidden" } });
  });

  it("returns gateway-issued session and review action detail with evidence and audits", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pms-product-gateway-review-detail-"));
    const safetyAuditLogPath = path.join(root, "safety-audit.jsonl");
    await writeFile(safetyAuditLogPath, JSON.stringify({ id: "safety_1", at: "2026-05-11T08:00:00.000Z", outcome: "allow", capabilityId: "pms_check_in", riskLevel: "high" }), "utf8");
    const service = createProductGatewayService({ ...config, safetyAuditLogPath }, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient(),
      tasks: createTaskLedger([typedOperationTask("check_in", "RES-001")])
    });

    const session = await service.handle(request("GET", "/api/session/current"));
    await service.handle(request("POST", "/api/tasks/task_checkin/action-cards/card_checkin/actions/confirm", actionInput("staff")));
    const actions = await service.handle(request("GET", "/api/review/actions?status=committed"));
    const detail = await service.handle(request("GET", "/api/review/actions/task_checkin"));

    expect(JSON.stringify(session.body)).not.toContain("pms-secret");
    expect(session.body).toMatchObject({ ok: true, session: { tenantId: "tenant_1", propertyId: "property_small_hotel", actor: { role: "staff" } } });
    expect(actions.body).toMatchObject({ ok: true, actions: [expect.objectContaining({ taskId: "task_checkin", evidenceRefs: expect.arrayContaining(["pms_ev_tenant_1_executeTypedOperation_1778457600000"]) })] });
    expect(detail.body).toMatchObject({
      ok: true,
      action: {
        taskId: "task_checkin",
        actor: { role: "staff", id: "staff_1" },
        pmsAuditRefs: ["audit_check_in_1"],
        safetyAuditRefs: ["safety_1"]
      }
    });
  });
});

function request(method: string, target: string, body?: unknown): ProductGatewayRequest {
  const url = new URL(target, "https://product.local");
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers: { authorization: "Bearer product-token" },
    body
  };
}

function actionInput(role: "staff" | "customer" | "manager" | "admin") {
  return {
    sessionId: "session_1",
    tenantId: "tenant_1",
    propertyId: "property_small_hotel",
    actor: { role, id: role === "customer" ? "customer_1" : "staff_1" }
  };
}

function typedOperationTask(operation: "check_in" | "maintenance_restore_sellable", targetRef: string): AgentTask {
  return {
    id: "task_checkin",
    title: "办理入住",
    summary: "Typed operation card.",
    status: "awaiting_confirmation",
    source: "gateway",
    createdAt: "2026-05-11T08:00:00.000Z",
    updatedAt: "2026-05-11T08:00:00.000Z",
    actionCards: [{
      id: "card_checkin",
      title: "办理入住",
      summary: "Only this typed card can execute PMS mutation.",
      mutationStatus: "awaitingConfirmation",
      confirmationMode: "typedCardOnly",
      operationRef: { type: "pmsOperation", tenantId: "tenant_1", propertyId: "property_small_hotel", operation, targetRef, cardPayloadRef: "card_checkin" },
      actions: [{ id: "confirm", label: "确认", kind: "primary", confirmationRequired: true }]
    }]
  };
}

function fakeAgentClient(): AgentClient {
  return {
    async runMobileTurn() {
      return { type: "text", text: "确认需要 typed card。", evidenceRefs: ["pms_ev_read_1"] };
    }
  };
}

function fakePmsClient(): ProductGatewayPmsClient {
  return {
    hotelProfile: async () => createPmsEvidence({ method: "hotelProfile", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { propertyId: "property_small_hotel", propertyName: "样板酒店", timeZone: "Asia/Shanghai", status: "active", roomTotal: 10, roomTypes: [] }, summary: "profile" }),
    roomTypeCatalog: async () => createPmsEvidence({ method: "roomTypeCatalog", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { propertyId: "property_small_hotel", roomTypes: [] }, summary: "catalog" }),
    searchAvailability: async () => createPmsEvidence({ method: "searchAvailability", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { rooms: [], availableRoomTypes: [] }, summary: "availability" }),
    getRoom: async () => createPmsEvidence({ method: "getRoom", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { roomId: "room_1", roomType: "suite", status: "available" }, summary: "room" }),
    getReservation: async () => createPmsEvidence({ method: "getReservation", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { reservationId: "RES-001", status: "confirmed" }, summary: "reservation" }),
    inventorySummary: async () => createPmsEvidence({ method: "inventorySummary", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { dates: [], roomTypes: [] }, summary: "inventory" }),
    roomReservationContext: async () => createPmsEvidence({ method: "roomReservationContext", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { roomId: "room_1", currentStatus: "available", reservationRefs: [], blockRefs: [] }, summary: "context" }),
    todayArrivals: async () => createPmsEvidence({ method: "todayArrivals", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { arrivals: [] }, summary: "arrivals" }),
    todayDepartures: async () => createPmsEvidence({ method: "todayDepartures", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { departures: [] }, summary: "departures" }),
    createReservationDraft: async () => createPmsEvidence({ method: "createReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { draftRef: "draft_single_1", status: "collectingSlots" }, summary: "single draft" }),
    updateReservationDraft: async () => createPmsEvidence({ method: "updateReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { draftRef: "draft_single_1", status: "collectingSlots" }, summary: "single update" }),
    quoteReservationDraft: async () => createPmsEvidence({ method: "quoteReservationDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { quoteRef: "quote_single_1", status: "pricingUnsupported" }, summary: "single quote" }),
    prepareReservationConfirm: async () => createPmsEvidence({ method: "prepareReservationConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { pendingActionId: "pending_single_1", pendingActionRef: "pending_single_1", cardPayloadRef: "card_single_1", quoteRef: "quote_single_1", confirmationMode: "typedCardOnly", mutationStatus: "none" }, summary: "single prepare" }),
    createReservationGroupDraft: async () => createPmsEvidence({ method: "createReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { groupDraftRef: "group_draft_1", status: "collectingSlots" }, summary: "group draft" }),
    updateReservationGroupDraft: async () => createPmsEvidence({ method: "updateReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { groupDraftRef: "group_draft_1", status: "quoteReady" }, summary: "group update" }),
    quoteReservationGroupDraft: async () => createPmsEvidence({ method: "quoteReservationGroupDraft", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { quoteRef: "quote_group_1", status: "pricingUnsupported" }, summary: "group quote" }),
    prepareReservationGroupConfirm: async () => createPmsEvidence({ method: "prepareReservationGroupConfirm", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "quote_group_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: 2 }, summary: "group prepare" }),
    pendingActionStatus: async () => createPmsEvidence({ method: "pendingActionStatus", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { pendingActionId: "pending_1", status: "awaitingConfirmation" }, summary: "pending" }),
    confirmPendingAction: async () => createPmsEvidence({ method: "confirmPendingAction", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { pendingActionId: "pending_1", status: "confirmed", mutationStatus: "committed", idempotencyStatus: "confirmed", auditRefs: ["audit_pending_confirm_1"] }, summary: "confirm" }),
    cancelPendingAction: async () => createPmsEvidence({ method: "cancelPendingAction", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { pendingActionId: "pending_1", status: "cancelled", mutationStatus: "none", idempotencyStatus: "cancelled", auditRefs: ["audit_pending_cancel_1"] }, summary: "cancel" }),
    executeTypedOperation: async (input) => createPmsEvidence({ method: "executeTypedOperation", tenantId: "tenant_1", fetchedAt: "2026-05-11T00:00:00.000Z", data: { operation: input.operation, targetRef: input.targetRef, status: "confirmed", mutationStatus: "committed", idempotencyStatus: "confirmed", auditRefs: [`audit_${input.operation}_1`] }, summary: "typed operation" })
  };
}
