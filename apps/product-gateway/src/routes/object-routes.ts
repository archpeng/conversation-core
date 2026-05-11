import { productError } from "@pms-agent-v2/product-contracts";
import type { ProductGatewayPmsClient, ProductGatewayRequest, ProductGatewayResponse, ProductRouteContext } from "../types.js";

export async function handleRoomObjectRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest, roomId: string): Promise<ProductGatewayResponse> {
  const tenantId = request.query.get("tenantId") ?? context.config.defaultTenantId;
  if (!tenantId) return json(400, productError("invalid_request", "tenantId is required for room lookup."));

  try {
    const [room, contextEvidence] = await Promise.all([
      pmsClient.getRoom({ tenantId, roomId }),
      pmsClient.roomReservationContext({ tenantId, roomId, dateContext: request.query.get("businessDate") ?? undefined })
    ]);
    return json(200, {
      ok: true,
      object: {
        ref: { kind: "room", id: room.data.roomId, label: room.data.roomId, evidenceRefs: [room.evidenceRef, contextEvidence.evidenceRef] },
        status: room.data.status,
        roomType: room.data.roomType,
        reservationRefs: contextEvidence.data.reservationRefs,
        blockRefs: contextEvidence.data.blockRefs,
        evidenceRefs: [room.evidenceRef, contextEvidence.evidenceRef]
      }
    });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform room read model is unavailable."));
  }
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}
