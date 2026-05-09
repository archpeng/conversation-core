import {
  gatedEdit,
  gatedRead,
  gatedWrite,
  type GatedToolExecutor,
  type GatedToolRequest,
  type GatedToolResult,
  type SafetyGatewayPort
} from "@pms-agent-v2/gated-tools";
import type {
  AvailabilitySearchResult,
  InventorySummaryResult,
  PendingActionStatusFact,
  PmsEvidence,
  ReservationConfirmPreparation,
  ReservationDraftFact,
  ReservationFact,
  ReservationGroupDraftFact,
  ReservationGroupQuoteFact,
  ReservationQuoteFact,
  RoomReservationContextResult,
  RoomFact,
  TodayArrivalsResult,
  TodayDeparturesResult
} from "@pms-agent-v2/pms-platform-client";
import { generatePmsSafeReadTools } from "./pms-capability-tools.js";
import { generatePmsWorkflowTools } from "./pms-workflow-tools.js";
import type { UnifiedAgentProfile } from "./profile.js";
import type { AgentToolResult, GatedToolDefinition } from "./pi-session.js";
import type { TSchema } from "typebox";

type RegisteredGatedTool = GatedToolDefinition<TSchema, GatedToolResult<unknown>>;

export type PmsReadExecutorMap = {
  pms_availability_search: GatedToolExecutor<PmsEvidence<AvailabilitySearchResult>>;
  pms_inventory_summary: GatedToolExecutor<PmsEvidence<InventorySummaryResult>>;
  pms_room_reservation_context: GatedToolExecutor<PmsEvidence<RoomReservationContextResult>>;
  pms_reservation_lookup: GatedToolExecutor<PmsEvidence<ReservationFact>>;
  pms_get_room: GatedToolExecutor<PmsEvidence<RoomFact>>;
  pms_today_arrivals: GatedToolExecutor<PmsEvidence<TodayArrivalsResult>>;
  pms_today_departures: GatedToolExecutor<PmsEvidence<TodayDeparturesResult>>;
  pms_pending_action_status: GatedToolExecutor<PmsEvidence<PendingActionStatusFact>>;
};

export type PmsWorkflowExecutorMap = {
  pms_reservation_draft_create: GatedToolExecutor<PmsEvidence<ReservationDraftFact>>;
  pms_reservation_draft_update: GatedToolExecutor<PmsEvidence<ReservationDraftFact>>;
  pms_reservation_quote: GatedToolExecutor<PmsEvidence<ReservationQuoteFact>>;
  pms_reservation_prepare_confirm: GatedToolExecutor<PmsEvidence<ReservationConfirmPreparation>>;
  pms_reservation_group_draft_create: GatedToolExecutor<PmsEvidence<ReservationGroupDraftFact>>;
  pms_reservation_group_draft_update: GatedToolExecutor<PmsEvidence<ReservationGroupDraftFact>>;
  pms_reservation_group_quote: GatedToolExecutor<PmsEvidence<ReservationGroupQuoteFact>>;
  pms_reservation_group_prepare_confirm: GatedToolExecutor<PmsEvidence<ReservationConfirmPreparation>>;
};

export type UnifiedAgentToolExecutors = {
  pmsReadExecutors?: PmsReadExecutorMap;
  pmsWorkflowExecutors?: PmsWorkflowExecutorMap;
  proposalRead?: GatedToolExecutor<unknown>;
  proposalWrite?: GatedToolExecutor<unknown>;
  proposalEdit?: GatedToolExecutor<unknown>;
};

export type RegisterGatedToolsInput = {
  profile: UnifiedAgentProfile;
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  executors?: UnifiedAgentToolExecutors;
};

type TargetParams = {
  target?: string;
  pendingActionId?: string;
  path?: string;
  content?: string;
};

const targetParameters = {
  type: "object",
  additionalProperties: false,
  properties: {
    target: { type: "string" },
    pendingActionId: { type: "string" },
    path: { type: "string" },
    content: { type: "string" }
  }
} as const;

export function registerGatedTools(input: RegisterGatedToolsInput): RegisteredGatedTool[] {
  if (input.profile.id === "customer_pms") {
    return [...generatePmsSafeReadTools(input), ...generatePmsWorkflowTools(input)];
  }
  return [proposalReadTool(input), proposalWriteTool(input), proposalEditTool(input)];
}

function proposalReadTool(input: RegisterGatedToolsInput): RegisteredGatedTool {
  return defineGatedTool("gated_proposal_read", "Gated Proposal Read", "Read proposal workspace content through the Safety Gateway.", targetParameters, async (params: Record<string, unknown>) => {
    const path = optionalText(params.path) ?? "proposal.md";
    return gatedRead({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: { kind: "proposal", path },
      path,
      executor: input.executors?.proposalRead ?? notConfiguredExecutor("proposalRead")
    });
  });
}

function proposalWriteTool(input: RegisterGatedToolsInput): RegisteredGatedTool {
  return defineGatedTool("gated_proposal_write", "Gated Proposal Write", "Write proposal workspace content through the Safety Gateway.", targetParameters, async (params: Record<string, unknown>) => {
    const path = optionalText(params.path) ?? "proposal.md";
    return gatedWrite({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: { kind: "proposal", path },
      path,
      content: optionalText(params.content),
      executor: input.executors?.proposalWrite ?? notConfiguredExecutor("proposalWrite")
    });
  });
}

function proposalEditTool(input: RegisterGatedToolsInput): RegisteredGatedTool {
  return defineGatedTool("gated_proposal_edit", "Gated Proposal Edit", "Edit proposal workspace content through the Safety Gateway.", targetParameters, async (params: Record<string, unknown>) => {
    const path = optionalText(params.path) ?? "proposal.md";
    return gatedEdit({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: { kind: "proposal", path },
      path,
      content: optionalText(params.content),
      executor: input.executors?.proposalEdit ?? notConfiguredExecutor("proposalEdit")
    });
  });
}

export function defineGatedTool(name: string, label: string, description: string, parameters: unknown, run: (params: Record<string, unknown>) => Promise<GatedToolResult<unknown>>): RegisteredGatedTool {
  const executePlan = async (params: Record<string, unknown>) => toolResult(await run(params));
  return {
    name,
    label,
    description,
    parameters: parameters as TSchema,
    executePlan,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      return executePlan(params);
    }
  };
}

function toolResult(result: GatedToolResult<unknown>): AgentToolResult<GatedToolResult<unknown>> {
  return {
    content: [{ type: "text", text: JSON.stringify(publicToolResult(result)) }],
    details: result
  };
}

function publicToolResult(result: GatedToolResult<unknown>): unknown {
  if (result.outcome !== "allow") return { outcome: result.outcome, auditId: result.auditId };
  if (isPmsEvidence(result.value)) {
    return {
      outcome: result.outcome,
      auditId: result.auditId,
      evidenceRef: result.value.evidenceRef,
      source: result.value.source,
      summary: result.value.summary
    };
  }
  return { outcome: result.outcome, auditId: result.auditId, value: result.value };
}

function isPmsEvidence(value: unknown): value is PmsEvidence<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const source = record.source as Record<string, unknown> | undefined;
  return typeof record.evidenceRef === "string"
    && typeof record.summary === "string"
    && source?.system === "pms-platform"
    && typeof source?.method === "string";
}

function notConfiguredExecutor<T = unknown>(name: string): GatedToolExecutor<T> {
  return () => {
    throw new Error(`Gated tool executor is not configured: ${name}`);
  };
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
