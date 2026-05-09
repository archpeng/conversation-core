import { assertRecord, assertText, validateTenantScopedInput } from "./schemas.js";

export type InventorySummaryInput = {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
};

export type InventorySummaryResult = {
  dates: Array<{
    date: string;
    total: number;
    available: number;
    reserved: number;
    blocked: number;
    occupied: number;
  }>;
  roomTypes?: Array<{
    roomType: string;
    total: number;
  }>;
};

export type RoomReservationContextInput = {
  tenantId: string;
  roomId: string;
  dateContext?: string;
};

export type RoomReservationContextResult = {
  roomId: string;
  currentStatus: string;
  reservationRefs: string[];
  blockRefs: string[];
};

export type TodayArrivalsInput = {
  tenantId: string;
  businessDate: string;
};

export type TodayArrivalsResult = {
  arrivals: Array<{
    reservationCode: string;
    roomId: string;
    guestName: string;
    status: string;
  }>;
};

export type TodayDeparturesInput = {
  tenantId: string;
  businessDate: string;
};

export type TodayDeparturesResult = {
  departures: Array<{
    reservationCode: string;
    roomId: string;
    guestName: string;
    status: string;
  }>;
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateInventorySummaryInput(input: unknown): asserts input is InventorySummaryInput {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new Error("inventorySummaryInput must be an object");
  const typed = obj as InventorySummaryInput;
  validateTenantScopedInput(typed);
  assertText(typed.propertyId, "propertyId");
  assertText(typed.startDate, "startDate");
  assertText(typed.endDate, "endDate");
  if (!isValidISODate(typed.startDate)) throw new Error("startDate must be a valid ISO date");
  if (!isValidISODate(typed.endDate)) throw new Error("endDate must be a valid ISO date");
  if (isoDateMs(typed.endDate) < isoDateMs(typed.startDate)) {
    throw new Error("endDate must be on or after startDate");
  }
}

export function validateRoomReservationContextInput(input: unknown): asserts input is RoomReservationContextInput {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new Error("roomReservationContextInput must be an object");
  const typed = obj as RoomReservationContextInput;
  validateTenantScopedInput(typed);
  assertText(typed.roomId, "roomId");
  if (typed.dateContext !== undefined) {
    assertText(typed.dateContext, "dateContext");
    if (!isValidISODate(typed.dateContext)) throw new Error("dateContext must be a valid ISO date");
  }
}

export function validateTodayArrivalsInput(input: unknown): asserts input is TodayArrivalsInput {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new Error("todayArrivalsInput must be an object");
  const typed = obj as TodayArrivalsInput;
  validateTenantScopedInput(typed);
  assertText(typed.businessDate, "businessDate");
  if (!isValidISODate(typed.businessDate)) throw new Error("businessDate must be a valid ISO date");
}

export function validateTodayDeparturesInput(input: unknown): asserts input is TodayDeparturesInput {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new Error("todayDeparturesInput must be an object");
  const typed = obj as TodayDeparturesInput;
  validateTenantScopedInput(typed);
  assertText(typed.businessDate, "businessDate");
  if (!isValidISODate(typed.businessDate)) throw new Error("businessDate must be a valid ISO date");
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseInventorySummaryResult(value: unknown): InventorySummaryResult {
  const object = assertRecord(value, "inventory summary response");
  const platformSummary = platformSummaryProjection(object);
  const rawDates = Array.isArray(object.dates) ? object.dates : platformSummary?.dates;
  if (!Array.isArray(rawDates)) throw new Error("dates must be an array");
  const dates = rawDates.map((item, index) => {
    const entry = assertRecord(item, `dates[${index}]`);
    const total = typeof entry.total === "number" ? entry.total : -1;
    const available = typeof entry.available === "number" ? entry.available : -1;
    const reserved = typeof entry.reserved === "number" ? entry.reserved : -1;
    const blocked = typeof entry.blocked === "number" ? entry.blocked : -1;
    const occupied = typeof entry.occupied === "number" ? entry.occupied : -1;
    if (total < 0) throw new Error(`dates[${index}].total must be a number`);
    if (available < 0) throw new Error(`dates[${index}].available must be a number`);
    if (reserved < 0) throw new Error(`dates[${index}].reserved must be a number`);
    if (blocked < 0) throw new Error(`dates[${index}].blocked must be a number`);
    if (occupied < 0) throw new Error(`dates[${index}].occupied must be a number`);
    return {
      date: assertText(entry.date, `dates[${index}].date`),
      total,
      available,
      reserved,
      blocked,
      occupied
    };
  });
  return {
    dates,
    ...(platformSummary?.roomTypes ? { roomTypes: platformSummary.roomTypes } : {})
  };
}

function platformSummaryProjection(object: Record<string, unknown>): { dates: unknown[]; roomTypes: Array<{ roomType: string; total: number }> } | undefined {
  const readModelValue = object.readModel;
  if (!readModelValue || typeof readModelValue !== "object" || Array.isArray(readModelValue)) return undefined;
  const readModel = readModelValue as Record<string, unknown>;
  const summaries = readModel.summaries;
  if (!Array.isArray(summaries)) return undefined;
  const byDate = new Map<string, { total: number; available: number; reserved: number; blocked: number; occupied: number }>();
  const byRoomType = new Map<string, number>();
  summaries.forEach((item, index) => {
    const summary = assertRecord(item, `readModel.summaries[${index}]`);
    const date = assertText(summary.businessDate, `readModel.summaries[${index}].businessDate`);
    const roomType = optionalText(summary.roomType) ?? assertText(summary.roomTypeId, `readModel.summaries[${index}].roomTypeId`);
    const totalRooms = numericSummaryField(summary.totalRooms);
    const current = byDate.get(date) ?? { total: 0, available: 0, reserved: 0, blocked: 0, occupied: 0 };
    byDate.set(date, {
      total: current.total + totalRooms,
      available: current.available + numericSummaryField(summary.availableRooms),
      reserved: current.reserved + numericSummaryField(summary.reservedRooms),
      blocked: current.blocked + numericSummaryField(summary.blockedRooms),
      occupied: current.occupied + numericSummaryField(summary.occupiedRooms)
    });
    byRoomType.set(roomType, Math.max(byRoomType.get(roomType) ?? 0, totalRooms));
  });
  return {
    dates: Array.from(byDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, counts]) => {
        return {
          date,
          ...counts
        };
      }),
    roomTypes: Array.from(byRoomType.entries())
      .map(([roomType, total]) => ({ roomType, total }))
      .sort((left, right) => left.roomType.localeCompare(right.roomType))
  };
}

function numericSummaryField(value: unknown): number {
  return typeof value === "number" ? value : -1;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isoDateMs(value: string): number {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
}

export function parseRoomReservationContextResult(value: unknown): RoomReservationContextResult {
  const object = assertRecord(value, "room reservation context response");
  const rawReservationRefs = object.reservationRefs;
  const rawBlockRefs = object.blockRefs;
  let reservationRefs: string[] = [];
  let blockRefs: string[] = [];
  if (Array.isArray(rawReservationRefs)) {
    reservationRefs = rawReservationRefs.map((item, index) => {
      if (typeof item === "string" && item.trim().length > 0) return item;
      return assertText(item, `reservationRefs[${index}]`);
    });
  }
  if (Array.isArray(rawBlockRefs)) {
    blockRefs = rawBlockRefs.map((item, index) => {
      if (typeof item === "string" && item.trim().length > 0) return item;
      return assertText(item, `blockRefs[${index}]`);
    });
  }
  return {
    roomId: assertText(object.roomId, "roomId"),
    currentStatus: assertText(object.currentStatus, "currentStatus"),
    reservationRefs,
    blockRefs
  };
}

export function parseTodayArrivalsResult(value: unknown): TodayArrivalsResult {
  const object = assertRecord(value, "today arrivals response");
  const rawArrivals = object.arrivals;
  if (!Array.isArray(rawArrivals)) throw new Error("arrivals must be an array");
  const arrivals = rawArrivals.map((item, index) => {
    const entry = assertRecord(item, `arrivals[${index}]`);
    return {
      reservationCode: assertText(entry.reservationCode, `arrivals[${index}].reservationCode`),
      roomId: assertText(entry.roomId, `arrivals[${index}].roomId`),
      guestName: assertText(entry.guestName, `arrivals[${index}].guestName`),
      status: assertText(entry.status, `arrivals[${index}].status`)
    };
  });
  return { arrivals };
}

export function parseTodayDeparturesResult(value: unknown): TodayDeparturesResult {
  const object = assertRecord(value, "today departures response");
  const rawDepartures = object.departures;
  if (!Array.isArray(rawDepartures)) throw new Error("departures must be an array");
  const departures = rawDepartures.map((item, index) => {
    const entry = assertRecord(item, `departures[${index}]`);
    return {
      reservationCode: assertText(entry.reservationCode, `departures[${index}].reservationCode`),
      roomId: assertText(entry.roomId, `departures[${index}].roomId`),
      guestName: assertText(entry.guestName, `departures[${index}].guestName`),
      status: assertText(entry.status, `departures[${index}].status`)
    };
  });
  return { departures };
}

// ---------------------------------------------------------------------------
// Summary builders
// ---------------------------------------------------------------------------

export function inventorySummary(result: InventorySummaryResult): string {
  const count = result.dates.length;
  const present = result.dates.reduce(
    (acc, d) => {
      acc.total += d.total;
      acc.available += d.available;
      acc.reserved += d.reserved;
      acc.blocked += d.blocked;
      acc.occupied += d.occupied;
      return acc;
    },
    { total: 0, available: 0, reserved: 0, blocked: 0, occupied: 0 }
  );
  const first = result.dates[0]?.date ?? "?";
  const last = result.dates[count - 1]?.date ?? "?";
  const perDateTotal = result.dates[0]?.total ?? 0;
  const roomTypes = result.roomTypes?.length
    ? ` Room types: ${result.roomTypes.map((item) => `${item.roomType} ${item.total}`).join(", ")}.`
    : "";
  return `Inventory for ${first}–${last}: ${perDateTotal} total rooms across ${count} dates. Available: ${present.available}, Reserved: ${present.reserved}, Blocked: ${present.blocked}, Occupied: ${present.occupied}.${roomTypes}`;
}

export function roomReservationContextSummary(result: RoomReservationContextResult): string {
  const refCount = result.reservationRefs.length + result.blockRefs.length;
  return `Room ${result.roomId}: current status ${result.currentStatus}, associated with ${refCount} reservation(s)/block(s).`;
}

export function todayArrivalsSummary(result: TodayArrivalsResult): string {
  const codes = result.arrivals.map((a) => a.reservationCode).join(", ");
  return `${result.arrivals.length} arrivals: ${codes}.`;
}

export function todayDeparturesSummary(result: TodayDeparturesResult): string {
  const codes = result.departures.map((d) => d.reservationCode).join(", ");
  return `${result.departures.length} departures: ${codes}.`;
}
