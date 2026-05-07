import {
  gatedEdit,
  gatedPmsConfirm,
  gatedPmsRead,
  gatedPmsWorkflow,
  gatedRead,
  gatedWrite,
  type GatedToolExecutor,
  type GatedToolRequest,
  type GatedToolResult,
  type SafetyGatewayPort
} from "@pms-agent-v2/gated-tools";
import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import type { UnifiedAgentProfile } from "./profile.js";
import type { PiToolDefinition, PiToolResult } from "./pi-session.js";

export type UnifiedAgentToolExecutors = {
  pmsRead?: GatedToolExecutor<PmsEvidence<unknown>>;
  pmsWorkflow?: GatedToolExecutor<PmsEvidence<unknown>>;
  pmsConfirm?: GatedToolExecutor<unknown>;
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

type PmsReadParams = TargetParams & {
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  quantity?: number;
  guestName?: string;
  sourceEpisodeRefs?: readonly string[];
};

type PmsWorkflowParams = PmsReadParams & {
  roomId?: string;
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

const pmsReadParameters = {
  type: "object",
  additionalProperties: false,
  properties: {
    target: { type: "string", enum: ["availability", "capabilities"] },
    checkInDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    checkOutDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    roomType: { type: "string", minLength: 1 },
    quantity: { type: "integer", minimum: 1 },
    guestName: { type: "string", minLength: 1 }
  }
} as const;

const pmsWorkflowParameters = {
  type: "object",
  additionalProperties: false,
  properties: {
    target: { type: "string", enum: ["prepare_confirm"] },
    guestName: { type: "string", minLength: 1 },
    checkInDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    checkOutDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    quantity: { type: "integer", minimum: 1 },
    roomType: { type: "string", minLength: 1 }
  }
} as const;

export function registerGatedTools(input: RegisterGatedToolsInput): PiToolDefinition[] {
  if (input.profile.id === "customer_pms") {
    return [pmsReadTool(input), pmsWorkflowTool(input), pmsConfirmTool(input)];
  }
  return [proposalReadTool(input), proposalWriteTool(input), proposalEditTool(input)];
}

function pmsReadTool(input: RegisterGatedToolsInput): PiToolDefinition<PmsReadParams> {
  return defineGatedTool("gated_pms_read", "Gated PMS Read", "Read tenant-scoped PMS facts through the Safety Gateway. For availability, pass ISO checkInDate/checkOutDate and optional roomType, quantity, guestName when the user provided them.", pmsReadParameters, async (params) => {
    return gatedPmsRead({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      target: params.target,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      roomType: params.roomType,
      quantity: params.quantity,
      guestName: params.guestName,
      executor: input.executors?.pmsRead ?? notConfiguredExecutor("pmsRead")
    });
  });
}

function pmsWorkflowTool(input: RegisterGatedToolsInput): PiToolDefinition<PmsWorkflowParams> {
  return defineGatedTool("gated_pms_workflow", "Gated PMS Workflow", "Prepare tenant-scoped PMS workflow evidence without final mutation. Current workflow approval is single-room only: direct workflow quantity must be 1 or omitted; roomId is supplied by runtime from PMS evidence.", pmsWorkflowParameters, async (params) => {
    return gatedPmsWorkflow({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      target: params.target,
      roomId: params.roomId,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      roomType: params.roomType,
      quantity: params.quantity,
      guestName: params.guestName,
      sourceEpisodeRefs: params.sourceEpisodeRefs,
      executor: input.executors?.pmsWorkflow ?? notConfiguredExecutor("pmsWorkflow")
    });
  });
}

function pmsConfirmTool(input: RegisterGatedToolsInput): PiToolDefinition<TargetParams> {
  return defineGatedTool("gated_pms_confirm", "Gated PMS Confirm", "Prepare a typed approval boundary for a PMS pending action.", targetParameters, async (params) => {
    return gatedPmsConfirm({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      pendingActionId: params.pendingActionId,
      target: params.target,
      executor: input.executors?.pmsConfirm ?? notConfiguredExecutor("pmsConfirm")
    });
  });
}

function proposalReadTool(input: RegisterGatedToolsInput): PiToolDefinition<TargetParams> {
  return defineGatedTool("gated_proposal_read", "Gated Proposal Read", "Read proposal workspace content through the Safety Gateway.", targetParameters, async (params) => {
    const path = params.path ?? "proposal.md";
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

function proposalWriteTool(input: RegisterGatedToolsInput): PiToolDefinition<TargetParams> {
  return defineGatedTool("gated_proposal_write", "Gated Proposal Write", "Write proposal workspace content through the Safety Gateway.", targetParameters, async (params) => {
    const path = params.path ?? "proposal.md";
    return gatedWrite({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: { kind: "proposal", path },
      path,
      content: params.content,
      executor: input.executors?.proposalWrite ?? notConfiguredExecutor("proposalWrite")
    });
  });
}

function proposalEditTool(input: RegisterGatedToolsInput): PiToolDefinition<TargetParams> {
  return defineGatedTool("gated_proposal_edit", "Gated Proposal Edit", "Edit proposal workspace content through the Safety Gateway.", targetParameters, async (params) => {
    const path = params.path ?? "proposal.md";
    return gatedEdit({
      gateway: input.gateway,
      actor: input.actor,
      tenantId: input.tenantId,
      workspace: { kind: "proposal", path },
      path,
      content: params.content,
      executor: input.executors?.proposalEdit ?? notConfiguredExecutor("proposalEdit")
    });
  });
}

function defineGatedTool<Params extends TargetParams>(name: string, label: string, description: string, parameters: unknown, run: (params: Params) => Promise<GatedToolResult<unknown>>): PiToolDefinition<Params> {
  return {
    name,
    label,
    description,
    parameters,
    async execute(_toolCallId, params) {
      return toolResult(await run(params));
    }
  };
}

function toolResult(result: GatedToolResult<unknown>): PiToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(publicToolResult(result)) }],
    details: result
  };
}

function publicToolResult(result: GatedToolResult<unknown>): unknown {
  if (result.outcome !== "allow") return { outcome: result.outcome, auditId: result.auditId };
  return { outcome: result.outcome, auditId: result.auditId, value: result.value };
}

function notConfiguredExecutor<T = unknown>(name: string): GatedToolExecutor<T> {
  return () => {
    throw new Error(`Gated tool executor is not configured: ${name}`);
  };
}
