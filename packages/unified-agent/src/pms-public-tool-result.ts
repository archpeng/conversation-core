import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";

const previewLimit = 5;
const sourceRefPreviewLimit = 3;

export type PublicToolResultInput = {
  outcome: string;
  auditId: string;
  value?: unknown;
};

export function publicToolResult(result: PublicToolResultInput): unknown {
  if (result.outcome !== "allow") return { outcome: result.outcome, auditId: result.auditId };
  if (isPmsEvidence(result.value)) {
    const capability = pmsCapabilityContract(result.value.source.method);
    const dataPreview = pmsDataPreview(result.value);
    return {
      outcome: result.outcome,
      auditId: result.auditId,
      evidenceRef: result.value.evidenceRef,
      source: result.value.source,
      publicSummary: pmsPublicSummary(result.value),
      ...(capability ? { capability } : {}),
      ...(dataPreview ? { dataPreview } : {})
    };
  }
  return { outcome: result.outcome, auditId: result.auditId, value: result.value };
}

function pmsPublicSummary(evidence: PmsEvidence<unknown>): string {
  const data = record(evidence.data);
  if (!data) return `${evidence.source.method} evidence returned.`;
  if (evidence.source.method === "inventorySummary") {
    const dates = records(data.dates);
    const first = dates[0];
    const statusRefs = records(data.statusRefs);
    if (!first) return "Inventory summary returned 0 date rows.";
    return `Inventory summary returned ${dates.length} date row(s). First date ${text(first.date) ?? "unknown"}: total ${numberText(first.total)}, available ${numberText(first.available)}, reserved ${numberText(first.reserved)}, blocked ${numberText(first.blocked)}, occupied ${numberText(first.occupied)}. statusRefCount=${statusRefs.length}.`;
  }
  if (evidence.source.method === "todayArrivals") {
    return `Today arrivals returned ${records(data.arrivals).length} reservation event(s).`;
  }
  if (evidence.source.method === "todayDepartures") {
    return `Today departures returned ${records(data.departures).length} reservation event(s).`;
  }
  if (evidence.source.method === "reservationLookup" || evidence.source.method === "getReservation") {
    const reservation = pickDefined(data, ["reservationCode", "reservationId", "guestName", "roomNumber", "roomId", "roomType", "arrivalDate", "departureDate", "status"]);
    return `Reservation detail returned: ${JSON.stringify(reservation)}.`;
  }
  if (evidence.source.method === "searchAvailability") {
    return `Availability search returned ${records(data.rooms).length} room candidate(s).`;
  }
  return `${evidence.source.method} evidence returned.`;
}

function pmsCapabilityContract(method: string): Record<string, unknown> | undefined {
  const contracts: Record<string, Record<string, unknown>> = {
    inventorySummary: {
      answers: ["inventory_count", "availability_state", "aggregate_lineage"],
      entities: ["room", "reservation_ref"],
      lineageFields: ["statusRefs.sourceRefs"]
    },
    reservationLookup: {
      answers: ["reservation_detail", "guest_identity"],
      entities: ["reservation", "guest", "room"]
    },
    todayArrivals: {
      answers: ["arrival_event"],
      temporalMeaning: "arrivalDate equals businessDate",
      entities: ["reservation", "guest", "room"]
    },
    todayDepartures: {
      answers: ["departure_event"],
      temporalMeaning: "departureDate equals businessDate",
      entities: ["reservation", "guest", "room"]
    }
  };
  return contracts[method];
}

function pmsDataPreview(evidence: PmsEvidence<unknown>): Record<string, unknown> | undefined {
  const data = record(evidence.data);
  if (!data) return undefined;
  if (evidence.source.method === "inventorySummary") {
    const statusRefs = records(data.statusRefs);
    return Array.isArray(data.statusRefs) ? { statusRefCount: statusRefs.length, statusRefs: statusRefs.slice(0, previewLimit).map(statusRefPreview) } : undefined;
  }
  if (evidence.source.method === "reservationLookup" || evidence.source.method === "getReservation") {
    return { reservation: pickDefined(data, ["reservationId", "reservationCode", "guestName", "roomId", "roomNumber", "roomType", "arrivalDate", "departureDate", "status"]) };
  }
  if (evidence.source.method === "todayArrivals" && Array.isArray(data.arrivals)) {
    const arrivals = records(data.arrivals);
    return { arrivalCount: arrivals.length, arrivals: arrivals.slice(0, previewLimit).map(stayEventPreview) };
  }
  if (evidence.source.method === "todayDepartures" && Array.isArray(data.departures)) {
    const departures = records(data.departures);
    return { departureCount: departures.length, departures: departures.slice(0, previewLimit).map(stayEventPreview) };
  }
  return undefined;
}

function statusRefPreview(value: Record<string, unknown>): Record<string, unknown> {
  const preview = pickDefined(value, ["date", "roomId", "roomNumber", "roomType", "status"]);
  const sourceRefs = records(value.sourceRefs).slice(0, sourceRefPreviewLimit).map((sourceRef) => pickDefined(sourceRef, ["sourceType", "sourceId", "label"]));
  if (sourceRefs.length > 0) preview.sourceRefs = sourceRefs;
  return preview;
}

function stayEventPreview(value: Record<string, unknown>): Record<string, unknown> {
  return pickDefined(value, ["reservationCode", "reservationId", "guestName", "roomId", "roomNumber", "roomType", "arrivalDate", "departureDate", "status"]);
}

function pickDefined(recordValue: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, recordValue[key]]).filter(([, value]) => value !== undefined));
}

function isPmsEvidence(value: unknown): value is PmsEvidence<unknown> {
  const recordValue = record(value);
  if (!recordValue) return false;
  const source = record(recordValue.source);
  return typeof recordValue.evidenceRef === "string"
    && typeof recordValue.summary === "string"
    && source?.system === "pms-platform"
    && typeof source.method === "string";
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

function numberText(value: unknown): string {
  return typeof value === "number" ? String(value) : "unknown";
}
