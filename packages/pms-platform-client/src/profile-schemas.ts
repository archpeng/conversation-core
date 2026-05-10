import { assertArray, assertNonNegativeInteger, assertRecord, assertText, isPlainRecord } from "./schema-assertions.js";
import { validateTenantScopedInput } from "./tenant-schemas.js";

export type HotelProfileInput = {
  tenantId: string;
  propertyId?: string;
};

export type RoomTypeCatalogInput = {
  tenantId: string;
  propertyId?: string;
};

export type RoomTypeCatalogItem = {
  roomTypeId: string;
  code: string;
  displayName: string;
  roomCount: number;
  status: string;
};

export type RoomTypeCatalogResult = {
  propertyId?: string;
  roomTypes: RoomTypeCatalogItem[];
};

export type HotelProfileResult = {
  propertyId: string;
  propertyName: string;
  timeZone: string;
  status: string;
  roomTotal: number;
  roomTypes: RoomTypeCatalogItem[];
  address?: string;
  phone?: string;
};

export function validateHotelProfileInput(input: HotelProfileInput): void {
  validateTenantScopedInput(input);
  if (input.propertyId !== undefined) assertText(input.propertyId, "propertyId");
}

export function validateRoomTypeCatalogInput(input: RoomTypeCatalogInput): void {
  validateTenantScopedInput(input);
  if (input.propertyId !== undefined) assertText(input.propertyId, "propertyId");
}

export function parseHotelProfileResult(value: unknown): HotelProfileResult {
  const object = assertRecord(value, "hotel profile response");
  const source = isPlainRecord(object.readModel) ? object.readModel : object;
  const result: HotelProfileResult = {
    propertyId: assertText(source.propertyId, "readModel.propertyId"),
    propertyName: assertText(source.propertyName, "readModel.propertyName"),
    timeZone: assertText(source.timeZone, "readModel.timeZone"),
    status: assertText(source.status, "readModel.status"),
    roomTotal: assertNonNegativeInteger(source.roomTotal, "readModel.roomTotal"),
    roomTypes: parseRoomTypeCatalogItems(source.roomTypes, "readModel.roomTypes")
  };
  if (typeof source.address === "string" && source.address.trim()) result.address = source.address;
  if (typeof source.phone === "string" && source.phone.trim()) result.phone = source.phone;
  return result;
}

export function parseRoomTypeCatalogResult(value: unknown): RoomTypeCatalogResult {
  const object = assertRecord(value, "room type catalog response");
  const source = isPlainRecord(object.readModel) ? object.readModel : object;
  return {
    ...(typeof source.propertyId === "string" && source.propertyId.trim() ? { propertyId: source.propertyId } : {}),
    roomTypes: parseRoomTypeCatalogItems(source.roomTypes, "readModel.roomTypes")
  };
}

export function parseRoomTypeCatalogItems(value: unknown, field: string): RoomTypeCatalogItem[] {
  return assertArray(value, field).map((item, index) => {
    const record = assertRecord(item, `${field}[${index}]`);
    return {
      roomTypeId: assertText(record.roomTypeId, `${field}[${index}].roomTypeId`),
      code: assertText(record.code, `${field}[${index}].code`),
      displayName: assertText(record.displayName, `${field}[${index}].displayName`),
      roomCount: assertNonNegativeInteger(record.roomCount, `${field}[${index}].roomCount`),
      status: assertText(record.status, `${field}[${index}].status`)
    };
  });
}
