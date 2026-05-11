import {
  productError,
  validateActionCardExecutionResponse,
  validateAvailabilityObjectResponse,
  validateMobileAgentResponse,
  validateProductApiError,
  validateReservationObjectResponse,
  validateReservationWorkflowResponse,
  validateRoomObjectResponse,
  validateMobileSessionResponse,
  validateReviewActionDetailResponse,
  validateReviewActionListResponse,
  validateTaskListResponse,
  type ActionCardExecutionInput,
  type AgentTask,
  type AvailabilityReadObject,
  type MobileAgentResponse,
  type MobileSession,
  type MobileAgentTurnInput,
  type ProductApiError,
  type ReservationGroupDraftInput,
  type ReservationGroupUpdateInput,
  type ReservationReadObject,
  type ReservationSingleDraftInput,
  type ReservationDraftUpdateInput,
  type ReservationWorkflowRefInput,
  type ReviewActionDetail,
  type ReviewActionSummary,
  type RoomReadObject,
  type TaskListResponse
} from "@pms-agent-v2/product-contracts";

export type GatewayScope = {
  tenantId: string;
  propertyId: string;
  businessDate: string;
};

export type ShiftSummary = {
  totalTasks: number;
  readOnly: number;
  committed: number;
  failed: number;
  latestTaskAt?: string;
  pmsAuditRefs?: {
    total: number;
    latest?: string;
  };
  safetyAudits?: {
    total: number;
    allow: number;
    deny: number;
    requireApproval: number;
    latestAt?: string;
  };
};

export class ProductGatewayClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(baseUrl = import.meta.env.VITE_PRODUCT_GATEWAY_BASE_URL ?? "http://127.0.0.1:8793", token = import.meta.env.VITE_PRODUCT_GATEWAY_TOKEN) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token?.trim() || undefined;
  }

  async sendTurn(input: MobileAgentTurnInput): Promise<MobileAgentResponse> {
    const payload = await this.request("/api/mobile/turn", { method: "POST", body: input });
    const result = validateMobileAgentResponse(payload);
    if (!result.ok) throw new Error(`Invalid gateway response: ${result.issues.join("; ")}`);
    return result.value;
  }

  async listTasks(scope: GatewayScope): Promise<TaskListResponse> {
    const query = new URLSearchParams(scope);
    const payload = await this.request(`/api/tasks?${query.toString()}`, { method: "GET" });
    const result = validateTaskListResponse(payload);
    if (!result.ok) throw new Error(`Invalid task response: ${result.issues.join("; ")}`);
    return result.value;
  }

  async getRoom(roomId: string, scope: Pick<GatewayScope, "tenantId" | "businessDate">): Promise<RoomReadObject> {
    const query = new URLSearchParams(scope);
    const payload = await this.request(`/api/objects/rooms/${encodeURIComponent(roomId)}?${query.toString()}`, { method: "GET" });
    const result = validateRoomObjectResponse(payload);
    if (!result.ok) throw new Error(`Invalid room object response: ${result.issues.join("; ")}`);
    return result.value.object;
  }

  async getReservation(reservationId: string, scope: Pick<GatewayScope, "tenantId">): Promise<ReservationReadObject> {
    const query = new URLSearchParams(scope);
    const payload = await this.request(`/api/objects/reservations/${encodeURIComponent(reservationId)}?${query.toString()}`, { method: "GET" });
    const result = validateReservationObjectResponse(payload);
    if (!result.ok) throw new Error(`Invalid reservation object response: ${result.issues.join("; ")}`);
    return result.value.object;
  }

  async searchAvailability(input: GatewayScope & { checkInDate: string; checkOutDate: string; roomType?: string; quantity?: number }): Promise<AvailabilityReadObject> {
    const query = new URLSearchParams({
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      businessDate: input.businessDate,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      ...(input.roomType ? { roomType: input.roomType } : {}),
      ...(input.quantity ? { quantity: String(input.quantity) } : {})
    });
    const payload = await this.request(`/api/availability/search?${query.toString()}`, { method: "GET" });
    const result = validateAvailabilityObjectResponse(payload);
    if (!result.ok) throw new Error(`Invalid availability response: ${result.issues.join("; ")}`);
    return result.value.object;
  }

  async getShiftSummary(): Promise<ShiftSummary> {
    const payload = await this.request("/api/review/shift-summary", { method: "GET" });
    const summary = parseShiftSummary(payload);
    if (!summary) throw new Error("Invalid review summary response.");
    return summary;
  }

  async getSession(): Promise<MobileSession> {
    const payload = await this.request("/api/session/current", { method: "GET" });
    const result = validateMobileSessionResponse(payload);
    if (!result.ok) throw new Error(`Invalid session response: ${result.issues.join("; ")}`);
    return result.value.session;
  }

  async createSingleReservationDraft(input: ReservationSingleDraftInput): Promise<AgentTask> {
    return this.workflowTask("/api/reservation-workflows/single/drafts", "POST", input);
  }

  async updateSingleReservationDraft(draftRef: string, input: Omit<ReservationDraftUpdateInput, "draftRef">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/single/drafts/${encodeURIComponent(draftRef)}`, "PATCH", input);
  }

  async quoteSingleReservationDraft(draftRef: string, input: Pick<ReservationWorkflowRefInput, "tenantId">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/single/drafts/${encodeURIComponent(draftRef)}/quote`, "POST", input);
  }

  async prepareSingleReservationConfirm(draftRef: string, input: Pick<ReservationWorkflowRefInput, "tenantId" | "quoteRef">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/single/drafts/${encodeURIComponent(draftRef)}/prepare-confirm`, "POST", input);
  }

  async createGroupReservationDraft(input: ReservationGroupDraftInput): Promise<AgentTask> {
    return this.workflowTask("/api/reservation-workflows/group/drafts", "POST", input);
  }

  async updateGroupReservationDraft(groupDraftRef: string, input: Omit<ReservationGroupUpdateInput, "groupDraftRef">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/group/drafts/${encodeURIComponent(groupDraftRef)}`, "PATCH", input);
  }

  async quoteGroupReservationDraft(groupDraftRef: string, input: Pick<ReservationWorkflowRefInput, "tenantId">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/group/drafts/${encodeURIComponent(groupDraftRef)}/quote`, "POST", input);
  }

  async prepareGroupReservationConfirm(groupDraftRef: string, input: Pick<ReservationWorkflowRefInput, "tenantId" | "quoteRef">): Promise<AgentTask> {
    return this.workflowTask(`/api/reservation-workflows/group/drafts/${encodeURIComponent(groupDraftRef)}/prepare-confirm`, "POST", input);
  }

  async listReviewActions(status?: string): Promise<ReviewActionSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const payload = await this.request(`/api/review/actions${query}`, { method: "GET" });
    const result = validateReviewActionListResponse(payload);
    if (!result.ok) throw new Error(`Invalid review actions response: ${result.issues.join("; ")}`);
    return result.value.actions;
  }

  async getReviewAction(taskId: string): Promise<ReviewActionDetail> {
    const payload = await this.request(`/api/review/actions/${encodeURIComponent(taskId)}`, { method: "GET" });
    const result = validateReviewActionDetailResponse(payload);
    if (!result.ok) throw new Error(`Invalid review action response: ${result.issues.join("; ")}`);
    return result.value.action;
  }

  async executeAction(taskId: string, cardId: string, actionId: string, input: ActionCardExecutionInput): Promise<MobileAgentResponse> {
    const payload = await this.request(`/api/tasks/${encodeURIComponent(taskId)}/action-cards/${encodeURIComponent(cardId)}/actions/${encodeURIComponent(actionId)}`, { method: "POST", body: input });
    const result = validateActionCardExecutionResponse(payload);
    if (!result.ok) throw new Error(`Invalid action response: ${result.issues.join("; ")}`);
    return result.value;
  }

  private async workflowTask(path: string, method: "POST" | "PATCH", body: unknown): Promise<AgentTask> {
    const payload = await this.request(path, { method, body });
    const result = validateReservationWorkflowResponse(payload);
    if (!result.ok) throw new Error(`Invalid reservation workflow response: ${result.issues.join("; ")}`);
    return result.value.task;
  }

  private async request(path: string, init: { method: "GET" | "POST" | "PATCH"; body?: unknown }): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    });
    const payload = await response.json();
    if (!response.ok) throw productGatewayError(payload);
    return payload;
  }
}

export function defaultScope(now = new Date()): GatewayScope {
  return {
    tenantId: import.meta.env.VITE_PMS_TENANT_ID ?? "tenant_1",
    propertyId: import.meta.env.VITE_PMS_PROPERTY_ID ?? "property_small_hotel",
    businessDate: now.toISOString().slice(0, 10)
  };
}

export function mergeTask(existing: readonly AgentTask[], task: AgentTask): AgentTask[] {
  const without = existing.filter((item) => item.id !== task.id);
  return [task, ...without].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function productGatewayError(payload: unknown): Error {
  const error = validateProductApiError(payload);
  const fallback: ProductApiError = productError("backend_unavailable", "Product gateway request failed.");
  const body = error.ok ? error.value : fallback;
  return new Error(body.message);
}

function parseShiftSummary(payload: unknown): ShiftSummary | undefined {
  const record = asRecord(payload);
  const summary = asRecord(record?.summary);
  if (!record || record.ok !== true || !summary) return undefined;
  if (typeof summary.totalTasks !== "number" || typeof summary.readOnly !== "number" || typeof summary.committed !== "number" || typeof summary.failed !== "number") return undefined;
  return {
    totalTasks: summary.totalTasks,
    readOnly: summary.readOnly,
    committed: summary.committed,
    failed: summary.failed,
    ...(typeof summary.latestTaskAt === "string" ? { latestTaskAt: summary.latestTaskAt } : {}),
    ...parsePmsAuditRefs(summary.pmsAuditRefs),
    ...parseSafetyAudits(summary.safetyAudits)
  };
}

function parsePmsAuditRefs(value: unknown): Pick<ShiftSummary, "pmsAuditRefs"> {
  const record = asRecord(value);
  if (!record || typeof record.total !== "number") return {};
  return {
    pmsAuditRefs: {
      total: record.total,
      ...(typeof record.latest === "string" ? { latest: record.latest } : {})
    }
  };
}

function parseSafetyAudits(value: unknown): Pick<ShiftSummary, "safetyAudits"> {
  const record = asRecord(value);
  if (!record || typeof record.total !== "number" || typeof record.allow !== "number" || typeof record.deny !== "number" || typeof record.requireApproval !== "number") return {};
  return {
    safetyAudits: {
      total: record.total,
      allow: record.allow,
      deny: record.deny,
      requireApproval: record.requireApproval,
      ...(typeof record.latestAt === "string" ? { latestAt: record.latestAt } : {})
    }
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
