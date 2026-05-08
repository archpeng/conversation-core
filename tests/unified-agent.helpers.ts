import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import {
  type PiCreateAgentSession,
  type PiCreateAgentSessionOptions
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

export function fakeCreateAgentSession(calls: PiCreateAgentSessionOptions[], prompts: string[]): PiCreateAgentSession {
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

export function fakeCreateAgentSessionWithAssistantText(text: string): PiCreateAgentSession {
  return fakeCreateAgentSessionWithAssistantTextSequence([text]);
}

export function fakeCreateAgentSessionWithAssistantTextSequence(texts: string[], prompts: string[] = []): PiCreateAgentSession {
  return async () => {
    let index = 0;
    let listener: ((event: { type?: string; assistantMessageEvent?: { type?: string; delta?: string } }) => void) | undefined;
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
          listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: reply } });
        }
      }
    };
  };
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
