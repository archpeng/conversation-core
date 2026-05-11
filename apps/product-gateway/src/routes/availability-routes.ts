import { productError } from "@pms-agent-v2/product-contracts";
import type { ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleAvailabilitySearchRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest): Promise<ProductGatewayResponse> {
  const scope = readAvailabilityScope(context, request);
  if (!scope.ok) return json(400, scope.error);

  try {
    const evidence = await pmsClient.searchAvailability({
      tenantId: scope.tenantId,
      hotelId: scope.propertyId,
      checkInDate: scope.checkInDate,
      checkOutDate: scope.checkOutDate,
      ...(scope.roomType ? { roomType: scope.roomType } : {}),
      ...(scope.quantity ? { quantity: scope.quantity } : {})
    });
    return json(200, {
      ok: true,
      object: {
        ref: {
          kind: "availability",
          id: `${scope.propertyId}:${scope.checkInDate}:${scope.checkOutDate}`,
          label: `${scope.checkInDate} - ${scope.checkOutDate}`,
          evidenceRefs: [evidence.evidenceRef]
        },
        checkInDate: scope.checkInDate,
        checkOutDate: scope.checkOutDate,
        rooms: evidence.data.rooms.map((room) => ({
          roomId: room.roomId,
          roomType: room.roomType,
          available: room.available,
          ...(room.roomNumber ? { roomNumber: room.roomNumber } : {})
        })),
        availableRoomTypes: evidence.data.availableRoomTypes,
        evidenceRefs: [evidence.evidenceRef]
      }
    });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform availability read model is unavailable."));
  }
}

function readAvailabilityScope(context: ProductRouteContext, request: ProductGatewayRequest) {
  const tenantId = request.query.get("tenantId") ?? context.config.defaultTenantId;
  const propertyId = request.query.get("propertyId") ?? context.config.defaultPropertyId;
  const checkInDate = request.query.get("checkInDate") ?? request.query.get("businessDate");
  const checkOutDate = request.query.get("checkOutDate");
  const roomType = request.query.get("roomType")?.trim();
  const quantity = parseQuantity(request.query.get("quantity"));
  if (!tenantId || !propertyId || !checkInDate || !checkOutDate) {
    return { ok: false as const, error: productError("invalid_request", "tenantId, propertyId, checkInDate, and checkOutDate are required for availability search.") };
  }
  if (request.query.get("quantity") && !quantity) {
    return { ok: false as const, error: productError("invalid_request", "quantity must be a positive integer.") };
  }
  return { ok: true as const, tenantId, propertyId, checkInDate, checkOutDate, roomType, quantity };
}

function parseQuantity(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
