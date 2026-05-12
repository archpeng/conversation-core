import { assertRecord, assertText } from "./schema-assertions.js";

export type InventoryTrackedStatus = "reserved" | "occupied";

export type InventorySourceRef = {
  sourceType: string;
  sourceId: string;
  label?: string;
};

export type InventoryStatusRef = {
  date: string;
  roomId: string;
  roomNumber?: string;
  roomType?: string;
  status: InventoryTrackedStatus;
  sourceRefs: InventorySourceRef[];
};

export function parseInventoryStatusRefs(object: Record<string, unknown>): InventoryStatusRef[] {
  const readModelValue = object.readModel;
  if (!readModelValue || typeof readModelValue !== "object" || Array.isArray(readModelValue)) return [];
  const readModel = readModelValue as Record<string, unknown>;
  if (!Array.isArray(readModel.dayRooms)) return [];

  return readModel.dayRooms.flatMap((item, index) => {
    const dayRoom = assertRecord(item, `readModel.dayRooms[${index}]`);
    const status = trackedStatus(dayRoom.availabilityStatus);
    if (!status) return [];
    return [{
      date: assertText(dayRoom.businessDate, `readModel.dayRooms[${index}].businessDate`),
      roomId: assertText(dayRoom.roomId, `readModel.dayRooms[${index}].roomId`),
      ...(optionalText(dayRoom.roomNumber) ? { roomNumber: optionalText(dayRoom.roomNumber) } : {}),
      ...(optionalText(dayRoom.roomType) ? { roomType: optionalText(dayRoom.roomType) } : {}),
      status,
      sourceRefs: parseSourceRefs(dayRoom.sourceRefs, `readModel.dayRooms[${index}].sourceRefs`)
    }];
  });
}

export function inventoryStatusLineageSummary(statusRefs: readonly InventoryStatusRef[] = []): string {
  const reserved = lineageParts(statusRefs, "reserved");
  const occupied = lineageParts(statusRefs, "occupied");
  return [
    reserved.length > 0 ? ` Reserved refs: ${reserved.join(", ")}.` : "",
    occupied.length > 0 ? ` Occupied refs: ${occupied.join(", ")}.` : ""
  ].join("");
}

function lineageParts(statusRefs: readonly InventoryStatusRef[], status: InventoryTrackedStatus): string[] {
  return statusRefs
    .filter((item) => item.status === status)
    .map((item) => {
      const source = item.sourceRefs[0];
      const ref = source?.label ?? source?.sourceId ?? "unknown";
      return `${ref}@${item.roomNumber ?? item.roomId}`;
    });
}

function parseSourceRefs(value: unknown, field: string): InventorySourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const source = assertRecord(item, `${field}[${index}]`);
    return {
      sourceType: assertText(source.sourceType, `${field}[${index}].sourceType`),
      sourceId: assertText(source.sourceId, `${field}[${index}].sourceId`),
      ...(optionalText(source.label) ? { label: optionalText(source.label) } : {})
    };
  });
}

function trackedStatus(value: unknown): InventoryTrackedStatus | undefined {
  return value === "reserved" || value === "occupied" ? value : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
