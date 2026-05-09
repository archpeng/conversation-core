import {
  gatedPmsWorkflowStep,
  type GatedToolExecutor,
  type GatedToolRequest,
} from "@pms-agent-v2/gated-tools";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { TSchema } from "typebox";
import type { AgentToolResult, GatedToolDefinition } from "./pi-session.js";
import type { UnifiedAgentToolExecutors } from "./tool-registration.js";

export const PMS_SAFE_WORKFLOW_TOOLS = [
  "pms_reservation_draft_create",
  "pms_reservation_draft_update",
  "pms_reservation_quote",
  "pms_reservation_prepare_confirm",
  "pms_reservation_group_draft_create",
  "pms_reservation_group_draft_update",
  "pms_reservation_group_quote",
  "pms_reservation_group_prepare_confirm",
] as const;

export type PmsSafeWorkflowToolName = (typeof PMS_SAFE_WORKFLOW_TOOLS)[number];

const WorkflowDescriptions: Record<PmsSafeWorkflowToolName, string> = {
  pms_reservation_draft_create:
    "Create reservation draft evidence only. This does not confirm or create a final reservation. Use after availability evidence identifies a room candidate.",
  pms_reservation_draft_update:
    "Update an existing reservation draft with selected room evidence. This is draft-only and must carry the evidence ref used for selection when available.",
  pms_reservation_quote:
    "Quote a reservation draft. Returns quote evidence only and does not confirm the booking.",
  pms_reservation_prepare_confirm:
    "Prepare a typed approval card for a quoted reservation draft. Returns pending-action evidence; final confirm/cancel is never a natural-language tool.",
  pms_reservation_group_draft_create:
    "Create group reservation draft evidence only for multiple rooms. This does not confirm or create final reservations.",
  pms_reservation_group_draft_update:
    "Update a group reservation draft with selected room candidates. This is draft-only and must use PMS evidence refs for selections.",
  pms_reservation_group_quote:
    "Quote a group reservation draft. Returns quote evidence only and does not confirm the booking.",
  pms_reservation_group_prepare_confirm:
    "Prepare a typed approval card for a quoted group reservation draft. Returns pending-action evidence; final confirm/cancel is never a natural-language tool.",
};

const WorkflowSchemas: Record<PmsSafeWorkflowToolName, object> = {
  pms_reservation_draft_create: {
    type: "object",
    additionalProperties: false,
    properties: draftCreateProperties(),
  },
  pms_reservation_draft_update: {
    type: "object",
    additionalProperties: false,
    properties: {
      draftRef: { type: "string", minLength: 1 },
      draftId: { type: "string", minLength: 1 },
      roomId: { type: "string", minLength: 1 },
      selectedCandidateRef: { type: "string", minLength: 1 },
      sourceEvidenceRef: { type: "string", minLength: 1 },
      roomType: { type: "string", minLength: 1 },
    },
  },
  pms_reservation_quote: {
    type: "object",
    additionalProperties: false,
    properties: draftIdentifierProperties(),
  },
  pms_reservation_prepare_confirm: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...draftIdentifierProperties(),
      quoteRef: { type: "string", minLength: 1 },
      quoteId: { type: "string", minLength: 1 },
    },
  },
  pms_reservation_group_draft_create: {
    type: "object",
    additionalProperties: false,
    properties: {
      guestName: { type: "string", minLength: 1 },
      checkInDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      checkOutDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      quantity: { type: "integer", minimum: 2 },
      roomType: { type: "string", minLength: 1 },
      sourceEvidenceRef: { type: "string", minLength: 1 },
    },
  },
  pms_reservation_group_draft_update: {
    type: "object",
    additionalProperties: false,
    properties: {
      groupDraftRef: { type: "string", minLength: 1 },
      groupDraftId: { type: "string", minLength: 1 },
      sourceEvidenceRef: { type: "string", minLength: 1 },
      selections: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            roomId: { type: "string", minLength: 1 },
            selectedCandidateRef: { type: "string", minLength: 1 },
            roomTypeId: { type: "string", minLength: 1 },
            roomType: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  pms_reservation_group_quote: {
    type: "object",
    additionalProperties: false,
    properties: groupDraftIdentifierProperties(),
  },
  pms_reservation_group_prepare_confirm: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...groupDraftIdentifierProperties(),
      quoteRef: { type: "string", minLength: 1 },
      quoteId: { type: "string", minLength: 1 },
    },
  },
};

export function generatePmsWorkflowTools(input: {
  gateway: import("@pms-agent-v2/gated-tools").SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  executors?: UnifiedAgentToolExecutors;
}): GatedToolDefinition<TSchema, GatedToolResult<unknown>>[] {
  return PMS_SAFE_WORKFLOW_TOOLS.map((toolName) => defineWorkflowTool(toolName, input));
}

export function pmsWorkflowToolDescription(toolName: PmsSafeWorkflowToolName): string {
  const description = WorkflowDescriptions[toolName];
  if (!description) throw new Error(`Unknown PMS workflow capability: ${toolName}`);
  return description;
}

export function pmsWorkflowToolSchema(toolName: PmsSafeWorkflowToolName): object {
  const schema = WorkflowSchemas[toolName];
  if (!schema) throw new Error(`Unknown PMS workflow capability: ${toolName}`);
  return schema;
}

function defineWorkflowTool(toolName: PmsSafeWorkflowToolName, input: Parameters<typeof generatePmsWorkflowTools>[0]): GatedToolDefinition<TSchema, GatedToolResult<unknown>> {
  const executePlan = (params: Record<string, unknown>) => runWorkflowTool(toolName, input, params);
  return {
    name: toolName,
    label: workflowLabel(toolName),
    description: pmsWorkflowToolDescription(toolName),
    parameters: pmsWorkflowToolSchema(toolName) as TSchema,
    executePlan,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      return executePlan(params);
    },
  };
}

async function runWorkflowTool(toolName: PmsSafeWorkflowToolName, input: Parameters<typeof generatePmsWorkflowTools>[0], params: Record<string, unknown>): Promise<AgentToolResult<GatedToolResult<unknown>>> {
  const executor = input.executors?.pmsWorkflowExecutors?.[toolName] as GatedToolExecutor<unknown> | undefined;
  const result = await gatedPmsWorkflowStep({
    gateway: input.gateway,
    actor: input.actor,
    tenantId: input.tenantId,
    capabilityId: toolName,
    ...workflowRequestParams(params),
    executor: executor ?? notConfiguredExecutor(`pmsWorkflowExecutors.${toolName}`),
  });
  return {
    content: [{ type: "text", text: JSON.stringify(publicToolResult(result)) }],
    details: result,
  };
}

function workflowRequestParams(params: Record<string, unknown>): Omit<GatedToolRequest, "capabilityId" | "actor" | "tenantId"> {
  return {
    roomId: optionalText(params.roomId),
    draftId: optionalText(params.draftId),
    draftRef: optionalText(params.draftRef),
    groupDraftId: optionalText(params.groupDraftId),
    groupDraftRef: optionalText(params.groupDraftRef),
    quoteId: optionalText(params.quoteId),
    quoteRef: optionalText(params.quoteRef),
    checkInDate: optionalText(params.checkInDate),
    checkOutDate: optionalText(params.checkOutDate),
    roomType: optionalText(params.roomType),
    sourceEvidenceRef: optionalText(params.sourceEvidenceRef),
    selectedCandidateRef: optionalText(params.selectedCandidateRef),
    quantity: optionalPositiveInteger(params.quantity),
    selections: optionalSelections(params.selections),
    guestName: optionalText(params.guestName),
  };
}

function publicToolResult(result: { outcome: string; auditId: string; value?: unknown }): Record<string, unknown> {
  const value = result.value;
  if (isPmsEvidenceLike(value)) {
    return {
      outcome: result.outcome,
      auditId: result.auditId,
      evidenceRef: value.evidenceRef,
      source: value.source,
      summary: value.summary,
    };
  }
  return { outcome: result.outcome, auditId: result.auditId };
}

function isPmsEvidenceLike(value: unknown): value is { evidenceRef: string; source: unknown; summary: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.evidenceRef === "string" && typeof record.summary === "string" && record.source !== undefined;
}

function workflowLabel(toolName: PmsSafeWorkflowToolName): string {
  return toolName
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function draftCreateProperties(): Record<string, unknown> {
  return {
    roomId: { type: "string", minLength: 1 },
    guestName: { type: "string", minLength: 1 },
    checkInDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    checkOutDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    roomType: { type: "string", minLength: 1 },
    sourceEvidenceRef: { type: "string", minLength: 1 },
  };
}

function draftIdentifierProperties(): Record<string, unknown> {
  return {
    draftRef: { type: "string", minLength: 1 },
    draftId: { type: "string", minLength: 1 },
  };
}

function groupDraftIdentifierProperties(): Record<string, unknown> {
  return {
    groupDraftRef: { type: "string", minLength: 1 },
    groupDraftId: { type: "string", minLength: 1 },
  };
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function optionalSelections(value: unknown): GatedToolRequest["selections"] {
  return Array.isArray(value) && value.every(isSelection) ? value : undefined;
}

function isSelection(value: unknown): value is NonNullable<GatedToolRequest["selections"]>[number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.roomId === "string"
    && typeof record.selectedCandidateRef === "string"
    && (record.roomTypeId === undefined || typeof record.roomTypeId === "string")
    && (record.roomType === undefined || typeof record.roomType === "string");
}

function notConfiguredExecutor<T = unknown>(name: string): GatedToolExecutor<T> {
  return () => {
    throw new Error(`Gated tool executor is not configured: ${name}`);
  };
}
