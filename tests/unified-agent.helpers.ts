import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import {
  type AgentSessionEvent,
  type AgentSessionFactory,
  type AgentSessionFactoryOptions
} from "../packages/unified-agent/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import type { FeishuTurnInput } from "../packages/adapter-contracts/src/index.js";

export const baseTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "session_raw_secret",
  messageId: "message_raw_1",
  actor: { role: "customer", id: "actor_raw_secret" },
  message: { text: "查一下今天是否有空房" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

export function fakeCreateAgentSession(calls: AgentSessionFactoryOptions[], prompts: string[]): AgentSessionFactory {
  return async (options) => {
    calls.push(options);
    return {
      session: {
        async prompt(text) {
          prompts.push(text);
        }
      }
    };
  };
}

export function fakeCreateAgentSessionWithAssistantText(text: string): AgentSessionFactory {
  return fakeCreateAgentSessionWithAssistantTextSequence([text]);
}

export function fakeCreateAgentSessionWithAssistantTextSequence(texts: string[], prompts: string[] = []): AgentSessionFactory {
  return async () => {
    let index = 0;
    let listener: ((event: AgentSessionEvent) => void) | undefined;
    return {
      session: {
        subscribe(next) {
          listener = next;
          return () => {
            listener = undefined;
          };
        },
        async prompt(text) {
          prompts.push(text);
          const reply = texts[Math.min(index, texts.length - 1)] ?? "";
          index += 1;
          listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: reply } } as AgentSessionEvent);
        }
      }
    };
  };
}

export function fakeCreateAgentSessionWithToolCalls(
  turns: readonly { calls?: readonly { toolName: string; params: Record<string, unknown> }[]; text?: string }[],
  prompts: string[] = []
): AgentSessionFactory {
  return async (options) => {
    const listeners: ((event: AgentSessionEvent) => void)[] = [];
    const messages: unknown[] = [];
    let index = 0;
    return {
      session: {
        subscribe(listener) {
          listeners.push(listener);
          return () => {
            const listenerIndex = listeners.indexOf(listener);
            if (listenerIndex >= 0) listeners.splice(listenerIndex, 1);
          };
        },
        async prompt(prompt) {
          prompts.push(prompt);
          const turn = turns[index++] ?? {};
          for (const [callIndex, call] of (turn.calls ?? []).entries()) {
            const tool = options.customTools.find((candidate) => candidate.name === call.toolName);
            if (!tool) throw new Error(`tool_not_visible:${call.toolName}`);
            const result = await tool.executePlan(call.params);
            emit(listeners, {
              type: "tool_execution_end",
              toolCallId: `tool_${index}_${callIndex}`,
              toolName: call.toolName,
              result,
              isError: false
            } as unknown as AgentSessionEvent);
          }
          const text = turn.text ?? "";
          if (text) {
            emit(listeners, {
              type: "message_update",
              message: { role: "assistant", content: text },
              assistantMessageEvent: { type: "text_delta", delta: text }
            } as unknown as AgentSessionEvent);
          }
          const message = { role: "assistant", content: text };
          messages.push(message);
          emit(listeners, { type: "turn_end", message, toolResults: [] } as unknown as AgentSessionEvent);
        },
        messages
      }
    };
  };
}

function emit(listeners: readonly ((event: AgentSessionEvent) => void)[], event: AgentSessionEvent): void {
  for (const listener of listeners) listener(event);
}

export function safetyGateway(order: string[]): SafetyGatewayPort {
  return {
    decide(request: GatedToolRequest): GatedDecision {
      order.push(`decide:${request.capabilityId}`);
      return decideToolRequest(request as ToolRequest) as SafetyDecision as GatedDecision;
    },
    audit(decision: GatedDecision) {
      order.push(`audit:${decision.outcome}`);
      const event = createSafetyAuditEvent(decision as SafetyDecision);
      return { id: `audit_${event.capabilityId}_${event.outcome}` };
    }
  };
}
