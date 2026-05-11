import { describe, expect, it } from "vitest";
import {
  validateActionCard,
  validateActionCardExecutionInput,
  validateActionCardExecutionResponse,
  validateAgentTask,
  validateAvailabilityObjectResponse,
  validateMobileAgentResponse,
  validateMobileAgentTurnInput,
  validateObjectRef,
  validateProductApiError,
  validateReservationObjectResponse,
  validateRoomObjectResponse,
  validateTaskListResponse
} from "../packages/product-contracts/src/index.js";

const mobileTurn = {
  channel: "mobile",
  tenantId: "tenant_1",
  propertyId: "property_small_hotel",
  sessionId: "session_1",
  messageId: "message_1",
  actor: { role: "staff", id: "staff_1", displayName: "前台" },
  message: { text: "查一下今天到店" },
  device: { platform: "web", locale: "zh-CN" },
  receivedAt: "2026-05-11T08:00:00.000Z"
};

const actionCard = {
  id: "card_1",
  title: "查看今日到店",
  summary: "只读 PMS evidence，没有执行 mutation。",
  mutationStatus: "none",
  confirmationMode: "none",
  evidenceRefs: ["pms_ev_1"],
  auditRefs: ["audit_1"],
  objectRefs: [{ kind: "property", id: "property_small_hotel", label: "样板酒店" }],
  operationRef: {
    type: "pmsPendingAction",
    tenantId: "tenant_1",
    pendingActionId: "pending_1",
    pendingActionRef: "pending_1",
    cardPayloadRef: "card_1",
    action: "reservation_confirm"
  },
  actions: [{ id: "refresh", label: "刷新", kind: "secondary", disabled: false }]
};

const task = {
  id: "task_1",
  title: "今日到店",
  summary: "2 条到店记录。",
  status: "read_only",
  source: "gateway",
  createdAt: "2026-05-11T08:00:00.000Z",
  updatedAt: "2026-05-11T08:00:00.000Z",
  evidenceRefs: ["pms_ev_1"],
  auditRefs: ["audit_1"],
  objectRefs: [{ kind: "property", id: "property_small_hotel" }],
  actionCards: [actionCard],
  messages: ["Alice", "Bob"]
};

describe("product contracts", () => {
  it("validates mobile turn input without Feishu shape", () => {
    expect(validateMobileAgentTurnInput(mobileTurn)).toEqual({ ok: true, value: mobileTurn });
    expect(validateMobileAgentTurnInput({ ...mobileTurn, channel: "feishu" })).toMatchObject({ ok: false });
  });

  it("validates action cards and mutation status", () => {
    expect(validateActionCard(actionCard)).toEqual({ ok: true, value: actionCard });
    const result = validateActionCard({ ...actionCard, mutationStatus: "confirmed_by_text" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain("actionCard.mutationStatus is invalid");
  });

  it("validates task and response wrappers", () => {
    expect(validateAgentTask(task)).toEqual({ ok: true, value: task });
    expect(validateMobileAgentResponse({ ok: true, task })).toEqual({ ok: true, value: { ok: true, task } });
    expect(validateTaskListResponse({ ok: true, tasks: [task] })).toEqual({ ok: true, value: { ok: true, tasks: [task] } });
  });

  it("validates public product API errors", () => {
    expect(validateProductApiError({ ok: false, code: "backend_unavailable", message: "PMS unavailable." })).toEqual({
      ok: true,
      value: { ok: false, code: "backend_unavailable", message: "PMS unavailable." }
    });
  });

  it("validates typed action card execution input and response", () => {
    const input = { actor: { role: "staff", id: "staff_1", displayName: "前台" }, reason: "typed card button" };
    expect(validateActionCardExecutionInput(input)).toEqual({ ok: true, value: input });
    expect(validateActionCardExecutionInput({ actor: { role: "owner", id: "staff_1" } })).toMatchObject({ ok: false });
    expect(validateActionCardExecutionResponse({ ok: true, task })).toEqual({ ok: true, value: { ok: true, task } });
  });

  it("validates read object responses for room, reservation, and availability", () => {
    const room = {
      ok: true,
      object: {
        ref: { kind: "room", id: "room_1", evidenceRefs: ["pms_ev_room"] },
        status: "available",
        roomType: "花园套房",
        reservationRefs: [],
        blockRefs: [],
        evidenceRefs: ["pms_ev_room"]
      }
    };
    const reservation = {
      ok: true,
      object: {
        ref: { kind: "reservation", id: "RES-001", evidenceRefs: ["pms_ev_reservation"] },
        status: "confirmed",
        roomId: "room_1",
        evidenceRefs: ["pms_ev_reservation"]
      }
    };
    const availability = {
      ok: true,
      object: {
        ref: { kind: "availability", id: "property_small_hotel:2026-05-11:2026-05-12" },
        checkInDate: "2026-05-11",
        checkOutDate: "2026-05-12",
        rooms: [{ roomId: "room_1", roomNumber: "1001", roomType: "花园套房", available: true }],
        availableRoomTypes: [{ roomType: "花园套房", count: 1 }],
        evidenceRefs: ["pms_ev_availability"]
      }
    };

    expect(validateObjectRef(availability.object.ref)).toMatchObject({ ok: true });
    expect(validateRoomObjectResponse(room)).toEqual({ ok: true, value: room });
    expect(validateReservationObjectResponse(reservation)).toEqual({ ok: true, value: reservation });
    expect(validateAvailabilityObjectResponse(availability)).toEqual({ ok: true, value: availability });
    expect(validateAvailabilityObjectResponse({ ...availability, object: { ...availability.object, rooms: "mock" } })).toMatchObject({ ok: false });
  });
});
