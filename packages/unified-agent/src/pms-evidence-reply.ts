import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";

export function structuredPmsReplyText(evidence: readonly PmsEvidence<unknown>[]): string | undefined {
  if (evidence.length !== 1) return undefined;
  const item = evidence[0];
  if (item.source.method === "todayArrivals") {
    return stayEventListText("到店", records(record(item.data)?.arrivals));
  }
  if (item.source.method === "todayDepartures") {
    return stayEventListText("离店", records(record(item.data)?.departures));
  }
  if (item.source.method === "reservationLookup" || item.source.method === "getReservation") {
    return reservationDetailText(record(item.data));
  }
  return undefined;
}

function stayEventListText(kind: "到店" | "离店", events: readonly Record<string, unknown>[]): string {
  const date = sharedEventDate(kind, events);
  const title = `${date ? `${date} ` : "查询日期"}${kind}`;
  if (events.length === 0) return `${title}暂无记录。`;

  return [
    `${title} ${events.length} 单：`,
    "",
    events.map(stayEventText).join("\n\n")
  ].join("\n");
}

function stayEventText(event: Record<string, unknown>): string {
  const reservationCode = text(event.reservationCode) ?? text(event.reservationId) ?? "未知预订号";
  const room = [text(event.roomNumber) ?? text(event.roomId), text(event.roomType)].filter(Boolean).join(" · ");
  return [
    [text(event.guestName), room].filter(Boolean).join(" · ") || reservationCode,
    `预订号：${reservationCode}`,
    `状态：${text(event.status) ?? "unknown"}`
  ].join("\n");
}

function reservationDetailText(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  const reservationCode = text(value.reservationCode) ?? text(value.reservationId);
  if (!reservationCode) return undefined;
  const room = [text(value.roomNumber) ?? text(value.roomId), text(value.roomType)].filter(Boolean).join(" · ");
  return [
    `预订 ${reservationCode}：`,
    [text(value.guestName), room].filter(Boolean).join(" · ") || reservationCode,
    value.arrivalDate || value.departureDate ? `入住：${text(value.arrivalDate) ?? "未知"}；离店：${text(value.departureDate) ?? "未知"}` : undefined,
    `状态：${text(value.status) ?? "unknown"}`
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function sharedEventDate(kind: "到店" | "离店", events: readonly Record<string, unknown>[]): string | undefined {
  const key = kind === "到店" ? "arrivalDate" : "departureDate";
  const dates = new Set(events.map((event) => text(event[key])).filter((date): date is string => Boolean(date)));
  return dates.size === 1 ? Array.from(dates)[0] : undefined;
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
