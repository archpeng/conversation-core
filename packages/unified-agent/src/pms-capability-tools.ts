import {
  gatedPmsRead,
  type GatedToolExecutor,
  type GatedToolRequest,
  type SafetyGatewayPort,
} from "@pms-agent-v2/gated-tools";
import type { PiToolDefinition } from "./pi-session.js";
import type { UnifiedAgentToolExecutors } from "./tool-registration.js";

export const PMS_SAFE_READ_TOOLS = [
  "pms_availability_search",
  "pms_inventory_summary",
  "pms_room_reservation_context",
  "pms_reservation_lookup",
  "pms_get_room",
  "pms_today_arrivals",
  "pms_today_departures",
] as const;

export type PmsSafeReadToolName = (typeof PMS_SAFE_READ_TOOLS)[number];

const PmsToolDescriptions: Record<PmsSafeReadToolName, string> = {
  pms_availability_search:
    "Search full-stay available room candidates for the requested date range. A returned room is available for every requested night. Use pms_inventory_summary when the user asks about total room count, booked rooms, blocked rooms, or why the result count differs from hotel inventory.",

  pms_inventory_summary:
    "Read daily inventory totals for a date range, including total rooms and status counts where supported. Use this to explain availability discrepancies and booked/blocked/occupied counts. This does not pick a bookable room candidate; combine with pms_availability_search for booking preparation.",

  pms_room_reservation_context:
    "Read why a specific room is unavailable or associated with reservation/block context. Use after inventory summary or availability search points to a specific room.",

  pms_reservation_lookup:
    "Look up one reservation by reservation code. Use for status/detail questions about a known booking. Returns reservation status, dates, room summary, and guest info.",

  pms_get_room:
    "Read one room's current facts. Use when the user asks about a specific room. Returns room ID, type, status, and availability window.",

  pms_today_arrivals:
    "List or check arrivals for a business date. Returns reservation codes, room assignments, guest names, and arrival statuses.",

  pms_today_departures:
    "List or check departures for a business date. Returns reservation codes, room assignments, guest names, and departure statuses.",
};

const PmsToolSchemas: Record<PmsSafeReadToolName, object> = {
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
};

export type GeneratePmsSafeReadToolsInput = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  executors?: UnifiedAgentToolExecutors;
};

export function generatePmsSafeReadTools(
  input: GeneratePmsSafeReadToolsInput,
): PiToolDefinition[] {
  return PMS_SAFE_READ_TOOLS.map((toolName) =>
    defineGeneratedTool(toolName, input),
  );
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
): PiToolDefinition {
  const description = pmsToolDescription(toolName);
  const parameters = pmsToolSchema(toolName);

  return {
    name: toolName,
    label: toolLabel(toolName),
    description,
    parameters,
    async execute(_toolCallId, params) {
      const result = await gatedPmsRead({
        gateway: input.gateway,
        actor: input.actor,
        tenantId: input.tenantId,
        target: toolName,
        executor:
          input.executors?.pmsRead ?? notConfiguredExecutor("pmsRead"),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(publicToolResult(result)),
          },
        ],
        details: result,
      };
    },
  };
}

function toolLabel(toolName: PmsSafeReadToolName): string {
  const labels: Record<PmsSafeReadToolName, string> = {
    pms_availability_search: "PMS Availability Search",
    pms_inventory_summary: "PMS Inventory Summary",
    pms_room_reservation_context: "PMS Room Reservation Context",
    pms_reservation_lookup: "PMS Reservation Lookup",
    pms_get_room: "PMS Get Room",
    pms_today_arrivals: "PMS Today Arrivals",
    pms_today_departures: "PMS Today Departures",
  };
  return labels[toolName];
}

function publicToolResult(result: {
  outcome: string;
  auditId: string;
  value?: unknown;
}): unknown {
  if (result.outcome !== "allow")
    return { outcome: result.outcome, auditId: result.auditId };
  const value = result.value as Record<string, unknown> | undefined;
  if (isPmsEvidence(value)) {
    return {
      outcome: result.outcome,
      auditId: result.auditId,
      evidenceRef: value.evidenceRef,
      source: value.source,
      summary: value.summary,
    };
  }
  return { outcome: result.outcome, auditId: result.auditId, value };
}

function isPmsEvidence(
  value: unknown,
): value is { evidenceRef: string; source: unknown; summary: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const source = record.source as Record<string, unknown> | undefined;
  return (
    typeof record.evidenceRef === "string" &&
    typeof record.summary === "string" &&
    source?.system === "pms-platform" &&
    typeof source?.method === "string"
  );
}

function notConfiguredExecutor<T = unknown>(name: string): GatedToolExecutor<T> {
  return () => {
    throw new Error(`Gated tool executor is not configured: ${name}`);
  };
}
