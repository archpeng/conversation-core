import type { AgentResult } from "@pms-agent-v2/adapter-contracts";
import { pmsTypedOperationKinds } from "@pms-agent-v2/product-contracts";
import type { ActionCard, AgentTask, ObjectRef, PmsTypedOperationKind } from "@pms-agent-v2/product-contracts";
import type { HotelProfileResult, InventorySummaryResult, PmsEvidence, ReservationStayEvent, RoomTypeCatalogResult, TodayArrivalsResult, TodayDeparturesResult } from "@pms-agent-v2/pms-platform-client";

export function taskFromAgentResult(result: AgentResult, now = new Date()): AgentTask {
  const timestamp = now.toISOString();
  const id = `task_agent_${now.getTime()}`;
  if (result.type === "text") {
    const text = visibleAgentText(result.text, result.evidenceRefs ?? []);
    return baseTask({ id, title: "Agent response", summary: text, source: "agent", status: result.evidenceRefs?.length ? "read_only" : "suggested", timestamp, evidenceRefs: result.evidenceRefs, objectRefs: result.objectRefs, messages: [text] });
  }
  if (result.type === "approval_card") {
    const card = result.card;
    return baseTask({
      id,
      title: card.title,
      summary: card.summary,
      source: "agent",
      status: "awaiting_confirmation",
      timestamp,
      objectRefs: [{ kind: "pendingAction", id: card.ref.pendingActionId, label: "Pending PMS action" }],
      actionCards: [{
        id: `card_${id}`,
        title: card.title,
        summary: card.summary,
        mutationStatus: "awaitingConfirmation",
        confirmationMode: "typedCardOnly",
        objectRefs: [{ kind: "pendingAction", id: card.ref.pendingActionId, label: "Pending PMS action" }],
        ...(card.ref.cardPayloadRef ? {
          operationRef: {
            type: "pmsPendingAction" as const,
            tenantId: card.ref.tenantId,
            pendingActionId: card.ref.pendingActionId,
            ...(card.ref.pendingActionRef ? { pendingActionRef: card.ref.pendingActionRef } : {}),
            cardPayloadRef: card.ref.cardPayloadRef,
            action: "reservation_confirm" as const
          }
        } : {}),
        actions: [
          { id: "confirm", label: card.confirmLabel, kind: "primary", confirmationRequired: true, disabled: !card.ref.cardPayloadRef },
          { id: "cancel", label: card.cancelLabel, kind: "secondary", disabled: !card.ref.cardPayloadRef }
        ]
      }]
    });
  }
  if (result.type === "proposal") {
    return baseTask({
      id,
      title: result.title,
      summary: result.summary,
      source: "agent",
      status: "draft_ready",
      timestamp,
      actionCards: [{
        id: `card_${result.proposalId}`,
        title: result.title,
        summary: result.summary,
        mutationStatus: "draftOnly",
        confirmationMode: "external",
        objectRefs: [{ kind: "task", id: result.proposalId, label: "Proposal" }],
        actions: [{ id: "review", label: "查看", kind: "secondary", disabled: true }]
      }]
    });
  }
  return baseTask({ id, title: "Agent refused request", summary: result.message, source: "agent", status: "failed", timestamp, messages: [result.message] });
}

export function todayReadTasks(input: {
  tenantId: string;
  propertyId: string;
  businessDate: string;
  arrivals: PmsEvidence<TodayArrivalsResult>;
  departures: PmsEvidence<TodayDeparturesResult>;
  inventory: PmsEvidence<InventorySummaryResult>;
  profile?: PmsEvidence<HotelProfileResult>;
  catalog?: PmsEvidence<RoomTypeCatalogResult>;
  now?: Date;
}): AgentTask[] {
  const timestamp = (input.now ?? new Date()).toISOString();
  const propertyRef: ObjectRef = { kind: "property", id: input.propertyId, label: input.propertyId };
  return [
    ...(input.profile ? [baseTask({
      id: `task_profile_${input.propertyId}`,
      title: "酒店概况",
      summary: `${input.profile.data.propertyName} · ${input.profile.data.roomTotal} 间房 · ${input.profile.data.status}`,
      source: "pms",
      status: "read_only",
      timestamp,
      evidenceRefs: [input.profile.evidenceRef],
      objectRefs: [propertyRef],
      messages: [`时区 ${input.profile.data.timeZone}`, `房型 ${input.profile.data.roomTypes.length} 类`]
    })] : []),
    ...(input.catalog ? [baseTask({
      id: `task_room_types_${input.propertyId}`,
      title: "房型目录",
      summary: `${input.catalog.data.roomTypes.length} 类房型。${codes(input.catalog.data.roomTypes.map((item) => item.displayName))}`,
      source: "pms",
      status: "read_only",
      timestamp,
      evidenceRefs: [input.catalog.evidenceRef],
      objectRefs: [propertyRef, ...input.catalog.data.roomTypes.map((item): ObjectRef => ({ kind: "roomType", id: item.roomTypeId, label: item.displayName }))],
      messages: input.catalog.data.roomTypes.map((item) => `${item.displayName}: ${item.roomCount} 间 · ${item.status}`)
    })] : []),
    baseTask({
      id: `task_arrivals_${input.businessDate}`,
      title: "今日到店",
      summary: `${input.arrivals.data.arrivals.length} 条到店记录。${codes(input.arrivals.data.arrivals.map((item) => item.reservationCode))}`,
      source: "pms",
      status: "read_only",
      timestamp,
      evidenceRefs: [input.arrivals.evidenceRef],
      objectRefs: [propertyRef, ...reservationObjectRefs(input.arrivals.data.arrivals, input.arrivals.evidenceRef)],
      messages: input.arrivals.data.arrivals.map(stayEventMessage),
      actionCards: input.arrivals.data.arrivals.slice(0, 1).map((item) => typedOperationCard({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        operation: "check_in",
        targetRef: item.reservationCode,
        title: "办理入住",
        summary: `${item.guestName} · ${item.roomId}`
      }))
    }),
    baseTask({
      id: `task_departures_${input.businessDate}`,
      title: "今日离店",
      summary: `${input.departures.data.departures.length} 条离店记录。${codes(input.departures.data.departures.map((item) => item.reservationCode))}`,
      source: "pms",
      status: "read_only",
      timestamp,
      evidenceRefs: [input.departures.evidenceRef],
      objectRefs: [propertyRef, ...reservationObjectRefs(input.departures.data.departures, input.departures.evidenceRef)],
      messages: input.departures.data.departures.map(stayEventMessage),
      actionCards: input.departures.data.departures.slice(0, 1).map((item) => typedOperationCard({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        operation: "check_out",
        targetRef: item.reservationCode,
        title: "办理退房",
        summary: `${item.guestName} · ${item.roomId}`
      }))
    }),
    baseTask({
      id: `task_inventory_${input.businessDate}`,
      title: "今日库存",
      summary: inventorySummary(input.inventory.data),
      source: "pms",
      status: "read_only",
      timestamp,
      evidenceRefs: [input.inventory.evidenceRef],
      objectRefs: [propertyRef],
      messages: input.inventory.data.roomTypes?.map((item) => `${item.roomType}: ${item.total} 间`),
      actionCards: operationalCards(input.tenantId, input.propertyId, input.businessDate)
    })
  ];
}

const typedOperationDefinitions: Record<PmsTypedOperationKind, { title: string; target: "reservation" | "propertyDay" }> = {
  check_in: { title: "办理入住", target: "reservation" },
  check_out: { title: "办理退房", target: "reservation" },
  housekeeping_done: { title: "标记清洁完成", target: "propertyDay" },
  housekeeping_inspection: { title: "提交查房", target: "propertyDay" },
  housekeeping_rework: { title: "发起返工", target: "propertyDay" },
  maintenance_report: { title: "报修", target: "propertyDay" },
  maintenance_done: { title: "维修完成", target: "propertyDay" },
  maintenance_restore_sellable: { title: "恢复可售", target: "propertyDay" }
};

const operationalOperationKinds = pmsTypedOperationKinds.filter((operation) => typedOperationDefinitions[operation].target === "propertyDay");

function operationalCards(tenantId: string, propertyId: string, businessDate: string): ActionCard[] {
  return operationalOperationKinds.map((operation) => {
    const definition = typedOperationDefinitions[operation];
    return typedOperationCard({
      tenantId,
      propertyId,
      operation,
      targetRef: `${propertyId}:${businessDate}:${operation}`,
      title: definition.title,
      summary: `${businessDate} · ${propertyId}`
    });
  });
}

function typedOperationCard(input: { tenantId: string; propertyId: string; operation: PmsTypedOperationKind; targetRef: string; title: string; summary: string }): ActionCard {
  const cardPayloadRef = `card_${input.operation}_${input.targetRef}`;
  return {
    id: cardPayloadRef,
    title: input.title,
    summary: input.summary,
    mutationStatus: "awaitingConfirmation",
    confirmationMode: "typedCardOnly",
    operationRef: {
      type: "pmsOperation",
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      operation: input.operation,
      targetRef: input.targetRef,
      cardPayloadRef
    },
    actions: [{ id: "confirm", label: input.title, kind: "primary", confirmationRequired: true }]
  };
}

function baseTask(input: Omit<AgentTask, "createdAt" | "updatedAt"> & { timestamp: string }): AgentTask {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    status: input.status,
    source: input.source,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    ...(input.evidenceRefs ? { evidenceRefs: input.evidenceRefs } : {}),
    ...(input.objectRefs ? { objectRefs: input.objectRefs } : {}),
    ...(input.actionCards ? { actionCards: input.actionCards } : {}),
    ...(input.messages ? { messages: input.messages } : {})
  };
}

function codes(values: readonly string[]): string {
  return values.length ? values.join(", ") : "暂无。";
}

function inventorySummary(data: InventorySummaryResult): string {
  const today = data.dates[0];
  if (!today) return "暂无库存数据。";
  return `${today.available}/${today.total} 间可售，预订 ${today.reserved}，占用 ${today.occupied}，锁房 ${today.blocked}。`;
}

function reservationObjectRefs(events: readonly ReservationStayEvent[], evidenceRef: string): ObjectRef[] {
  return events.map((item): ObjectRef => ({
    kind: "reservation",
    id: item.reservationCode,
    label: [item.guestName, item.roomNumber ?? item.roomId].filter(Boolean).join(" · "),
    evidenceRefs: [evidenceRef]
  }));
}

function stayEventMessage(item: ReservationStayEvent): string {
  const room = [item.roomNumber ?? item.roomId, item.roomType].filter(Boolean).join(" · ");
  return `${item.reservationCode} · ${item.guestName} · ${room} · ${item.status}`;
}

function visibleAgentText(text: string, evidenceRefs: readonly string[]): string {
  if (evidenceRefs.length === 0) return text;
  const cleaned = text
    .split(/\r?\n/)
    .flatMap((line) => visibleLineParts(line, evidenceRefs))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || "PMS 查询已完成。";
}

function visibleLineParts(line: string, evidenceRefs: readonly string[]): string[] {
  if (!evidenceRefs.some((ref) => line.includes(ref))) return [line];
  const markerIndex = evidenceMarkerIndex(line);
  if (markerIndex < 0) return [line];
  if (line.slice(0, markerIndex).trim().length === 0) return [];
  return [line.slice(0, markerIndex).trimEnd()];
}

function evidenceMarkerIndex(line: string): number {
  const markers = ["依据 PMS", "依据PMS", "依据：", "依据:", "证据来源", "证据：", "证据:", "Evidence", "evidenceRef", "evidenceRefs"];
  return markers.reduce((best, marker) => {
    const index = line.indexOf(marker);
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);
}
