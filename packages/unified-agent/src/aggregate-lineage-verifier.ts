import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";

export type AggregateLineageVerification =
  | { ok: true }
  | { ok: false; reason: "missing_inventory_lineage" | "missing_reservation_lookup"; message: string };

type AggregateLineageFrame = {
  status?: "reserved" | "occupied";
  target: "guest_identity" | "source_ref";
};

export function verifyAggregateLineageReply(input: {
  userMessage: string;
  assistantText: string;
  evidence: readonly PmsEvidence<unknown>[];
}): AggregateLineageVerification {
  const frame = aggregateLineageFrame(input.userMessage);
  if (!frame) return { ok: true };

  const statusRefs = inventoryStatusRefs(input.evidence, frame.status);
  if (statusRefs.length === 0) {
    return {
      ok: false,
      reason: "missing_inventory_lineage",
      message: "Aggregate inventory questions require inventorySummary evidence with reserved/occupied sourceRefs before answering."
    };
  }

  if (frame.target === "guest_identity") {
    const inventoryReservations = reservationRefs(statusRefs);
    const lookupReservations = reservationLookupRefs(input.evidence);
    const missing = inventoryReservations.filter((ref) => !lookupReservations.has(ref));
    if (inventoryReservations.length === 0 || missing.length > 0) {
      return {
        ok: false,
        reason: "missing_reservation_lookup",
        message: `Guest identity answers for inventory aggregate refs require reservationLookup evidence. Missing refs: ${missing.join(", ") || "all"}.`
      };
    }
  }

  return { ok: true };
}

function aggregateLineageFrame(userMessage: string): AggregateLineageFrame | undefined {
  const question = userMessage.toLowerCase();
  if (!isAggregateLineageQuestion(question)) return undefined;
  const status = question.match(/在住|入住|occupied/) ? "occupied" : question.match(/预订|已订|订房|reserved|占房/) ? "reserved" : undefined;
  if (question.match(/谁|客人|姓名|订的|booked by|guest/)) return { status, target: "guest_identity" };
  if (question.match(/哪个|哪些|哪几|订单|来源|为什么|why|which|reservation|order/)) return { status, target: "source_ref" };
  return undefined;
}

function isAggregateLineageQuestion(question: string): boolean {
  return /汇总|库存|房态|这里显示|显示.*[0-9一二三四五六七八九十两几]+间|这[些两几0-9一二三四五六七八九十]*间|为什么.*(到店|离店).*没有|为什么.*(预订|在住|入住|占房)/.test(question)
    || /(inventory|aggregate|summary|source|lineage)/i.test(question);
}

function inventoryStatusRefs(evidence: readonly PmsEvidence<unknown>[], status: "reserved" | "occupied" | undefined): Record<string, unknown>[] {
  return evidence
    .filter((item) => item.source.method === "inventorySummary")
    .flatMap((item) => {
      const data = record(item.data);
      return Array.isArray(data?.statusRefs) ? data.statusRefs : [];
    })
    .map((item) => record(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => !status || item.status === status);
}

function reservationRefs(statusRefs: readonly Record<string, unknown>[]): string[] {
  const refs = new Set<string>();
  for (const statusRef of statusRefs) {
    if (!Array.isArray(statusRef.sourceRefs)) continue;
    for (const sourceRefValue of statusRef.sourceRefs) {
      const sourceRef = record(sourceRefValue);
      if (!sourceRef || sourceRef.sourceType !== "reservation") continue;
      addText(refs, typeof sourceRef.label === "string" ? sourceRef.label : sourceRef.sourceId);
    }
  }
  return Array.from(refs);
}

function reservationLookupRefs(evidence: readonly PmsEvidence<unknown>[]): Set<string> {
  const refs = new Set<string>();
  for (const item of evidence) {
    if (item.source.method !== "reservationLookup" && item.source.method !== "getReservation") continue;
    const data = record(item.data);
    addText(refs, data?.reservationCode);
    addText(refs, data?.reservationId);
  }
  return refs;
}

function addText(values: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.trim().length > 0) values.add(value);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
