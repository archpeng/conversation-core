import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import {
  createPmsEvidence,
  type AvailabilitySearchResult,
  type HotelProfileResult,
  type InventorySummaryResult,
  type PendingActionStatusFact,
  type ReservationConfirmPreparation,
  type ReservationDraftFact,
  type ReservationFact,
  type ReservationGroupDraftFact,
  type ReservationGroupQuoteFact,
  type ReservationQuoteFact,
  type RoomFact,
  type RoomReservationContextResult,
  type RoomTypeCatalogResult,
  type TodayArrivalsResult,
  type TodayDeparturesResult
} from "../packages/pms-platform-client/src/index.js";
import {
  type AgentSessionEvent,
  type AgentSessionFactory,
  type AgentSessionFactoryOptions,
  type PmsReadExecutorMap,
  type PmsWorkflowExecutorMap
} from "../packages/unified-agent/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import type { FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";

export const baseTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_raw_secret",
  messageId: "message_raw_1",
  actor: { role: "customer", id: "actor_raw_secret" },
  message: { text: "查一下今天是否有空房" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

export function fakeCreateAgentSession(calls: AgentSessionFactoryOptions[], prompts: string[]): AgentSessionFactory {
  return async (options) => {
    calls.push(options);
    return {
      session: {
        async prompt(text) {
          prompts.push(text);
        }
      }
    };
  };
}

export function fakeCreateAgentSessionWithAssistantText(text: string): AgentSessionFactory {
  return fakeCreateAgentSessionWithAssistantTextSequence([text]);
}

export function fakeCreateAgentSessionWithAssistantTextSequence(texts: string[], prompts: string[] = []): AgentSessionFactory {
  return async () => {
    let index = 0;
    let listener: ((event: AgentSessionEvent) => void) | undefined;
    return {
      session: {
        subscribe(next) {
          listener = next;
          return () => {
            listener = undefined;
          };
        },
        async prompt(text) {
          prompts.push(text);
          const reply = texts[Math.min(index, texts.length - 1)] ?? "";
          index += 1;
          listener?.(agentSessionEvent({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: reply } }));
        }
      }
    };
  };
}

export function fakeCreateAgentSessionWithToolCalls(
  turns: readonly { calls?: readonly { toolName: string; params: Record<string, unknown> }[]; text?: string }[],
  prompts: string[] = []
): AgentSessionFactory {
  return async (options) => {
    const listeners: ((event: AgentSessionEvent) => void)[] = [];
    const messages: unknown[] = [];
    let index = 0;
    return {
      session: {
        subscribe(listener) {
          listeners.push(listener);
          return () => {
            const listenerIndex = listeners.indexOf(listener);
            if (listenerIndex >= 0) listeners.splice(listenerIndex, 1);
          };
        },
        async prompt(prompt) {
          prompts.push(prompt);
          const turn = turns[index++] ?? {};
          for (const [callIndex, call] of (turn.calls ?? []).entries()) {
            const tool = options.customTools.find((candidate) => candidate.name === call.toolName);
            if (!tool) throw new Error(`tool_not_visible:${call.toolName}`);
            const result = await tool.executePlan(call.params);
            emit(listeners, agentSessionEvent({
              type: "tool_execution_end",
              toolCallId: `tool_${index}_${callIndex}`,
              toolName: call.toolName,
              result,
              isError: false
            }));
          }
          const text = turn.text ?? "";
          if (text) {
            emit(listeners, agentSessionEvent({
              type: "message_update",
              message: { role: "assistant", content: text },
              assistantMessageEvent: { type: "text_delta", delta: text }
            }));
          }
          const message = { role: "assistant", content: text };
          messages.push(message);
          emit(listeners, agentSessionEvent({ type: "turn_end", message, toolResults: [] }));
        },
        messages
      }
    };
  };
}

function emit(listeners: readonly ((event: AgentSessionEvent) => void)[], event: AgentSessionEvent): void {
  for (const listener of listeners) listener(event);
}

function agentSessionEvent(event: Record<string, unknown>): AgentSessionEvent {
  return event as AgentSessionEvent;
}

export function safetyGateway(order: string[] = []): SafetyGatewayPort {
  const safetyDecisions = new WeakMap<GatedDecision, SafetyDecision>();

  return {
    decide(request: GatedToolRequest): GatedDecision {
      order.push(`decide:${request.capabilityId}`);
      const decision = decideToolRequest(toSafetyToolRequest(request));
      const gatedDecision = toGatedDecision(decision);
      safetyDecisions.set(gatedDecision, decision);
      return gatedDecision;
    },
    audit(decision: GatedDecision) {
      order.push(`audit:${decision.outcome}`);
      const safetyDecision = safetyDecisions.get(decision);
      if (!safetyDecision) return { id: `audit_${decision.audit.capabilityId}_${decision.outcome}` };
      const event = createSafetyAuditEvent(safetyDecision);
      return { id: `audit_${event.capabilityId}_${event.outcome}` };
    }
  };
}

export function auditRecordingGateway(auditEvents: string[]): SafetyGatewayPort {
  const safetyDecisions = new WeakMap<GatedDecision, SafetyDecision>();

  return {
    decide(request) {
      const decision = decideToolRequest(toSafetyToolRequest(request));
      const gatedDecision = toGatedDecision(decision);
      safetyDecisions.set(gatedDecision, decision);
      return gatedDecision;
    },
    audit(decision) {
      const safetyDecision = safetyDecisions.get(decision);
      if (!safetyDecision) return { id: `audit_${decision.audit.capabilityId}_${decision.outcome}_${auditEvents.length + 1}` };
      const event = createSafetyAuditEvent(safetyDecision);
      auditEvents.push(`${event.capabilityId}:${event.outcome}`);
      return { id: `audit_${event.capabilityId}_${event.outcome}_${auditEvents.length}` };
    }
  };
}

function toSafetyToolRequest(request: GatedToolRequest): ToolRequest {
  return {
    capabilityId: request.capabilityId,
    actor: request.actor,
    tenantId: request.tenantId,
    workspace: request.workspace,
    pendingActionId: request.pendingActionId,
    pendingActionRef: request.pendingActionRef,
    cardPayloadRef: request.cardPayloadRef,
    target: request.target,
    roomId: request.roomId,
    roomNumber: request.roomNumber,
    draftId: request.draftId,
    draftRef: request.draftRef,
    groupDraftId: request.groupDraftId,
    groupDraftRef: request.groupDraftRef,
    quoteId: request.quoteId,
    quoteRef: request.quoteRef,
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    startDate: request.startDate,
    endDate: request.endDate,
    businessDate: request.businessDate,
    reservationCode: request.reservationCode,
    reservationId: request.reservationId,
    dateContext: request.dateContext,
    roomType: request.roomType,
    roomTypeText: request.roomTypeText,
    sourceEvidenceRef: request.sourceEvidenceRef,
    selectedCandidateRef: request.selectedCandidateRef,
    quantity: request.quantity,
    guestName: request.guestName,
    content: request.content,
    operation: request.operation,
    reason: request.reason,
    sourceEpisodeRefs: request.sourceEpisodeRefs,
    riskLevel: request.riskLevel
  };
}

function toGatedDecision(decision: SafetyDecision): GatedDecision {
  return {
    outcome: decision.outcome,
    reasons: decision.reasons.map((reason) => ({ code: reason.code })),
    audit: { capabilityId: decision.audit.capabilityId }
  };
}

export function pmsReadExecutors(overrides: Partial<PmsReadExecutorMap> = {}): PmsReadExecutorMap {
  return {
    pms_hotel_profile: () => pmsEvidence("hotelProfile", hotelProfileData(), "hotel profile"),
    pms_room_type_catalog: () => pmsEvidence("roomTypeCatalog", roomTypeCatalogData(), "room type catalog"),
    pms_availability_search: () => pmsEvidence("searchAvailability", { rooms: [] }, "availability"),
    pms_inventory_summary: () => pmsEvidence("inventorySummary", { dates: [{ date: "2026-05-06", total: 1, available: 1, reserved: 0, blocked: 0, occupied: 0 }] }, "inventory"),
    pms_room_reservation_context: () => pmsEvidence("roomReservationContext", { roomId: "room-1", currentStatus: "available", reservationRefs: [], blockRefs: [] }, "room context"),
    pms_reservation_lookup: () => pmsEvidence("reservationLookup", { reservationId: "res-1", status: "confirmed", roomId: "room-1" }, "reservation lookup"),
    pms_get_room: () => pmsEvidence("getRoom", { roomId: "room-1", roomType: "suite", status: "available" }, "room fact"),
    pms_today_arrivals: () => pmsEvidence("todayArrivals", { arrivals: [] }, "today arrivals"),
    pms_today_departures: () => pmsEvidence("todayDepartures", { departures: [] }, "today departures"),
    pms_pending_action_status: () => pmsEvidence("pendingActionStatus", { pendingActionId: "pending-1", status: "pending" }, "pending action status"),
    ...overrides
  };
}

export function pmsWorkflowExecutors(overrides: Partial<PmsWorkflowExecutorMap> = {}): PmsWorkflowExecutorMap {
  return {
    pms_reservation_draft_create: () => pmsEvidence("createReservationDraft", { draftRef: "draft-1", status: "collectingSlots" }, "draft created"),
    pms_reservation_draft_update: () => pmsEvidence("updateReservationDraft", { draftRef: "draft-1", status: "collectingSlots" }, "draft updated"),
    pms_reservation_quote: () => pmsEvidence("quoteReservationDraft", { quoteRef: "quote-1", status: "pricingUnsupported" }, "quote"),
    pms_reservation_prepare_confirm: () => pmsEvidence("prepareReservationConfirm", { pendingActionId: "pending-1", confirmationMode: "typedCardOnly", mutationStatus: "none" }, "prepare confirm"),
    pms_reservation_group_draft_create: () => pmsEvidence("createReservationGroupDraft", { groupDraftRef: "group-draft-1", status: "collectingSlots" }, "group draft"),
    pms_reservation_group_draft_update: () => pmsEvidence("updateReservationGroupDraft", { groupDraftRef: "group-draft-1", status: "quoteReady" }, "group draft updated"),
    pms_reservation_group_quote: () => pmsEvidence("quoteReservationGroupDraft", { quoteRef: "group-quote-1", status: "pricingUnsupported" }, "group quote"),
    pms_reservation_group_prepare_confirm: () => pmsEvidence("prepareReservationGroupConfirm", { pendingActionId: "pending-group-1", pendingActionRef: "pending-group-1", confirmationMode: "typedCardOnly", mutationStatus: "none", selectionCount: 2 }, "group prepare"),
    ...overrides
  };
}

export function pmsEvidence(method: "hotelProfile", data: HotelProfileResult, summary: string): ReturnType<typeof createPmsEvidence<HotelProfileResult>>;
export function pmsEvidence(method: "roomTypeCatalog", data: RoomTypeCatalogResult, summary: string): ReturnType<typeof createPmsEvidence<RoomTypeCatalogResult>>;
export function pmsEvidence(method: "searchAvailability", data: AvailabilitySearchResult, summary: string): ReturnType<typeof createPmsEvidence<AvailabilitySearchResult>>;
export function pmsEvidence(method: "inventorySummary", data: InventorySummaryResult, summary: string): ReturnType<typeof createPmsEvidence<InventorySummaryResult>>;
export function pmsEvidence(method: "roomReservationContext", data: RoomReservationContextResult, summary: string): ReturnType<typeof createPmsEvidence<RoomReservationContextResult>>;
export function pmsEvidence(method: "reservationLookup", data: ReservationFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationFact>>;
export function pmsEvidence(method: "getRoom", data: RoomFact, summary: string): ReturnType<typeof createPmsEvidence<RoomFact>>;
export function pmsEvidence(method: "todayArrivals", data: TodayArrivalsResult, summary: string): ReturnType<typeof createPmsEvidence<TodayArrivalsResult>>;
export function pmsEvidence(method: "todayDepartures", data: TodayDeparturesResult, summary: string): ReturnType<typeof createPmsEvidence<TodayDeparturesResult>>;
export function pmsEvidence(method: "pendingActionStatus", data: PendingActionStatusFact, summary: string): ReturnType<typeof createPmsEvidence<PendingActionStatusFact>>;
export function pmsEvidence(method: "createReservationDraft", data: ReservationDraftFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationDraftFact>>;
export function pmsEvidence(method: "updateReservationDraft", data: ReservationDraftFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationDraftFact>>;
export function pmsEvidence(method: "quoteReservationDraft", data: ReservationQuoteFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationQuoteFact>>;
export function pmsEvidence(method: "prepareReservationConfirm", data: ReservationConfirmPreparation, summary: string): ReturnType<typeof createPmsEvidence<ReservationConfirmPreparation>>;
export function pmsEvidence(method: "createReservationGroupDraft", data: ReservationGroupDraftFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationGroupDraftFact>>;
export function pmsEvidence(method: "updateReservationGroupDraft", data: ReservationGroupDraftFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationGroupDraftFact>>;
export function pmsEvidence(method: "quoteReservationGroupDraft", data: ReservationGroupQuoteFact, summary: string): ReturnType<typeof createPmsEvidence<ReservationGroupQuoteFact>>;
export function pmsEvidence(method: "prepareReservationGroupConfirm", data: ReservationConfirmPreparation, summary: string): ReturnType<typeof createPmsEvidence<ReservationConfirmPreparation>>;
export function pmsEvidence(method: Parameters<typeof createPmsEvidence>[0]["method"], data: unknown, summary: string) {
  return createPmsEvidence({
    method,
    tenantId: "tenant_1",
    fetchedAt: "2026-05-06T12:00:00.000Z",
    data,
    summary
  });
}

function hotelProfileData(): HotelProfileResult {
  return {
    propertyId: "property-small-hotel",
    propertyName: "PMS 小型酒店样板",
    timeZone: "Asia/Shanghai",
    status: "active",
    roomTotal: 3,
    roomTypes: roomTypeCatalogData().roomTypes
  };
}

function roomTypeCatalogData(): RoomTypeCatalogResult {
  return {
    propertyId: "property-small-hotel",
    roomTypes: [
      { roomTypeId: "room-type-suite", code: "suite", displayName: "套房", roomCount: 3, status: "active" }
    ]
  };
}
