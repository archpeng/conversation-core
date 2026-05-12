import {
  gatedPmsSafeRead,
  type GatedToolExecutor,
  type GatedToolRequest,
  type SafetyGatewayPort,
} from "@pms-agent-v2/gated-tools";
import type { GatedToolDefinition, AgentToolResult } from "./pi-session.js";
import type { TSchema } from "typebox";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { UnifiedAgentToolExecutors } from "./tool-registration.js";
import { notConfiguredExecutor } from "./not-configured-executor.js";
import { publicToolResult } from "./pms-public-tool-result.js";

export const PMS_SAFE_READ_TOOLS = [
  "pms_hotel_profile",
  "pms_room_type_catalog",
  "pms_availability_search",
  "pms_inventory_summary",
  "pms_room_reservation_context",
  "pms_reservation_lookup",
  "pms_get_room",
  "pms_today_arrivals",
  "pms_today_departures",
  "pms_pending_action_status",
] as const;

export type PmsSafeReadToolName = (typeof PMS_SAFE_READ_TOOLS)[number];

export type PmsCapabilityPlannerProjectionItem = {
  readonly name: PmsSafeReadToolName;
  readonly customerChatAllowed: boolean;
  readonly naturalLanguageExecutable: boolean;
  readonly confirmationRequired: boolean;
  readonly capabilityClass: "safe_read" | "workflow" | "confirm" | "internal";
};

const PMS_SAFE_READ_PROJECTION: readonly PmsCapabilityPlannerProjectionItem[] =
  PMS_SAFE_READ_TOOLS.map((name) => ({
    name,
    customerChatAllowed: true,
    naturalLanguageExecutable: true,
    confirmationRequired: false,
    capabilityClass: name === "pms_pending_action_status" ? "internal" : "safe_read",
  }));

const PmsToolDescriptions: Record<PmsSafeReadToolName, string> = {
  pms_hotel_profile:
    "Read static hotel profile facts from PMS Platform: property ID, hotel name, timezone, status, total room count, and configured room type summary. Use for hotel profile or total configured room inventory questions. Availability, prices, reservations, and status still require their specific PMS tools.",

  pms_room_type_catalog:
    "Read the PMS-configured active room type catalog without dates: room type IDs, codes, display names, room counts, and status. Use when the user asks what room types the hotel has. Use pms_availability_search only when the question asks which room types are bookable for a date range.",

  pms_availability_search:
    "Search full-stay available room candidates for the requested date range. A returned room is available for every requested night. This is not the hotel room type catalog. Use pms_room_type_catalog when the user asks what room types the hotel has without dates.",

  pms_inventory_summary:
    "Read daily inventory totals for a date range, including total rooms and status counts where supported. Use this to explain availability discrepancies and booked/blocked/occupied counts. This does not pick a bookable room candidate; combine with pms_availability_search for booking preparation.",

  pms_room_reservation_context:
    "Read why a specific room is unavailable or associated with reservation/block context. Use after inventory summary or availability search points to a specific room.",

  pms_reservation_lookup:
    "Look up one reservation by reservation code, reservation id, or recent reservation target. Use for status/detail questions about a known booking. Returns reservation status, dates, room summary, and guest info.",

  pms_get_room:
    "Read one room's current facts. Use when the user asks about a specific room. Returns room ID, type, status, and availability window.",

  pms_today_arrivals:
    "List or check arrivals for a business date. Returns reservation codes, room assignments, guest names, and arrival statuses.",

  pms_today_departures:
    "List or check departures for a business date. Returns reservation codes, room assignments, guest names, and departure statuses.",

  pms_pending_action_status:
    "Read status for a known PMS pending action created by a typed approval workflow. This is status readback only; confirm and cancel are never available as natural-language tools.",
};

const PmsToolSchemas: Record<PmsSafeReadToolName, object> = {
  pms_hotel_profile: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  pms_room_type_catalog: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  pms_availability_search: {
    type: "object",
    additionalProperties: false,
    properties: {
      checkInDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      checkOutDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      roomType: { type: "string", minLength: 1 },
      quantity: { type: "integer", minimum: 1 },
      guestName: { type: "string", minLength: 1 },
    },
  },

  pms_inventory_summary: {
    type: "object",
    additionalProperties: false,
    properties: {
      startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },

  pms_room_reservation_context: {
    type: "object",
    additionalProperties: false,
    properties: {
      roomId: { type: "string", minLength: 1 },
      dateContext: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },

  pms_reservation_lookup: {
    type: "object",
    additionalProperties: false,
    properties: {
      reservationCode: { type: "string", minLength: 1 },
      reservationId: { type: "string", minLength: 1 },
      target: { type: "string", minLength: 1 },
    },
  },

  pms_get_room: {
    type: "object",
    additionalProperties: false,
    properties: {
      roomId: { type: "string", minLength: 1 },
    },
  },

  pms_today_arrivals: {
    type: "object",
    additionalProperties: false,
    properties: {
      businessDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },

  pms_today_departures: {
    type: "object",
    additionalProperties: false,
    properties: {
      businessDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },

  pms_pending_action_status: {
    type: "object",
    additionalProperties: false,
    properties: {
      pendingActionId: { type: "string", minLength: 1 },
    },
  },
};

export type GeneratePmsSafeReadToolsInput = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  executors?: UnifiedAgentToolExecutors;
};

export function generatePmsSafeReadTools(
  input: GeneratePmsSafeReadToolsInput,
  projection: readonly PmsCapabilityPlannerProjectionItem[] = PMS_SAFE_READ_PROJECTION,
): GatedToolDefinition<TSchema, GatedToolResult<unknown>>[] {
  return projection
    .filter(isVisibleSafeReadProjection)
    .map((item) => defineGeneratedTool(item.name, input));
}

export function pmsSafeReadProjection(): readonly PmsCapabilityPlannerProjectionItem[] {
  return PMS_SAFE_READ_PROJECTION;
}

export function pmsToolDescription(
  capabilityName: PmsSafeReadToolName,
): string {
  const description = PmsToolDescriptions[capabilityName];
  if (!description) {
    throw new Error(`Unknown PMS safe-read capability: ${capabilityName}`);
  }
  return description;
}

export function pmsToolSchema(capabilityName: PmsSafeReadToolName): object {
  const schema = PmsToolSchemas[capabilityName];
  if (!schema) {
    throw new Error(`Unknown PMS safe-read capability: ${capabilityName}`);
  }
  return schema;
}

function defineGeneratedTool(
  toolName: PmsSafeReadToolName,
  input: GeneratePmsSafeReadToolsInput,
): GatedToolDefinition<TSchema, GatedToolResult<unknown>> {
  const description = pmsToolDescription(toolName);
  const parameters = pmsToolSchema(toolName);

  const executePlan = async (params: Record<string, unknown>) => {
    return runGeneratedTool(toolName, input, params);
  };

  return {
    name: toolName,
    label: toolLabel(toolName),
    description,
    parameters,
    executePlan,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      return executePlan(params);
    },
  };
}

async function runGeneratedTool(toolName: PmsSafeReadToolName, input: GeneratePmsSafeReadToolsInput, params: Record<string, unknown>): Promise<AgentToolResult<GatedToolResult<unknown>>> {
  const executor = input.executors?.pmsReadExecutors?.[toolName] as GatedToolExecutor<unknown> | undefined;
  const result = await gatedPmsSafeRead({
    gateway: input.gateway,
    actor: input.actor,
    tenantId: input.tenantId,
    capabilityId: toolName,
    ...safeReadRequestParams(params),
    executor: executor ?? notConfiguredExecutor(`pmsReadExecutors.${toolName}`),
  });
  return {
    content: [{ type: "text", text: JSON.stringify(publicToolResult(result)) }],
    details: result,
  };
}

function toolLabel(toolName: PmsSafeReadToolName): string {
  const labels: Record<PmsSafeReadToolName, string> = {
    pms_hotel_profile: "PMS Hotel Profile",
    pms_room_type_catalog: "PMS Room Type Catalog",
    pms_availability_search: "PMS Availability Search",
    pms_inventory_summary: "PMS Inventory Summary",
    pms_room_reservation_context: "PMS Room Reservation Context",
    pms_reservation_lookup: "PMS Reservation Lookup",
    pms_get_room: "PMS Get Room",
    pms_today_arrivals: "PMS Today Arrivals",
    pms_today_departures: "PMS Today Departures",
    pms_pending_action_status: "PMS Pending Action Status",
  };
  return labels[toolName];
}

function isVisibleSafeReadProjection(item: PmsCapabilityPlannerProjectionItem): boolean {
  if (!item.customerChatAllowed || !item.naturalLanguageExecutable || item.confirmationRequired) return false;
  if (item.capabilityClass === "confirm" || item.capabilityClass === "workflow") return false;
  return item.capabilityClass === "safe_read" || item.name === "pms_pending_action_status";
}

function safeReadRequestParams(params: Record<string, unknown>): Omit<GatedToolRequest, "capabilityId" | "actor" | "tenantId"> {
  return {
    target: optionalText(params.target),
    roomId: optionalText(params.roomId),
    pendingActionId: optionalText(params.pendingActionId),
    checkInDate: optionalText(params.checkInDate),
    checkOutDate: optionalText(params.checkOutDate),
    startDate: optionalText(params.startDate),
    endDate: optionalText(params.endDate),
    businessDate: optionalText(params.businessDate),
    reservationCode: optionalText(params.reservationCode),
    reservationId: optionalText(params.reservationId),
    dateContext: optionalText(params.dateContext),
    roomType: optionalText(params.roomType),
    quantity: optionalPositiveInteger(params.quantity),
    guestName: optionalText(params.guestName),
  };
}


function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
