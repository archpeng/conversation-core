import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { AvailabilityReadObject, ReservationReadObject, RoomReadObject } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient, defaultScope } from "../../shared/api/client.js";
import { Badge } from "../../shared/components/ui/badge.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";
import { Input } from "../../shared/components/ui/input.js";

type ObjectMode = "room" | "reservation" | "availability";

export function ObjectsView() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const scope = useMemo(() => defaultScope(), []);
  const [mode, setMode] = useState<ObjectMode>("room");
  const [roomId, setRoomId] = useState("room_1");
  const [reservationId, setReservationId] = useState("RES-001");
  const [checkInDate, setCheckInDate] = useState(scope.businessDate);
  const [checkOutDate, setCheckOutDate] = useState(nextDate(scope.businessDate));
  const [roomType, setRoomType] = useState("");
  const [room, setRoom] = useState<RoomReadObject>();
  const [reservation, setReservation] = useState<ReservationReadObject>();
  const [availability, setAvailability] = useState<AvailabilityReadObject>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    setError(undefined);
    try {
      setRoom(undefined);
      setReservation(undefined);
      setAvailability(undefined);
      if (mode === "room" && roomId.trim()) setRoom(await client.getRoom(roomId.trim(), scope));
      if (mode === "reservation" && reservationId.trim()) setReservation(await client.getReservation(reservationId.trim(), scope));
      if (mode === "availability") {
        setAvailability(await client.searchAvailability({
          ...scope,
          checkInDate,
          checkOutDate,
          ...(roomType.trim() ? { roomType: roomType.trim() } : {})
        }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Object lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Objects</CardTitle>
        <CardText className="mb-3 mt-1">按对象读取 PMS read model。</CardText>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(["room", "reservation", "availability"] as const).map((item) => (
            <Button key={item} variant={mode === item ? "primary" : "secondary"} onClick={() => setMode(item)}>
              {labelForMode(item)}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          {mode === "room" ? <Input value={roomId} onChange={(event) => setRoomId(event.target.value)} aria-label="Room id" /> : null}
          {mode === "reservation" ? <Input value={reservationId} onChange={(event) => setReservationId(event.target.value)} aria-label="Reservation id" /> : null}
          {mode === "availability" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} aria-label="Check-in date" />
              <Input value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} aria-label="Check-out date" />
              <Input className="col-span-2" value={roomType} onChange={(event) => setRoomType(event.target.value)} placeholder="房型，可选" aria-label="Room type" />
            </div>
          ) : null}
          <Button className="w-full" onClick={lookup} disabled={loading || !canLookup(mode, roomId, reservationId, checkInDate, checkOutDate)} aria-label="Search object">
            <Search className="h-4 w-4" />
            查询
          </Button>
        </div>
      </Card>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {room ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <CardTitle>{room.ref.label ?? room.ref.id}</CardTitle>
            <Badge>{room.status}</Badge>
          </div>
          <CardText>房型：{room.roomType}</CardText>
          <CardText>关联预订：{room.reservationRefs.length}</CardText>
          <CardText>锁房：{room.blockRefs.length}</CardText>
          <div className="mt-3 text-xs text-muted">Evidence {room.evidenceRefs.length}</div>
        </Card>
      ) : null}
      {reservation ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <CardTitle>{reservation.ref.label ?? reservation.ref.id}</CardTitle>
            <Badge>{reservation.status}</Badge>
          </div>
          <CardText>房间：{reservation.roomId ?? "未分配"}</CardText>
          <div className="mt-3 text-xs text-muted">Evidence {reservation.evidenceRefs.length}</div>
        </Card>
      ) : null}
      {availability ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <CardTitle>可用房</CardTitle>
            <Badge>{availability.rooms.length} 间</Badge>
          </div>
          <CardText>{availability.checkInDate} 至 {availability.checkOutDate}</CardText>
          <div className="mt-3 space-y-2">
            {availability.availableRoomTypes?.map((item) => (
              <div key={item.roomType} className="rounded-md border border-border bg-neutral-50 px-3 py-2 text-sm text-ink">
                {item.roomType}: {item.count} 间
              </div>
            ))}
            {availability.rooms.slice(0, 5).map((item) => (
              <div key={item.roomId} className="rounded-md border border-border bg-neutral-50 px-3 py-2 text-sm text-muted">
                {item.roomNumber ?? item.roomId} · {item.roomType}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted">Evidence {availability.evidenceRefs.length}</div>
        </Card>
      ) : null}
    </div>
  );
}

function labelForMode(mode: ObjectMode): string {
  if (mode === "room") return "房间";
  if (mode === "reservation") return "预订";
  return "可用房";
}

function canLookup(mode: ObjectMode, roomId: string, reservationId: string, checkInDate: string, checkOutDate: string): boolean {
  if (mode === "room") return Boolean(roomId.trim());
  if (mode === "reservation") return Boolean(reservationId.trim());
  return Boolean(checkInDate.trim() && checkOutDate.trim());
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}
