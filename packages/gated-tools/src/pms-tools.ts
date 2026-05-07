import { runGatedTool, type GatedToolExecutor, type GatedToolRequest, type GatedToolResult, type SafetyGatewayPort } from "./run-gated-tool.js";

export type GatedPmsInput<T> = {
  gateway: SafetyGatewayPort;
  actor: GatedToolRequest["actor"];
  tenantId: string;
  target?: string;
  roomId?: string;
  draftId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  quantity?: number;
  guestName?: string;
  executor: GatedToolExecutor<T>;
};

export type GatedPmsConfirmInput<T> = GatedPmsInput<T> & {
  pendingActionId?: string;
};

export function gatedPmsRead<T>(input: GatedPmsInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: pmsRequest(input, "pms_read"),
    executor: input.executor
  });
}

export function gatedPmsWorkflow<T>(input: GatedPmsInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: pmsRequest(input, "pms_workflow"),
    executor: input.executor
  });
}

export function gatedPmsConfirm<T>(input: GatedPmsConfirmInput<T>): Promise<GatedToolResult<T>> {
  return runGatedTool({
    gateway: input.gateway,
    request: { ...pmsRequest(input, "pms_confirm"), pendingActionId: input.pendingActionId },
    executor: input.executor
  });
}

function pmsRequest<T>(input: GatedPmsInput<T>, capabilityId: string): GatedToolRequest {
  return {
    capabilityId,
    actor: input.actor,
    tenantId: input.tenantId,
    target: input.target,
    roomId: input.roomId,
    draftId: input.draftId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomType: input.roomType,
    quantity: input.quantity,
    guestName: input.guestName
  };
}
