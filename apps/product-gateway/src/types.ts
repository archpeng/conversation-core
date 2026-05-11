import type { AgentTask, ProductApiError } from "@pms-agent-v2/product-contracts";
import type { PmsPlatformClient } from "@pms-agent-v2/pms-platform-client";

export type ProductGatewayConfig = {
  host: string;
  port: number;
  maxInboundBodyBytes: number;
  productGatewayAuthToken?: string;
  pmsAgentBaseUrl: string;
  pmsAgentAuthToken?: string;
  pmsPlatformBaseUrl: string;
  pmsPlatformAuthToken?: string;
  defaultTenantId?: string;
  defaultPropertyId?: string;
  safetyAuditLogPath?: string;
  corsOrigin?: string;
};

export type ProductGatewayRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body?: unknown;
};

export type ProductGatewayResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type TaskLedger = {
  add(task: AgentTask): void;
  list(): AgentTask[];
  get(taskId: string): AgentTask | undefined;
};

export type ProductGatewayPmsClient = Pick<
  PmsPlatformClient,
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
  | "inventorySummary"
  | "roomReservationContext"
  | "todayArrivals"
  | "todayDepartures"
  | "executeTypedOperation"
  | "confirmPendingAction"
  | "cancelPendingAction"
>;

export type ProductRouteContext = {
  config: ProductGatewayConfig;
  tasks: TaskLedger;
};

export class ProductGatewayRouteError extends Error {
  readonly status: number;
  readonly body: ProductApiError;

  constructor(status: number, body: ProductApiError) {
    super(body.message);
    this.name = "ProductGatewayRouteError";
    this.status = status;
    this.body = body;
  }
}
