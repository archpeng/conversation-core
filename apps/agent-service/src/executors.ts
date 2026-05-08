import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GatedToolExecutor, GatedToolRequest } from "@pms-agent-v2/gated-tools";
import { createPmsPlatformClient } from "@pms-agent-v2/pms-platform-client";
import type { UnifiedAgentToolExecutors } from "@pms-agent-v2/unified-agent";

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

  return {
    pmsRead: async ({ request }) => {
      if (request.target === "availability" || request.target === undefined) {
        return client.searchAvailability({
          tenantId: tenantId(request),
          hotelId: config.defaultHotelId,
          checkInDate: request.checkInDate ?? config.defaultCheckInDate,
          checkOutDate: request.checkOutDate ?? config.defaultCheckOutDate,
          ...(request.quantity ? { quantity: request.quantity } : {}),
          ...(request.roomType ?? config.defaultRoomType ? { roomType: request.roomType ?? config.defaultRoomType } : {})
        });
      }
      return client.capabilitiesManifest({ tenantId: tenantId(request) });
    },
    pmsWorkflow: async ({ request }) => {
      const tenant = tenantId(request);
      const quantity = request.quantity ?? 1;
      if (quantity > 1) {
        const selections = requiredWorkflowSelections(request.selections, quantity);
        const sourceEvidenceRef = request.sourceEpisodeRefs?.[0];
        const groupDraft = await client.createReservationGroupDraft({
          tenantId: tenant,
          propertyId: config.defaultPropertyId,
          guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
          checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
          checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
          quantity,
          ...(request.roomType ? { roomType: request.roomType } : {}),
          ...(sourceEvidenceRef ? { sourceEvidenceRef } : {})
        });
        const groupDraftIdentifier = groupDraft.data.groupDraftRef ?? groupDraft.data.groupDraftId;
        await client.updateReservationGroupDraft({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required"),
          selections,
          ...(sourceEvidenceRef ? { sourceEvidenceRef } : {})
        });
        const quote = await client.quoteReservationGroupDraft({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required")
        });
        const prepared = await client.prepareReservationGroupConfirm({
          tenantId: tenant,
          groupDraftRef: requiredWorkflowText(groupDraftIdentifier, "pms_workflow_group_draft_required"),
          quoteRef: requiredWorkflowText(quote.data.quoteRef, "pms_workflow_quote_required")
        });
        await client.pendingActionStatus({
          tenantId: tenant,
          pendingActionRef: prepared.data.pendingActionRef ?? prepared.data.pendingActionId,
          ...(prepared.data.cardPayloadRef ? { cardPayloadRef: prepared.data.cardPayloadRef } : {})
        });
        return prepared;
      }

      const draft = request.draftId ? undefined : await client.createReservationDraft({
        tenantId: tenant,
        propertyId: config.defaultPropertyId,
        roomId: requiredWorkflowText(request.roomId, "pms_workflow_room_required"),
        guestName: requiredWorkflowText(request.guestName, "pms_workflow_guest_required"),
        checkInDate: requiredWorkflowText(request.checkInDate, "pms_workflow_check_in_required"),
        checkOutDate: requiredWorkflowText(request.checkOutDate, "pms_workflow_check_out_required"),
        ...(request.roomType ? { roomType: request.roomType } : {}),
        ...(request.sourceEpisodeRefs?.[0] ? { sourceEvidenceRef: request.sourceEpisodeRefs[0] } : {})
      });
      const draftIdentifier = request.draftId ?? draft?.data.draftRef ?? draft?.data.draftId;
      const selectedCandidateRef = request.sourceEpisodeRefs?.[0] ? `${request.sourceEpisodeRefs[0]}:${request.roomId}` : undefined;
      if (draft?.data.draftRef ?? draft?.data.draftId) {
        await client.updateReservationDraft({
          tenantId: tenant,
          draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required"),
          patch: {
            roomId: request.roomId,
            ...(selectedCandidateRef ? { selectedCandidateRef } : {})
          },
          ...(request.sourceEpisodeRefs?.[0] ? { sourceEvidenceRef: request.sourceEpisodeRefs[0] } : {})
        });
      }
      const quote = await client.quoteReservationDraft({
        tenantId: tenant,
        draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required")
      });

      const prepared = await client.prepareReservationConfirm({
        tenantId: tenant,
        draftRef: requiredWorkflowText(draftIdentifier, "pms_workflow_draft_required"),
        quoteRef: requiredWorkflowText(quote.data.quoteRef ?? quote.data.quoteId, "pms_workflow_quote_required")
      });
      await client.pendingActionStatus({
        tenantId: tenant,
        pendingActionRef: prepared.data.pendingActionId,
        ...(prepared.data.cardPayloadRef ? { cardPayloadRef: prepared.data.cardPayloadRef } : {})
      });
      return prepared;
    },
    pmsConfirm: async ({ request }) => client.pendingActionStatus({
      tenantId: tenantId(request),
      pendingActionId: request.pendingActionId ?? request.target ?? "missing-pending-action"
    }),
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

function requiredWorkflowSelections(value: GatedToolRequest["selections"], quantity: number): NonNullable<GatedToolRequest["selections"]> {
  if (!Array.isArray(value) || value.length < quantity) throw new Error("pms_workflow_group_selections_required");
  return value.slice(0, quantity);
}

function tenantId(request: GatedToolRequest): string {
  return request.tenantId ?? "default-tenant";
}

function requiredWorkflowText(value: string | undefined, message: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(message);
}
