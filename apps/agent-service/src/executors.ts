import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GatedToolExecutor, GatedToolRequest } from "@pms-agent-v2/gated-tools";
import { createPmsPlatformClient } from "@pms-agent-v2/pms-platform-client";
import type {
  PmsReadExecutorMap,
  PmsWorkflowExecutorMap,
  UnifiedAgentToolExecutors
} from "@pms-agent-v2/unified-agent";

export type RuntimeExecutorConfig = {
  pmsPlatformBaseUrl: string;
  pmsPlatformAuthToken?: string;
  defaultHotelId: string;
  defaultCheckInDate: string;
  defaultCheckOutDate: string;
  defaultRoomType?: string;
  defaultPropertyId: string;
  defaultGuestName: string;
  defaultRoomId: string;
  proposalWorkspacePath: string;
};

export function createRuntimeExecutors(config: RuntimeExecutorConfig): UnifiedAgentToolExecutors {
  const client = createPmsPlatformClient({
    baseUrl: config.pmsPlatformBaseUrl,
    authToken: config.pmsPlatformAuthToken,
    fetch
  });

  const pmsReadExecutors: PmsReadExecutorMap = {
    pms_availability_search: async ({ request }) =>
      client.searchAvailability({
        tenantId: tenantId(request),
        hotelId: config.defaultHotelId,
        checkInDate: request.checkInDate ?? config.defaultCheckInDate,
        checkOutDate: request.checkOutDate ?? config.defaultCheckOutDate,
        ...(request.quantity ? { quantity: request.quantity } : {}),
        ...(request.roomType ?? config.defaultRoomType
          ? { roomType: request.roomType ?? config.defaultRoomType }
          : {})
      }),

    pms_inventory_summary: async ({ request }) =>
      client.inventorySummary({
        tenantId: tenantId(request),
        propertyId: config.defaultPropertyId,
        startDate: request.startDate ?? request.checkInDate ?? config.defaultCheckInDate,
        endDate: request.endDate ?? request.checkOutDate ?? config.defaultCheckOutDate
      }),

    pms_room_reservation_context: async ({ request }) =>
      client.roomReservationContext({
        tenantId: tenantId(request),
        roomId: requiredWorkflowText(request.roomId, "roomId required for reservation context"),
        ...(request.dateContext ? { dateContext: request.dateContext } : {})
      }),

    pms_reservation_lookup: async ({ request }) =>
      client.reservationLookup({
        tenantId: tenantId(request),
        reservationCode: requiredWorkflowText(request.reservationCode ?? request.target, "reservationCode required for reservation lookup")
      }),

    pms_get_room: async ({ request }) =>
      client.getRoom({
        tenantId: tenantId(request),
        roomId: requiredWorkflowText(request.roomId ?? request.target, "roomId required for get room")
      }),

    pms_today_arrivals: async ({ request }) =>
      client.todayArrivals({
        tenantId: tenantId(request),
        businessDate: request.businessDate ?? request.checkInDate ?? config.defaultCheckInDate
      }),

    pms_today_departures: async ({ request }) =>
      client.todayDepartures({
        tenantId: tenantId(request),
        businessDate: request.businessDate ?? request.checkInDate ?? config.defaultCheckInDate
      }),

    pms_pending_action_status: async ({ request }) =>
      client.pendingActionStatus({
        tenantId: tenantId(request),
        pendingActionRef: request.pendingActionRef ?? request.pendingActionId ?? request.target ?? "missing-pending-action",
        ...(request.cardPayloadRef ? { cardPayloadRef: request.cardPayloadRef } : {})
      })
  };

  const pmsWorkflowExecutors: PmsWorkflowExecutorMap = {
    pms_reservation_draft_create: async ({ request }) =>
      client.createReservationDraft({
        tenantId: tenantId(request),
        propertyId: config.defaultPropertyId,
        roomId: requiredWorkflowText(request.roomId, "pms_workflow_room_required"),
        guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
        checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
        checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
        ...(request.roomType ? { roomType: request.roomType } : {}),
        ...(request.sourceEvidenceRef ? { sourceEvidenceRef: request.sourceEvidenceRef } : {})
      }),

    pms_reservation_draft_update: async ({ request }) =>
      client.updateReservationDraft({
        tenantId: tenantId(request),
        ...draftIdentifier(request),
        patch: draftPatch(request),
        ...(request.sourceEvidenceRef ? { sourceEvidenceRef: request.sourceEvidenceRef } : {})
      }),

    pms_reservation_quote: async ({ request }) =>
      client.quoteReservationDraft({
        tenantId: tenantId(request),
        ...draftIdentifier(request)
      }),

    pms_reservation_prepare_confirm: async ({ request }) =>
      client.prepareReservationConfirm({
        tenantId: tenantId(request),
        ...draftIdentifier(request),
        quoteRef: requiredWorkflowText(request.quoteRef ?? request.quoteId, "pms_workflow_quote_required")
      }),

    pms_reservation_group_draft_create: async ({ request }) =>
      client.createReservationGroupDraft({
        tenantId: tenantId(request),
        propertyId: config.defaultPropertyId,
        guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
        checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
        checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
        quantity: requiredPositiveInteger(request.quantity, "pms_workflow_quantity_required"),
        ...(request.roomType ? { roomType: request.roomType } : {}),
        ...(request.sourceEvidenceRef ? { sourceEvidenceRef: request.sourceEvidenceRef } : {})
      }),

    pms_reservation_group_draft_update: async ({ request }) =>
      client.updateReservationGroupDraft({
        tenantId: tenantId(request),
        ...groupDraftIdentifier(request),
        selections: requiredWorkflowSelections(request.selections),
        ...(request.sourceEvidenceRef ? { sourceEvidenceRef: request.sourceEvidenceRef } : {})
      }),

    pms_reservation_group_quote: async ({ request }) =>
      client.quoteReservationGroupDraft({
        tenantId: tenantId(request),
        ...groupDraftIdentifier(request)
      }),

    pms_reservation_group_prepare_confirm: async ({ request }) =>
      client.prepareReservationGroupConfirm({
        tenantId: tenantId(request),
        ...groupDraftIdentifier(request),
        quoteRef: requiredWorkflowText(request.quoteRef ?? request.quoteId, "pms_workflow_quote_required")
      })
  };

  return {
    pmsReadExecutors,
    pmsWorkflowExecutors,
    proposalRead: proposalReadExecutor(config),
    proposalWrite: proposalWriteExecutor(config),
    proposalEdit: proposalWriteExecutor(config)
  };
}

function proposalReadExecutor(config: RuntimeExecutorConfig): GatedToolExecutor<unknown> {
  return ({ request }) => {
    const path = safeProposalPath(config.proposalWorkspacePath, request.target);
    return { path, content: readFileSync(path, "utf8") };
  };
}

function proposalWriteExecutor(config: RuntimeExecutorConfig): GatedToolExecutor<unknown> {
  return ({ request }) => {
    const path = safeProposalPath(config.proposalWorkspacePath, request.target);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, request.content ?? "", "utf8");
    return { path };
  };
}

function safeProposalPath(root: string, target: string | undefined): string {
  const relative = (target || "proposal.md").replace(/^\/+/, "");
  const path = resolve(root, relative);
  const normalizedRoot = resolve(root);
  if (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}/`)) {
    throw new Error("proposal path escapes workspace");
  }
  return path;
}

function requiredWorkflowSelections(value: GatedToolRequest["selections"]): NonNullable<GatedToolRequest["selections"]> {
  if (!Array.isArray(value) || value.length < 1) throw new Error("pms_workflow_group_selections_required");
  return value;
}

function tenantId(request: GatedToolRequest): string {
  return request.tenantId ?? "default-tenant";
}

function draftIdentifier(request: GatedToolRequest): { draftId: string } | { draftRef: string } {
  if (request.draftId) return { draftId: request.draftId };
  return { draftRef: requiredWorkflowText(request.draftRef, "pms_workflow_draft_required") };
}

function groupDraftIdentifier(request: GatedToolRequest): { groupDraftId: string } | { groupDraftRef: string } {
  if (request.groupDraftId) return { groupDraftId: request.groupDraftId };
  return { groupDraftRef: requiredWorkflowText(request.groupDraftRef, "pms_workflow_group_draft_required") };
}

function draftPatch(request: GatedToolRequest): Record<string, unknown> {
  return {
    ...(request.roomId ? { roomId: request.roomId } : {}),
    ...(request.selectedCandidateRef ? { selectedCandidateRef: request.selectedCandidateRef } : {}),
    ...(request.roomType ? { roomType: request.roomType } : {})
  };
}

function requiredPositiveInteger(value: number | undefined, message: string): number {
  if (Number.isInteger(value) && value !== undefined && value > 0) return value;
  throw new Error(message);
}

function requiredWorkflowText(value: string | undefined, message: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(message);
}
