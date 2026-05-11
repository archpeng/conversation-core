export type PmsEvidenceSource = {
  system: "pms-platform";
  method: PmsEvidenceMethod;
};

export type PmsEvidenceMethod =
  | "capabilitiesManifest"
  | "hotelProfile"
  | "roomTypeCatalog"
  | "searchAvailability"
  | "getRoom"
  | "getReservation"
  | "createReservationDraft"
  | "updateReservationDraft"
  | "quoteReservationDraft"
  | "prepareReservationConfirm"
  | "createReservationGroupDraft"
  | "updateReservationGroupDraft"
  | "quoteReservationGroupDraft"
  | "prepareReservationGroupConfirm"
  | "pendingActionStatus"
  | "confirmPendingAction"
  | "cancelPendingAction"
  | "inventorySummary"
  | "roomReservationContext"
  | "todayArrivals"
  | "todayDepartures"
  | "reservationLookup";

export type PmsEvidenceScope = {
  tenantId: string;
};

export type PmsEvidence<T> = {
  evidenceRef: string;
  fetchedAt: string;
  source: PmsEvidenceSource;
  scope: PmsEvidenceScope;
  summary: string;
  data: T;
};

export function createPmsEvidence<T>(input: {
  method: PmsEvidenceMethod;
  tenantId: string;
  fetchedAt: string;
  data: T;
  summary: string;
}): PmsEvidence<T> {
  return {
    evidenceRef: evidenceRef(input.method, input.tenantId, input.fetchedAt),
    fetchedAt: input.fetchedAt,
    source: { system: "pms-platform", method: input.method },
    scope: { tenantId: input.tenantId },
    summary: input.summary,
    data: input.data
  };
}

function evidenceRef(method: PmsEvidenceMethod, tenantId: string, fetchedAt: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `pms_ev_${safeTenant}_${method}_${Date.parse(fetchedAt)}`;
}
