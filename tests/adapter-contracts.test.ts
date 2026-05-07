import { describe, expect, it } from "vitest";
import {
  isAgentResult,
  isFeishuTurnInput,
  validateAgentResult,
  validateFeishuTurnInput,
  validatePmsApprovalCard,
  type AgentResult,
  type FeishuTurnInput,
  type PmsApprovalCard
} from "../packages/adapter-contracts/src/index.js";

const validTurn: FeishuTurnInput = {
  channel: "feishu",
  tenantId: "tenant_1",
  sessionId: "chat_1",
  messageId: "msg_1",
  actor: { role: "customer", id: "user_1", displayName: "Guest" },
  message: { text: "查一下今晚可订房" },
  receivedAt: "2026-05-06T12:00:00.000Z"
};

const approvalCard: PmsApprovalCard = {
  type: "pms_pending_action_card",
  ref: {
    type: "pms_pending_action",
    tenantId: "tenant_1",
    pendingActionId: "pending_1",
    pendingActionRef: "pending_1",
    cardPayloadRef: "card_1",
    quoteRef: "quote_1",
    selectionCount: 2,
    action: "reservation_confirm",
    expiresAt: "2026-05-06T12:10:00.000Z"
  },
  title: "确认预订",
  summary: "确认 pending_1 后由 PMS 平台执行。",
  confirmLabel: "确认",
  cancelLabel: "取消"
};

const validResults: AgentResult[] = [
  { type: "text", text: "今晚还有可订房。", evidenceRefs: ["pms_ev_tenant_1_searchAvailability_1"] },
  { type: "refusal", reason: "policy", message: "该操作需要审批。" },
  { type: "proposal", proposalId: "proposal_1", title: "改价方案", summary: "建议先审批。", approvalRequired: true },
  { type: "approval_card", card: approvalCard }
];

describe("FeishuTurnInput", () => {
  it("validates the external Feishu turn input", () => {
    expect(validateFeishuTurnInput(validTurn)).toEqual({ ok: true, value: validTurn });
    expect(isFeishuTurnInput(validTurn)).toBe(true);
  });

  it.each([
    [{ ...validTurn, actor: { ...validTurn.actor, role: "owner" } }, "actor.role is invalid"],
    [without(validTurn, "tenantId"), "tenantId must be a non-empty string"],
    [without(validTurn, "sessionId"), "sessionId must be a non-empty string"],
    [without(validTurn, "messageId"), "messageId must be a non-empty string"],
    [without(validTurn, "message"), "message must be an object"],
    [{ ...validTurn, message: { text: "" } }, "message.text must be a non-empty string"]
  ])("rejects invalid input %#", (input, issue) => {
    const result = validateFeishuTurnInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain(issue);
  });
});

describe("PMS approval card", () => {
  it("validates a pending-action card by payload reference", () => {
    expect(validatePmsApprovalCard(approvalCard)).toEqual({ ok: true, value: approvalCard });
  });

  it("rejects cards without a pending-action reference", () => {
    const result = validatePmsApprovalCard({ ...approvalCard, ref: { ...approvalCard.ref, pendingActionId: "" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain("ref.pendingActionId must be a non-empty string");
  });
});

describe("AgentResult", () => {
  it("validates every public output variant", () => {
    for (const output of validResults) {
      expect(validateAgentResult(output)).toEqual({ ok: true, value: output });
      expect(isAgentResult(output)).toBe(true);
    }
  });

  it("rejects old ai-conversation response shape", () => {
    const result = validateAgentResult({ replies: [{ type: "text", text: "legacy" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain("old replies output is not AgentResult");
      expect(result.issues).toContain("type is invalid");
    }
  });

  it("rejects invalid public output variants", () => {
    const result = validateAgentResult({ type: "proposal", proposalId: "p1", title: "x", summary: "x", approvalRequired: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain("approvalRequired must be true");
  });

  it("rejects invalid text evidence refs", () => {
    const result = validateAgentResult({ type: "text", text: "fact", evidenceRefs: [""] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain("evidenceRefs[0] must be a non-empty string");
  });
});

function without<T extends Record<string, unknown>, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}
