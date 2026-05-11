import { createPmsEvidence, type PmsEvidence, type PmsEvidenceMethod } from "./evidence.js";

export type HttpMethod = "GET" | "POST";

export type PmsRoute =
  | "/health"
  | "/v1/pms/capabilities/manifest"
  | "/v1/pms/hotel/profile"
  | "/v1/pms/room-types/catalog"
  | "/v1/pms/availability/search"
  | "/v1/pms/room"
  | "/v1/pms/reservations/get"
  | "/v1/pms/reservation-drafts/create"
  | "/v1/pms/reservation-drafts/update"
  | "/v1/pms/reservation-drafts/quote"
  | "/v1/pms/reservation-drafts/prepare-confirm"
  | "/v1/pms/reservation-group-drafts/create"
  | "/v1/pms/reservation-group-drafts/update"
  | "/v1/pms/reservation-group-drafts/quote"
  | "/v1/pms/reservation-group-drafts/prepare-confirm"
  | "/v1/pms/pending-actions/status"
  | "/v1/pms/pending-actions/confirm"
  | "/v1/pms/pending-actions/cancel"
  | "/v1/pms/check-in"
  | "/v1/pms/check-out"
  | "/v1/pms/housekeeping/done"
  | "/v1/pms/housekeeping/inspection"
  | "/v1/pms/housekeeping/rework"
  | "/v1/pms/maintenance/report"
  | "/v1/pms/maintenance/done"
  | "/v1/pms/maintenance/restore-sellable"
  | "/v1/pms/inventory/summary"
  | "/v1/pms/room/reservation-context"
  | "/v1/pms/reservations/today-arrivals"
  | "/v1/pms/reservations/today-departures";

export type RequestPlan = {
  method: HttpMethod;
  route: PmsRoute;
  body?: unknown;
};

export type PmsFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export type PmsFetch = (url: string, init: { method: HttpMethod; headers: Record<string, string>; body?: string }) => Promise<PmsFetchResponse>;

export type PmsPlatformClientOptions = {
  baseUrl: string;
  fetch: PmsFetch;
  now?: () => Date;
  authToken?: string;
};

export type ClientOptions = {
  baseUrl: string;
  fetch: PmsFetch;
  now: () => Date;
  authToken?: string;
};

export class PmsPlatformClientError extends Error {
  readonly operation: string;
  readonly status?: number;
  readonly causeCode: "transport_error" | "http_error" | "invalid_response" | "invalid_input";

  constructor(input: { operation: string; causeCode: PmsPlatformClientError["causeCode"]; status?: number; reason: string }) {
    super(`PMS ${input.operation} failed: ${input.reason}`);
    this.name = "PmsPlatformClientError";
    this.operation = input.operation;
    this.status = input.status;
    this.causeCode = input.causeCode;
  }
}

export type PmsPlatformApiError = {
  code: string;
  message: string;
  field?: string;
};

export type PmsWorkflowRejectedResult = {
  kind: "pms_workflow_rejected";
  origin: "pms-platform" | "pms-agent-v2";
  operation: string;
  status: string;
  mutationStatus: "none";
  errors: PmsPlatformApiError[];
  missingSlots?: string[];
  summary: string;
};

export class PmsPlatformRejectedError extends Error {
  readonly result: PmsWorkflowRejectedResult;

  constructor(result: PmsWorkflowRejectedResult) {
    super(result.summary);
    this.name = "PmsPlatformRejectedError";
    this.result = result;
  }
}

export function isPmsWorkflowRejectedResult(value: unknown): value is PmsWorkflowRejectedResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "pms_workflow_rejected"
    && (record.origin === "pms-platform" || record.origin === "pms-agent-v2")
    && typeof record.operation === "string"
    && typeof record.status === "string"
    && record.mutationStatus === "none"
    && Array.isArray(record.errors)
    && typeof record.summary === "string";
}

export function workflowRejectionSummary(errors: readonly PmsPlatformApiError[], missingSlots: readonly string[] = []): string {
  if (errors.some((error) => error.code === "RESERVATION_GROUP_DRAFT_MISSING_REQUIRED_SLOTS")) {
    const missing = missingSlots.length > 0 ? ` 缺失项：${missingSlots.join(", ")}。` : "";
    return `草稿缺少房间选择，无法报价。${missing}`;
  }
  if (errors.some((error) => error.code === "RESERVATION_ROOM_UNAVAILABLE")) {
    return "所选房间在入住区间已不可订，无法确认预订。";
  }
  return errors.map((error) => error.message).join("；") || "PMS workflow rejected the request.";
}

export function validateInput(operation: string, validate: () => void): void {
  try {
    validate();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid input";
    throw new PmsPlatformClientError({ operation, causeCode: "invalid_input", reason });
  }
}

export async function requestEvidence<T>(
  options: ClientOptions,
  operation: PmsEvidenceMethod,
  tenantId: string,
  request: RequestPlan,
  parse: (value: unknown) => T,
  summarize: (value: T) => string,
  requestOptions: { parseWorkflowRejection?: boolean } = {}
): Promise<PmsEvidence<T>> {
  const data = await requestOperational(options, request, operation, parse, requestOptions);
  return createPmsEvidence({
    method: operation,
    tenantId,
    fetchedAt: options.now().toISOString(),
    data,
    summary: summarize(data)
  });
}

export async function requestOperational<T>(
  options: ClientOptions,
  request: RequestPlan,
  operation: string,
  parse: (value: unknown) => T,
  requestOptions: { parseWorkflowRejection?: boolean } = {}
): Promise<T> {
  let response: PmsFetchResponse;
  try {
    response = await options.fetch(urlFor(options.baseUrl, request.route), {
      method: request.method,
      headers: headers(options.authToken, request.body),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) })
    });
  } catch {
    throw new PmsPlatformClientError({ operation, causeCode: "transport_error", reason: "transport unavailable" });
  }

  if (!response.ok) {
    throw new PmsPlatformClientError({ operation, causeCode: "http_error", status: response.status, reason: `platform returned HTTP ${response.status}` });
  }

  try {
    const payload = await response.json();
    if (requestOptions.parseWorkflowRejection !== false) {
      const rejected = parseWorkflowRejection(payload, operation);
      if (rejected) throw new PmsPlatformRejectedError(rejected);
    }
    return parse(payload);
  } catch (error) {
    if (error instanceof PmsPlatformRejectedError) throw error;
    const reason = error instanceof Error ? error.message : "invalid response";
    throw new PmsPlatformClientError({ operation, causeCode: "invalid_response", reason });
  }
}

function urlFor(baseUrl: string, route: PmsRoute): string {
  return `${baseUrl.replace(/\/$/, "")}${route}`;
}

function headers(authToken: string | undefined, body: unknown): Record<string, string> {
  return {
    accept: "application/json",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

function parseWorkflowRejection(value: unknown, fallbackOperation: string): PmsWorkflowRejectedResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.ok !== false) return undefined;
  const rawErrors = Array.isArray(record.errors) ? record.errors : [];
  const errors = rawErrors.map(parseApiError).filter((error): error is PmsPlatformApiError => Boolean(error));
  if (errors.length === 0) return undefined;
  const groupDraft = isRecord(record.groupDraft) ? record.groupDraft : undefined;
  const draft = isRecord(record.draft) ? record.draft : undefined;
  const missingSlots = parseStringArray(groupDraft?.missingSlots ?? draft?.missingSlots);
  return {
    kind: "pms_workflow_rejected",
    origin: "pms-platform",
    operation: typeof record.operation === "string" ? record.operation : fallbackOperation,
    status: typeof record.status === "string" ? record.status : "rejected",
    mutationStatus: "none",
    errors,
    ...(missingSlots.length > 0 ? { missingSlots } : {}),
    summary: workflowRejectionSummary(errors, missingSlots)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseApiError(value: unknown): PmsPlatformApiError | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.code !== "string" || typeof record.message !== "string") return undefined;
  return {
    code: record.code,
    message: record.message,
    ...(typeof record.field === "string" && record.field.trim() ? { field: record.field } : {})
  };
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
