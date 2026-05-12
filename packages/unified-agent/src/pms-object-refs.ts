import type { AgentObjectRef } from "@pms-agent-v2/adapter-contracts";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";

export function objectRefsFromPmsEvidence(evidence: readonly PmsEvidence<unknown>[]): AgentObjectRef[] {
  const refs: AgentObjectRef[] = [];
  for (const item of evidence) {
    if (item.source.method === "todayArrivals") {
      refs.push(...reservationRefsFromStayEvents(records(record(item.data)?.arrivals), item.evidenceRef));
      continue;
    }
    if (item.source.method === "todayDepartures") {
      refs.push(...reservationRefsFromStayEvents(records(record(item.data)?.departures), item.evidenceRef));
      continue;
    }
    if (item.source.method === "reservationLookup" || item.source.method === "getReservation") {
      const ref = reservationRefFromFact(record(item.data), item.evidenceRef);
      if (ref) refs.push(ref);
      continue;
    }
    if (item.source.method === "inventorySummary") {
      refs.push(...reservationRefsFromInventory(item));
    }
  }
  return uniqueObjectRefs(refs);
}

function reservationRefsFromStayEvents(events: readonly Record<string, unknown>[], evidenceRef: string): AgentObjectRef[] {
  return events.flatMap((event) => {
    const id = text(event.reservationCode) ?? text(event.reservationId);
    if (!id) return [];
    return [{
      kind: "reservation" as const,
      id,
      ...(stayEventLabel(event) ? { label: stayEventLabel(event) } : {}),
      evidenceRefs: [evidenceRef]
    }];
  });
}

function reservationRefFromFact(fact: Record<string, unknown> | undefined, evidenceRef: string): AgentObjectRef | undefined {
  if (!fact) return undefined;
  const id = text(fact.reservationCode) ?? text(fact.reservationId);
  if (!id) return undefined;
  const label = stayEventLabel(fact) ?? id;
  return {
    kind: "reservation",
    id,
    label,
    evidenceRefs: [evidenceRef]
  };
}

function reservationRefsFromInventory(evidence: PmsEvidence<unknown>): AgentObjectRef[] {
  return records(record(evidence.data)?.statusRefs).flatMap((statusRef) => {
    const room = text(statusRef.roomNumber) ?? text(statusRef.roomId);
    return records(statusRef.sourceRefs)
      .filter((sourceRef) => sourceRef.sourceType === "reservation")
      .flatMap((sourceRef) => {
        const id = text(sourceRef.label) ?? text(sourceRef.sourceId);
        if (!id) return [];
        return [{
          kind: "reservation" as const,
          id,
          label: [id, room].filter(Boolean).join(" · "),
          evidenceRefs: [evidence.evidenceRef]
        }];
      });
  });
}

function stayEventLabel(event: Record<string, unknown>): string | undefined {
  const parts = [text(event.guestName), text(event.roomNumber) ?? text(event.roomId)].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function uniqueObjectRefs(refs: readonly AgentObjectRef[]): AgentObjectRef[] {
  const byKey = new Map<string, AgentObjectRef>();
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ref);
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...(existing.label ? {} : ref.label ? { label: ref.label } : {}),
      evidenceRefs: mergeStrings(existing.evidenceRefs, ref.evidenceRefs)
    });
  }
  return Array.from(byKey.values()).slice(0, 8);
}

function mergeStrings(left: readonly string[] | undefined, right: readonly string[] | undefined): string[] | undefined {
  const merged = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return merged.length > 0 ? merged : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const itemRecord = record(item);
    return itemRecord ? [itemRecord] : [];
  });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
