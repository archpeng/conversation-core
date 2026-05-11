import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { AgentTask, MobileSession } from "@pms-agent-v2/product-contracts";
import { ProductGatewayClient, defaultScope, type PendingActionStatusReadback } from "../../shared/api/client.js";
import { Button } from "../../shared/components/ui/button.js";
import { Card, CardText, CardTitle } from "../../shared/components/ui/card.js";
import { Input } from "../../shared/components/ui/input.js";

type ReservationWorkflowViewProps = {
  session?: MobileSession;
  onTask: (task: AgentTask) => void;
};

export function ReservationWorkflowView({ session, onTask }: ReservationWorkflowViewProps) {
  const client = useMemo(() => new ProductGatewayClient(), []);
  const scope = useMemo(() => defaultScope(), []);
  const [mode, setMode] = useState<"single" | "group">("single");
  const [guestName, setGuestName] = useState("李女士");
  const [roomId, setRoomId] = useState("room_1");
  const [roomType, setRoomType] = useState("suite");
  const [quantity, setQuantity] = useState("2");
  const [checkInDate, setCheckInDate] = useState(scope.businessDate);
  const [checkOutDate, setCheckOutDate] = useState(nextDate(scope.businessDate));
  const [draftRef, setDraftRef] = useState("");
  const [quoteRef, setQuoteRef] = useState("");
  const [groupDraftRef, setGroupDraftRef] = useState("");
  const [groupQuoteRef, setGroupQuoteRef] = useState("");
  const [roomSelections, setRoomSelections] = useState("room_1,room_2");
  const [pendingAction, setPendingAction] = useState<{ pendingActionId: string; cardPayloadRef?: string }>();
  const [pendingStatus, setPendingStatus] = useState<PendingActionStatusReadback>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<AgentTask>, after?: (task: AgentTask) => void) {
    setLoading(true);
    setError(undefined);
    try {
      if (!session) throw new Error("Mobile session is not ready.");
      const task = await action();
      after?.(task);
      onTask(task);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reservation workflow failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPendingStatus() {
    if (!pendingAction) return;
    setLoading(true);
    setError(undefined);
    try {
      if (!session) throw new Error("Mobile session is not ready.");
      setPendingStatus(await client.getPendingActionStatus({
        tenantId: session.tenantId,
        pendingActionId: pendingAction.pendingActionId,
        ...(pendingAction.cardPayloadRef ? { cardPayloadRef: pendingAction.cardPayloadRef } : {})
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pending action status refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle>Reservation Workflow</CardTitle>
      <CardText className="mb-3 mt-1">Draft、quote 和 prepare-confirm 都停在 pending action。</CardText>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={mode === "single" ? "primary" : "secondary"} onClick={() => setMode("single")}>单房</Button>
        <Button variant={mode === "group" ? "primary" : "secondary"} onClick={() => setMode("group")}>团队</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={guestName} onChange={(event) => setGuestName(event.target.value)} aria-label="Reservation guest name" />
        <Input value={roomType} onChange={(event) => setRoomType(event.target.value)} aria-label="Reservation room type" />
        <Input value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} aria-label="Reservation check-in date" />
        <Input value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} aria-label="Reservation check-out date" />
        {mode === "single" ? (
          <Input className="col-span-2" value={roomId} onChange={(event) => setRoomId(event.target.value)} aria-label="Reservation room id" />
        ) : (
          <>
            <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Reservation quantity" />
            <Input value={roomSelections} onChange={(event) => setRoomSelections(event.target.value)} aria-label="Reservation room selections" />
          </>
        )}
      </div>
      {mode === "single" ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button disabled={loading} onClick={() => run(
            () => client.createSingleReservationDraft({ tenantId: session?.tenantId ?? scope.tenantId, propertyId: session?.propertyId ?? scope.propertyId, roomId, guestName, checkInDate, checkOutDate, roomType }),
            (task) => setDraftRef(suffix(task.id, "reservation_single_draft_"))
          )}>Draft</Button>
          <Button disabled={loading || !draftRef} onClick={() => run(
            () => client.quoteSingleReservationDraft(draftRef, { tenantId: session?.tenantId ?? scope.tenantId }),
            (task) => setQuoteRef(suffix(task.id, "reservation_single_quote_"))
          )}>Quote</Button>
          <Button disabled={loading || !draftRef || !quoteRef} onClick={() => run(
            () => client.prepareSingleReservationConfirm(draftRef, { tenantId: session?.tenantId ?? scope.tenantId, quoteRef }),
            (task) => rememberPendingAction(task, setPendingAction, setPendingStatus)
          )}>Prepare</Button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Button disabled={loading} onClick={() => run(
            () => client.createGroupReservationDraft({ tenantId: session?.tenantId ?? scope.tenantId, propertyId: session?.propertyId ?? scope.propertyId, guestName, checkInDate, checkOutDate, quantity: Number.parseInt(quantity, 10), roomType }),
            (task) => setGroupDraftRef(suffix(task.id, "reservation_group_draft_"))
          )}>Draft</Button>
          <Button disabled={loading || !groupDraftRef} onClick={() => run(
            () => client.updateGroupReservationDraft(groupDraftRef, { tenantId: session?.tenantId ?? scope.tenantId, selections: selections(roomSelections) })
          )}>Rooms</Button>
          <Button disabled={loading || !groupDraftRef} onClick={() => run(
            () => client.quoteGroupReservationDraft(groupDraftRef, { tenantId: session?.tenantId ?? scope.tenantId }),
            (task) => setGroupQuoteRef(suffix(task.id, "reservation_group_quote_"))
          )}>Quote</Button>
          <Button disabled={loading || !groupDraftRef || !groupQuoteRef} onClick={() => run(
            () => client.prepareGroupReservationConfirm(groupDraftRef, { tenantId: session?.tenantId ?? scope.tenantId, quoteRef: groupQuoteRef }),
            (task) => rememberPendingAction(task, setPendingAction, setPendingStatus)
          )}>Prepare</Button>
        </div>
      )}
      {pendingAction ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-neutral-50 px-3 py-2 text-sm">
          <div>
            <div className="font-medium text-ink">{pendingStatus?.status ?? "awaiting refresh"}</div>
            <div className="text-xs text-muted">{pendingAction.pendingActionId}</div>
          </div>
          <Button onClick={refreshPendingStatus} disabled={loading} aria-label="Refresh pending action status">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
    </Card>
  );
}

function rememberPendingAction(task: AgentTask, setPendingAction: (value: { pendingActionId: string; cardPayloadRef?: string }) => void, setPendingStatus: (value: PendingActionStatusReadback | undefined) => void) {
  const operationRef = task.actionCards?.find((card) => card.operationRef?.type === "pmsPendingAction")?.operationRef;
  if (operationRef?.type !== "pmsPendingAction") return;
  setPendingAction({ pendingActionId: operationRef.pendingActionId, cardPayloadRef: operationRef.cardPayloadRef });
  setPendingStatus(undefined);
}

function selections(input: string) {
  return input.split(",").map((item) => item.trim()).filter(Boolean).map((roomId) => ({
    roomId,
    selectedCandidateRef: `mobile:${roomId}`
  }));
}

function suffix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}
