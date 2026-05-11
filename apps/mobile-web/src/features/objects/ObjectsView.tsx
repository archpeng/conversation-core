import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductGatewayClient, defaultScope, type RoomObject } from "../../shared/api/client.js";
import { Badge } from "../../shared/components/ui/badge.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";
import { Input } from "../../shared/components/ui/input.js";

export function ObjectsView() {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const scope = useMemo(() => defaultScope(), []);
  const [roomId, setRoomId] = useState("room_1");
  const [room, setRoom] = useState<RoomObject>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function lookupRoom() {
    if (!roomId.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      setRoom(await client.getRoom(roomId.trim(), scope));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Objects</CardTitle>
        <CardText className="mb-3 mt-1">按房间读取 PMS read model。</CardText>
        <div className="flex gap-2">
          <Input value={roomId} onChange={(event) => setRoomId(event.target.value)} aria-label="Room id" />
          <Button onClick={lookupRoom} disabled={loading || !roomId.trim()} aria-label="Search room">
            <Search className="h-4 w-4" />
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
    </div>
  );
}
