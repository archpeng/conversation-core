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

export async function handleReservationObjectRoute(context: ProductRouteContext, pmsClient: ProductGatewayPmsClient, request: ProductGatewayRequest, reservationTarget: string): Promise<ProductGatewayResponse> {
  const tenantId = request.query.get("tenantId") ?? context.config.defaultTenantId;
  if (!tenantId) return json(400, productError("invalid_request", "tenantId is required for reservation lookup."));

  try {
    const evidence = await pmsClient.getReservation({ tenantId, ...reservationLookupIdentifier(reservationTarget) });
    const fallbackLabel = evidence.data.reservationCode ?? evidence.data.reservationId;
    const label = [evidence.data.guestName, evidence.data.roomNumber ?? evidence.data.roomId].filter(Boolean).join(" · ") || fallbackLabel;
    return json(200, {
      ok: true,
      object: {
        ref: { kind: "reservation", id: evidence.data.reservationCode ?? evidence.data.reservationId, label, evidenceRefs: [evidence.evidenceRef] },
        status: evidence.data.status,
        ...(evidence.data.roomId ? { roomId: evidence.data.roomId } : {}),
        ...(evidence.data.roomNumber ? { roomNumber: evidence.data.roomNumber } : {}),
        ...(evidence.data.roomType ? { roomType: evidence.data.roomType } : {}),
        ...(evidence.data.guestName ? { guestName: evidence.data.guestName } : {}),
        ...(evidence.data.arrivalDate ? { arrivalDate: evidence.data.arrivalDate } : {}),
        ...(evidence.data.departureDate ? { departureDate: evidence.data.departureDate } : {}),
        evidenceRefs: [evidence.evidenceRef]
      }
    });
  } catch {
    return json(502, productError("backend_unavailable", "PMS Platform reservation read model is unavailable."));
  }
}

function json(status: number, body: unknown): ProductGatewayResponse {
  return { status, headers: { "content-type": "application/json" }, body };
}

function reservationLookupIdentifier(target: string): { reservationCode: string } | { reservationId: string } {
  const value = target.trim();
  if (/^R(?:G|ES)?-[A-Z0-9-]+$/i.test(value)) return { reservationCode: value };
  if (/^reservation[-_]/i.test(value) || /^res[-_]/i.test(value)) return { reservationId: value };
  return { reservationCode: value };
}
