import { createAgentService } from "@pms-agent-v2/agent-service";
import type { FeishuTurnInput } from "@pms-agent-v2/adapter-contracts";
import type { GatedDecision, GatedToolExecutor, GatedToolRequest, SafetyGatewayPort } from "@pms-agent-v2/gated-tools";
import { createPmsEvidence, type PmsEvidenceMethod } from "@pms-agent-v2/pms-platform-client";
import { createSafetyAuditEvent, decideToolRequest, type SafetyAuditJsonlWriter, type SafetyDecision, type ToolRequest } from "@pms-agent-v2/safety-gateway";
import type { AgentSessionEvent, AgentSessionFactory, UnifiedAgentToolExecutors } from "@pms-agent-v2/unified-agent";

export const customerTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_secret_eval",
  messageId: "message_1",
  actor: { role: "customer", id: "actor_secret_eval" },
  message: { text: "2026-05-06 suite availability" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

export const adminTurn: FeishuTurnInput = {
  ...customerTurn,
  actor: { role: "admin", id: "admin_secret_eval" },
  message: { text: "Generate proposal skill eval risk for late checkout rule" }
};

export const fakeCreateAgentSession: AgentSessionFactory = async () => ({
  session: {
    async prompt() {}
  }
});

export function assistantTextSession(text: string): AgentSessionFactory {
  return async () => ({
    session: {
      async prompt() {},
      messages: [{ role: "assistant", content: text }]
    }
  });
}

export function assistantTextSessionWithPromptCapture(text: string, prompts: string[]): AgentSessionFactory {
  return async () => ({
    session: {
      async prompt(prompt) {
        prompts.push(prompt);
      },
      messages: [{ role: "assistant", content: text }]
    }
  });
}

type ToolCallTurn = {
  calls?: readonly { toolName: string; params: Record<string, unknown> }[];
  text?: string;
};

export function queuedToolCallSession(turns: readonly ToolCallTurn[], prompts: string[] = []): AgentSessionFactory {
  return async (options) => {
    const listeners: ((event: AgentSessionEvent) => void)[] = [];
    const messages: unknown[] = [];
    let turnIndex = 0;
    return {
      session: {
        subscribe(listener) {
          listeners.push(listener);
          return () => {
            const index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
          };
        },
        async prompt(prompt) {
          prompts.push(prompt);
          const turn = turns[turnIndex++] ?? {};
          for (const [index, call] of (turn.calls ?? []).entries()) {
            const tool = options.customTools.find((candidate) => candidate.name === call.toolName);
            if (!tool) throw new Error(`tool_not_visible:${call.toolName}`);
            const result = await tool.executePlan(call.params);
            emit(listeners, agentSessionEvent({
              type: "tool_execution_end",
              toolCallId: `tool_eval_${turnIndex}_${index}`,
              toolName: call.toolName,
              result,
              isError: false
            }));
          }
          const text = turn.text ?? "";
          if (text) {
            emit(listeners, agentSessionEvent({
              type: "message_update",
              message: { role: "assistant", content: text },
              assistantMessageEvent: { type: "text_delta", delta: text }
            }));
          }
          const message = { role: "assistant", content: text };
          messages.push(message);
          emit(listeners, agentSessionEvent({ type: "turn_end", message, toolResults: [] }));
        },
        messages
      }
    };
  };
}

function agentSessionEvent(event: Record<string, unknown>): AgentSessionEvent {
  return event as AgentSessionEvent;
}

function emit(listeners: readonly ((event: AgentSessionEvent) => void)[], event: AgentSessionEvent): void {
  for (const listener of listeners) listener(event);
}

export function fakePmsEvidence<T>(input: { method: PmsEvidenceMethod; data: T; summary: string; fetchedAt?: string }) {
  return createPmsEvidence({
    method: input.method,
    tenantId: "tenant_1",
    fetchedAt: input.fetchedAt ?? "2026-05-06T12:00:00.000Z",
    data: input.data,
    summary: input.summary
  });
}

export function recordingGateway(writer: SafetyAuditJsonlWriter): SafetyGatewayPort {
  const safetyDecisions = new WeakMap<GatedDecision, SafetyDecision>();

  return {
    decide(request: GatedToolRequest): GatedDecision {
      const decision = decideToolRequest(toSafetyToolRequest(request));
      const gatedDecision = toGatedDecision(decision);
      safetyDecisions.set(gatedDecision, decision);
      return gatedDecision;
    },
    audit(decision: GatedDecision) {
      const safetyDecision = safetyDecisions.get(decision);
      if (!safetyDecision) return { id: `audit_eval_${writer.events().length}` };
      const event = createSafetyAuditEvent(safetyDecision, { id: `audit_eval_${writer.events().length}` });
      writer.append(event);
      return { id: event.id };
    }
  };
}

function toSafetyToolRequest(request: GatedToolRequest): ToolRequest {
  return {
    capabilityId: request.capabilityId,
    actor: request.actor,
    tenantId: request.tenantId,
    workspace: request.workspace,
    pendingActionId: request.pendingActionId,
    pendingActionRef: request.pendingActionRef,
    cardPayloadRef: request.cardPayloadRef,
    target: request.target,
    roomId: request.roomId,
    roomNumber: request.roomNumber,
    draftId: request.draftId,
    draftRef: request.draftRef,
    groupDraftId: request.groupDraftId,
    groupDraftRef: request.groupDraftRef,
    quoteId: request.quoteId,
    quoteRef: request.quoteRef,
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    startDate: request.startDate,
    endDate: request.endDate,
    businessDate: request.businessDate,
    reservationCode: request.reservationCode,
    dateContext: request.dateContext,
    roomType: request.roomType,
    roomTypeText: request.roomTypeText,
    sourceEvidenceRef: request.sourceEvidenceRef,
    selectedCandidateRef: request.selectedCandidateRef,
    quantity: request.quantity,
    guestName: request.guestName,
    content: request.content,
    operation: request.operation,
    reason: request.reason,
    sourceEpisodeRefs: request.sourceEpisodeRefs,
    riskLevel: request.riskLevel
  };
}

function toGatedDecision(decision: SafetyDecision): GatedDecision {
  return {
    outcome: decision.outcome,
    reasons: decision.reasons.map((reason) => ({ code: reason.code })),
    audit: { capabilityId: decision.audit.capabilityId }
  };
}

export function hasAudit(writer: SafetyAuditJsonlWriter, capabilityId: string, outcome: string): boolean {
  return writer.events().some((event) => event.capabilityId === capabilityId && event.outcome === outcome);
}

export function auditCount(writer: SafetyAuditJsonlWriter, capabilityId: string, outcome: string): number {
  return writer.events().filter((event) => event.capabilityId === capabilityId && event.outcome === outcome).length;
}

export function service(writer: SafetyAuditJsonlWriter, executors: {
  proposalWrite?: GatedToolExecutor<unknown>;
} & UnifiedAgentToolExecutors) {
  return createAgentService({
    gateway: recordingGateway(writer),
    createAgentSession: fakeCreateAgentSession,
    executors
  });
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
