import { describe, expect, it } from "vitest";
import { createPmsPlatformClient } from "../packages/pms-platform-client/src/index.js";
import type { FetchCall } from "./pms-platform-client.helpers.js";

describe("PMS Platform client reservation workflows", () => {
  it("accepts current pms-platform local reservation workflow envelopes", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        if (url.endsWith("/v1/pms/reservation-drafts/create")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.create", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) };
        }
        if (url.endsWith("/v1/pms/reservation-drafts/quote")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.quote", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], quote: { quoteRef: "quote-ref-1", status: "pricingUnsupported" } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-drafts/prepare-confirm")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.prepare_confirm", mutationStatus: "none", draft: { draftRef: "draft_ref_1", status: "awaitingConfirmation", missingSlots: [], evidenceRefs: [], pendingAction: { pendingActionRef: "pending-action-ref-1", cardPayloadRef: "card-payload-ref-1", quoteRef: "quote-ref-1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation" } } }) };
        }
        throw new Error(`unexpected route ${url}`);
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const draft = await client.createReservationDraft({ tenantId: "tenant_1", propertyId: "property-small-hotel", roomId: "room-A1", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", sourceEvidenceRef: "pms_ev_1" });
    const quote = await client.quoteReservationDraft({ tenantId: "tenant_1", draftRef: draft.data.draftRef });
    const prepared = await client.prepareReservationConfirm({ tenantId: "tenant_1", draftRef: draft.data.draftRef, quoteRef: quote.data.quoteRef });

    expect(draft.data).toEqual({ draftRef: "draft_ref_1", status: "collectingSlots" });
    expect(quote.data).toEqual({ quoteRef: "quote-ref-1", status: "pricingUnsupported" });
    expect(prepared.data).toMatchObject({ pendingActionId: "pending-action-ref-1", cardPayloadRef: "card-payload-ref-1", quoteRef: "quote-ref-1", confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.draft.create",
      propertyId: "property-small-hotel",
      actor: { type: "ai", id: "pms-agent-v2" },
      source: "api",
      slots: { roomId: "room-A1", guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", selectedCandidateRef: "pms_ev_1:room-A1" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
    expect(calls[1].body).toMatchObject({ operation: "pms.reservation.quote", draftRef: "draft_ref_1" });
    expect(calls[2].body).toMatchObject({ operation: "pms.reservation.prepare_confirm", draftRef: "draft_ref_1", quoteRef: "quote-ref-1" });
  });

  it("maps draft update patches to current pms-platform slot update envelopes", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.draft.update", mutationStatus: "draftOnly", draft: { draftRef: "draft_ref_1", status: "collectingSlots", missingSlots: [], evidenceRefs: [] } }) };
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const updated = await client.updateReservationDraft({
      tenantId: "tenant_1",
      draftRef: "draft_ref_1",
      patch: { roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" },
      sourceEvidenceRef: "pms_ev_1"
    });

    expect(updated.data).toEqual({ draftRef: "draft_ref_1", status: "collectingSlots" });
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.draft.update",
      draftRef: "draft_ref_1",
      slots: { roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
  });

  it("accepts current pms-platform local reservation group workflow envelopes", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        if (url.endsWith("/v1/pms/reservation-group-drafts/create")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.create", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "collectingSlots", missingSlots: ["roomSelections"], evidenceRefs: [] } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/update")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_draft.update", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", missingSlots: [], evidenceRefs: [], slots: { selections: [{ roomId: "room-A1" }, { roomId: "room-A2" }] } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/quote")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_quote", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "quoteReady", quote: { quoteRef: "group_quote_ref_1", status: "pricingUnsupported" } } }) };
        }
        if (url.endsWith("/v1/pms/reservation-group-drafts/prepare-confirm")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, operation: "pms.reservation.group_prepare_confirm", mutationStatus: "draftOnly", groupDraft: { groupDraftRef: "group_draft_ref_1", status: "awaitingConfirmation", pendingAction: { pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", confirmationMode: "typedCardOnly", mutationStatus: "none", status: "awaitingConfirmation", selectionCount: 2 } } }) };
        }
        throw new Error(`unexpected route ${url}`);
      },
      now: () => new Date("2026-05-06T12:00:00.000Z")
    });

    const draft = await client.createReservationGroupDraft({ tenantId: "tenant_1", propertyId: "property-small-hotel", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, roomType: "suite", sourceEvidenceRef: "pms_ev_1" });
    const updated = await client.updateReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef, selections: [{ roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1", roomType: "suite" }, { roomId: "room-A2", selectedCandidateRef: "pms_ev_1:room-A2", roomType: "suite" }], sourceEvidenceRef: "pms_ev_1" });
    const quote = await client.quoteReservationGroupDraft({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef });
    const prepared = await client.prepareReservationGroupConfirm({ tenantId: "tenant_1", groupDraftRef: draft.data.groupDraftRef, quoteRef: quote.data.quoteRef });

    expect(draft.data).toEqual({ groupDraftRef: "group_draft_ref_1", status: "collectingSlots" });
    expect(updated.data).toEqual({ groupDraftRef: "group_draft_ref_1", status: "quoteReady" });
    expect(quote.data).toEqual({ quoteRef: "group_quote_ref_1", status: "pricingUnsupported" });
    expect(prepared.data).toMatchObject({ pendingActionId: "pending_group_1", pendingActionRef: "pending_group_1", cardPayloadRef: "card_group_1", quoteRef: "group_quote_ref_1", selectionCount: 2, confirmationMode: "typedCardOnly", mutationStatus: "none" });
    expect(calls.map((call) => call.url)).toEqual([
      "https://pms.local/v1/pms/reservation-group-drafts/create",
      "https://pms.local/v1/pms/reservation-group-drafts/update",
      "https://pms.local/v1/pms/reservation-group-drafts/quote",
      "https://pms.local/v1/pms/reservation-group-drafts/prepare-confirm"
    ]);
    expect(calls[0].body).toMatchObject({
      operation: "pms.reservation.group_draft.create",
      slots: { guestDisplayName: "王晓", arrivalDate: "2026-05-09", departureDate: "2026-05-10", quantity: 2, roomTypeKeyword: "suite" },
      evidenceRefs: [{ source: "availabilitySearch", refId: "pms_ev_1" }]
    });
    expect(calls[1].body).toMatchObject({
      operation: "pms.reservation.group_draft.update",
      groupDraftRef: "group_draft_ref_1",
      slots: { selections: [{ roomId: "room-A1", selectedCandidateRef: "pms_ev_1:room-A1" }, { roomId: "room-A2", selectedCandidateRef: "pms_ev_1:room-A2" }] }
    });
    expect(calls[2].body).toMatchObject({ operation: "pms.reservation.group_quote", groupDraftRef: "group_draft_ref_1" });
    expect(calls[3].body).toMatchObject({ operation: "pms.reservation.group_prepare_confirm", groupDraftRef: "group_draft_ref_1", quoteRef: "group_quote_ref_1" });
  });
});
