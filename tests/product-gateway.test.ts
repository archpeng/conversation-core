import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import { createHttpAgentClient, type AgentClient } from "../apps/product-gateway/src/clients/agent-client.js";
import { createProductGatewayService } from "../apps/product-gateway/src/index.js";
import type { ProductGatewayConfig, ProductGatewayPmsClient } from "../apps/product-gateway/src/types.js";

const config: ProductGatewayConfig = {
  host: "127.0.0.1",
  port: 0,
  maxInboundBodyBytes: 1024 * 1024,
  productGatewayAuthToken: "product-token",
  pmsAgentBaseUrl: "https://agent.local",
  pmsAgentAuthToken: "agent-secret",
  pmsPlatformBaseUrl: "https://pms.local",
  pmsPlatformAuthToken: "pms-secret",
  defaultTenantId: "tenant_1",
  defaultPropertyId: "property_small_hotel"
};

describe("product gateway service", () => {
  it("requires product gateway auth without leaking backend tokens", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient()
    });

    const response = await service.handle(request("GET", "/api/tasks", undefined, {}));

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain("agent-secret");
    expect(JSON.stringify(response.body)).not.toContain("pms-secret");
  });

  it("wraps a mobile turn into an agent task", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient()
    });

    const response = await service.handle(request("POST", "/api/mobile/turn", {
      channel: "mobile",
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      sessionId: "mobile_session_1",
      messageId: "message_1",
      actor: { role: "staff", id: "staff_1" },
      message: { text: "今天到店情况" },
      receivedAt: "2026-05-11T08:00:00.000Z"
    }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      task: {
        title: "Agent response",
        summary: "今天暂无到店。",
        status: "read_only",
        evidenceRefs: ["pms_ev_1"],
        objectRefs: [expect.objectContaining({ kind: "reservation", id: "R-1" })],
        messages: ["今天暂无到店。"]
      }
    });
  });

  it("builds a real-backend-only read feed from PMS evidence", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient()
    });

    const response = await service.handle(request("GET", "/api/tasks"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      tasks: expect.arrayContaining([
        expect.objectContaining({ title: "酒店概况", status: "read_only", evidenceRefs: ["pms_ev_tenant_1_hotelProfile_1778457600000"] }),
        expect.objectContaining({ title: "房型目录", status: "read_only", evidenceRefs: ["pms_ev_tenant_1_roomTypeCatalog_1778457600000"] }),
        expect.objectContaining({ title: "今日到店", status: "read_only", evidenceRefs: ["pms_ev_tenant_1_todayArrivals_1778457600000"] }),
        expect.objectContaining({ title: "今日离店", status: "read_only" }),
        expect.objectContaining({ title: "今日库存", status: "read_only" })
      ])
    });
  });

  it("returns backend_unavailable instead of mock data when PMS is down", async () => {
    const fullClient = fakePmsClient();
    const pmsClient: ProductGatewayPmsClient = {
      ...fullClient,
      todayArrivals: async () => {
        throw new Error("down");
      }
    };
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient
    });

    const response = await service.handle(request("GET", "/api/tasks"));

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ ok: false, code: "backend_unavailable", message: "PMS Platform read model is unavailable." });
  });

  it("returns reservation and availability read objects from PMS evidence", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeAgentClient(),
      pmsClient: fakePmsClient()
    });

    const reservation = await service.handle(request("GET", "/api/objects/reservations/RES-001?tenantId=tenant_1"));
    const availability = await service.handle(request("GET", "/api/availability/search?tenantId=tenant_1&propertyId=property_small_hotel&checkInDate=2026-05-11&checkOutDate=2026-05-12"));

    expect(reservation.status).toBe(200);
    expect(reservation.body).toMatchObject({
      ok: true,
      object: {
        ref: { kind: "reservation", id: "RES-001" },
        status: "confirmed",
        roomId: "room_1",
        evidenceRefs: ["pms_ev_tenant_1_getReservation_1778457600000"]
      }
    });
    expect(availability.status).toBe(200);
    expect(availability.body).toMatchObject({
      ok: true,
      object: {
        ref: { kind: "availability", id: "property_small_hotel:2026-05-11:2026-05-12" },
        rooms: [expect.objectContaining({ roomId: "room_1", roomType: "花园套房", available: true })],
        availableRoomTypes: [{ roomType: "花园套房", count: 1 }],
        evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1778457600000"]
      }
    });
  });

  it("calls the mobile-native agent route without Feishu-shaped gateway adaptation", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const client = createHttpAgentClient({
      baseUrl: "https://agent.local/",
      authToken: "agent-secret",
      fetch: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return { ok: true, json: async () => ({ type: "text", text: "ok" }) } as Response;
      }
    });

    await client.runMobileTurn({
      channel: "mobile",
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      sessionId: "mobile_session_1",
      messageId: "message_1",
      actor: { role: "manager", id: "manager_1" },
      message: { text: "今天到店情况" },
      receivedAt: "2026-05-11T08:00:00.000Z"
    });

    expect(calls).toEqual([{
      url: "https://agent.local/v1/mobile-turn",
      body: expect.objectContaining({ channel: "mobile", sessionId: "mobile_session_1", actor: { role: "manager", id: "manager_1" } })
    }]);
  });

  it("executes typed action cards through PMS pending action callbacks", async () => {
    const service = createProductGatewayService(config, {
      agentClient: fakeApprovalAgentClient(),
      pmsClient: fakePmsClient()
    });

    const created = await service.handle(request("POST", "/api/mobile/turn", {
      channel: "mobile",
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      sessionId: "mobile_session_1",
      messageId: "message_1",
      actor: { role: "staff", id: "staff_1" },
      message: { text: "帮客人确认预订" },
      receivedAt: "2026-05-11T08:00:00.000Z"
    }));
    const createdBody = created.body as { task: { id: string; actionCards: { id: string }[] } };
    const cardId = createdBody.task.actionCards[0].id;
    const session = await issuedSession(service);
    const executed = await service.handle(request("POST", `/api/tasks/${createdBody.task.id}/action-cards/${cardId}/actions/confirm`, {
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      propertyId: session.propertyId,
      actor: session.actor
    }));

    expect(executed.status).toBe(200);
    expect(executed.body).toMatchObject({
      ok: true,
      task: {
        status: "committed",
        evidenceRefs: expect.arrayContaining(["pms_ev_tenant_1_confirmPendingAction_1778457600000"]),
        auditRefs: ["audit_pending_confirm_1"],
        actionCards: [expect.objectContaining({ mutationStatus: "committed", auditRefs: ["audit_pending_confirm_1"] })]
      }
    });
  });

  it("summarizes safety audit JSONL and PMS audit refs in review", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pms-product-gateway-review-"));
    const safetyAuditLogPath = path.join(root, "safety-audit.jsonl");
    await writeFile(safetyAuditLogPath, [
      JSON.stringify({ id: "audit_1", at: "2026-05-11T08:00:00.000Z", outcome: "allow", capabilityId: "pms_availability_search", riskLevel: "low" }),
      JSON.stringify({ id: "audit_2", at: "2026-05-11T08:01:00.000Z", outcome: "deny", capabilityId: "sandbox_bash", riskLevel: "high" })
    ].join("\n"), "utf8");
    const service = createProductGatewayService({ ...config, safetyAuditLogPath }, {
      agentClient: fakeApprovalAgentClient(),
      pmsClient: fakePmsClient()
    });
    const created = await service.handle(request("POST", "/api/mobile/turn", {
      channel: "mobile",
      tenantId: "tenant_1",
      sessionId: "mobile_session_1",
      messageId: "message_1",
      actor: { role: "staff", id: "staff_1" },
      message: { text: "确认" },
      receivedAt: "2026-05-11T08:00:00.000Z"
    }));
    const createdBody = created.body as { task: { id: string; actionCards: { id: string }[] } };
    const session = await issuedSession(service);
    await service.handle(request("POST", `/api/tasks/${createdBody.task.id}/action-cards/${createdBody.task.actionCards[0].id}/actions/confirm`, {
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      propertyId: session.propertyId,
      actor: session.actor
    }));

    const review = await service.handle(request("GET", "/api/review/shift-summary"));

    expect(review.status).toBe(200);
    expect(review.body).toMatchObject({
      ok: true,
      summary: {
        committed: 1,
        pmsAuditRefs: { total: 1, latest: "audit_pending_confirm_1" },
        safetyAudits: { total: 2, allow: 1, deny: 1, requireApproval: 0, latestAt: "2026-05-11T08:01:00.000Z" }
      }
    });
  });
});

function request(method: string, path: string, body?: unknown, headers: Record<string, string | undefined> = { authorization: "Bearer product-token" }) {
  const url = new URL(path, "https://product.local");
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers,
    body
  };
}

async function issuedSession(service: ReturnType<typeof createProductGatewayService>) {
  const response = await service.handle(request("GET", "/api/session/current"));
  return (response.body as { session: { sessionId: string; tenantId: string; propertyId: string; actor: { role: "staff"; id: string; displayName?: string } } }).session;
}

function fakeAgentClient(): AgentClient {
  return {
    async runMobileTurn() {
      return { type: "text", text: "今天暂无到店。\n依据：PMS 到店列表 evidenceRef `pms_ev_1`", evidenceRefs: ["pms_ev_1"], objectRefs: [{ kind: "reservation", id: "R-1", label: "张三 · D1", evidenceRefs: ["pms_ev_1"] }] };
    }
  };
}

function fakeApprovalAgentClient(): AgentClient {
  return {
    async runMobileTurn() {
      return {
        type: "approval_card",
        card: {
          type: "pms_pending_action_card",
          ref: {
            type: "pms_pending_action",
            tenantId: "tenant_1",
            pendingActionId: "pending_1",
            pendingActionRef: "pending_1",
            cardPayloadRef: "card_1",
            action: "reservation_confirm"
          },
          title: "确认预订",
          summary: "请通过 typed card 确认 PMS mutation。",
          confirmLabel: "确认",
          cancelLabel: "取消"
        }
      };
    }
  };
}

function fakePmsClient(): ProductGatewayPmsClient {
  return {
    hotelProfile: async () => createPmsEvidence({
      method: "hotelProfile",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: {
        propertyId: "property_small_hotel",
        propertyName: "样板酒店",
        timeZone: "Asia/Shanghai",
        status: "active",
        roomTotal: 10,
        roomTypes: [{ roomTypeId: "room-type-suite", code: "suite", displayName: "花园套房", roomCount: 4, status: "active" }]
      },
      summary: "Hotel profile."
    }),
    roomTypeCatalog: async () => createPmsEvidence({
      method: "roomTypeCatalog",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: {
        propertyId: "property_small_hotel",
        roomTypes: [{ roomTypeId: "room-type-suite", code: "suite", displayName: "花园套房", roomCount: 4, status: "active" }]
      },
      summary: "Room type catalog."
    }),
    searchAvailability: async () => createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: {
        rooms: [{ roomId: "room_1", roomNumber: "1001", roomType: "花园套房", available: true }],
        availableRoomTypes: [{ roomType: "花园套房", count: 1 }]
      },
      summary: "Availability facts."
    }),
    todayArrivals: async () => createPmsEvidence({
      method: "todayArrivals",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { arrivals: [{ reservationCode: "RES-001", roomId: "room_1", guestName: "Alice", status: "pending" }] },
      summary: "Arrival facts."
    }),
    todayDepartures: async () => createPmsEvidence({
      method: "todayDepartures",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { departures: [] },
      summary: "Departure facts."
    }),
    inventorySummary: async () => createPmsEvidence({
      method: "inventorySummary",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: {
        dates: [{ date: "2026-05-11", total: 10, available: 6, reserved: 3, blocked: 1, occupied: 0 }],
        roomTypes: [{ roomType: "花园套房", total: 4 }]
      },
      summary: "Inventory facts."
    }),
    getRoom: async () => createPmsEvidence({
      method: "getRoom",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { roomId: "room_1", roomType: "花园套房", status: "available" },
      summary: "Room facts."
    }),
    getReservation: async () => createPmsEvidence({
      method: "getReservation",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { reservationId: "RES-001", status: "confirmed", roomId: "room_1" },
      summary: "Reservation facts."
    }),
    roomReservationContext: async () => createPmsEvidence({
      method: "roomReservationContext",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { roomId: "room_1", currentStatus: "available", reservationRefs: [], blockRefs: [] },
      summary: "Room context."
    }),
    createReservationDraft: async () => createPmsEvidence({
      method: "createReservationDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { draftRef: "draft_single_1", status: "collectingSlots" },
      summary: "Reservation draft."
    }),
    updateReservationDraft: async () => createPmsEvidence({
      method: "updateReservationDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { draftRef: "draft_single_1", status: "collectingSlots" },
      summary: "Reservation draft update."
    }),
    quoteReservationDraft: async () => createPmsEvidence({
      method: "quoteReservationDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { quoteRef: "quote_single_1", status: "pricingUnsupported" },
      summary: "Reservation quote."
    }),
    prepareReservationConfirm: async () => createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { pendingActionId: "pending_single_1", pendingActionRef: "pending_single_1", cardPayloadRef: "card_single_1", confirmationMode: "typedCardOnly", mutationStatus: "none" },
      summary: "Reservation prepare."
    }),
    createReservationGroupDraft: async () => createPmsEvidence({
      method: "createReservationGroupDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { groupDraftRef: "group_draft_1", status: "collectingSlots" },
      summary: "Group draft."
    }),
    updateReservationGroupDraft: async () => createPmsEvidence({
      method: "updateReservationGroupDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { groupDraftRef: "group_draft_1", status: "quoteReady" },
      summary: "Group draft update."
    }),
    quoteReservationGroupDraft: async () => createPmsEvidence({
      method: "quoteReservationGroupDraft",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { quoteRef: "quote_group_1", status: "pricingUnsupported" },
      summary: "Group quote."
    }),
    prepareReservationGroupConfirm: async () => createPmsEvidence({
      method: "prepareReservationGroupConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: 2 },
      summary: "Group prepare."
    }),
    pendingActionStatus: async () => createPmsEvidence({
      method: "pendingActionStatus",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { pendingActionId: "pending_1", status: "awaitingConfirmation" },
      summary: "Pending status."
    }),
    confirmPendingAction: async () => createPmsEvidence({
      method: "confirmPendingAction",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { pendingActionId: "pending_1", status: "confirmed", mutationStatus: "committed", idempotencyStatus: "confirmed", auditRefs: ["audit_pending_confirm_1"] },
      summary: "Pending action confirmed."
    }),
    cancelPendingAction: async () => createPmsEvidence({
      method: "cancelPendingAction",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { pendingActionId: "pending_1", status: "cancelled", mutationStatus: "none", idempotencyStatus: "cancelled", auditRefs: ["audit_pending_cancel_1"] },
      summary: "Pending action cancelled."
    }),
    executeTypedOperation: async (input) => createPmsEvidence({
      method: "executeTypedOperation",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-11T00:00:00.000Z",
      data: { operation: input.operation, targetRef: input.targetRef, status: "confirmed", mutationStatus: "committed", idempotencyStatus: "confirmed", auditRefs: [`audit_${input.operation}_1`] },
      summary: "Typed operation."
    })
  };
}
