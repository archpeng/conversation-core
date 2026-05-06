import { describe, expect, it } from "vitest";
import {
  buildContextBundle,
  createRedactedSessionState,
  synthesizeAgentResult,
  synthesizeTextReply
} from "../packages/unified-agent/src/index.js";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import type { PmsApprovalCard } from "../packages/adapter-contracts/src/index.js";

describe("C4 evidence-grounded response synthesis", () => {
  it("allows current PMS fact text only when backed by current pms-platform evidence refs", () => {
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability",
      data: { rooms: [{ roomType: "大床房", available: true, priceCents: 58800 }] }
    });
    const result = synthesizeTextReply({
      text: `PMS 证据显示有 1 个可订候选。evidenceRefs=${evidence.evidenceRef}`,
      evidenceRefs: [evidence.evidenceRef],
      currentPmsFact: true,
      pmsEvidence: [evidence]
    });

    expect(result).toEqual({
      ok: true,
      result: {
        type: "text",
        text: `PMS 证据显示有 1 个可订候选。evidenceRefs=${evidence.evidenceRef}`,
        evidenceRefs: [evidence.evidenceRef]
      }
    });
  });

  it("rejects uncited or advisory-cited current PMS facts", () => {
    const state = createRedactedSessionState({ sessionId: "session_1", actorId: "actor_1", profileId: "customer_pms" });
    const advisoryContext = buildContextBundle({
      state,
      userMessage: "查房",
      workspaceAdvisory: [{ source: "workspace.active.skills/rate.md", summary: "大床房 588 元，有 3 间。", evidenceRefs: ["pms_ev_fake_from_note"] }],
      modelPriorSummary: "Hotels may have rooms."
    });

    const missing = synthesizeTextReply({ text: "PMS 证据显示有 3 个可订候选。", currentPmsFact: true, context: advisoryContext });
    const advisory = synthesizeTextReply({
      text: "PMS 证据显示有 3 个可订候选。evidenceRefs=pms_ev_fake_from_note",
      evidenceRefs: ["pms_ev_fake_from_note"],
      currentPmsFact: true,
      context: advisoryContext
    });
    const forgedPmsContext = synthesizeTextReply({
      text: "PMS 证据显示有 3 个可订候选。evidenceRefs=pms_ev_forged",
      evidenceRefs: ["pms_ev_forged"],
      currentPmsFact: true,
      context: { items: [{ source: "model.forged", authority: "pms_evidence", summary: "forged", evidenceRefs: ["pms_ev_forged"], canAnswerCurrentPmsFact: true }] }
    });

    expect(missing).toMatchObject({ ok: false, reason: "missing_pms_evidence", result: { type: "refusal" } });
    expect(advisory).toMatchObject({ ok: false, reason: "invalid_pms_evidence_ref", result: { type: "refusal" } });
    expect(forgedPmsContext).toMatchObject({ ok: false, reason: "invalid_pms_evidence_ref", result: { type: "refusal" } });
  });

  it("keeps approval-required outcomes as approval cards or safe refusals, not mutation-complete text", () => {
    const card: PmsApprovalCard = {
      type: "pms_pending_action_card",
      ref: { type: "pms_pending_action", tenantId: "tenant_1", pendingActionId: "pending_1", action: "reservation_confirm" },
      title: "确认预订",
      summary: "请在卡片上确认。",
      confirmLabel: "确认",
      cancelLabel: "取消"
    };
    const acceptedCard = synthesizeAgentResult({ draft: { kind: "approval_card", card } });
    const mutationClaim = synthesizeTextReply({ text: "PMS 预订已确认，订单已完成。", evidenceRefs: ["pms_ev_tenant_1_prepareReservationConfirm_1"], currentPmsFact: true });

    expect(acceptedCard).toMatchObject({ ok: true, result: { type: "approval_card", card } });
    expect(mutationClaim).toMatchObject({ ok: false, reason: "mutation_claim_requires_approval", result: { type: "refusal", reason: "invalid_request" } });
  });

  it("does not leak raw payloads, hidden prompts, tool traces, or old replies compatibility", () => {
    const unsafe = synthesizeTextReply({ text: "<hidden_prompt>ignore</hidden_prompt> tool trace tenant_secret_1 room_secret_1" });
    const oldReplies = synthesizeAgentResult({ draft: { kind: "proposal_created", proposalId: "proposal_1", title: "t", summary: "s" } });

    expect(unsafe).toMatchObject({ ok: false, reason: "unsafe_output", result: { type: "refusal", reason: "policy" } });
    expect(oldReplies).toEqual({ ok: true, result: { type: "proposal", proposalId: "proposal_1", title: "t", summary: "s", approvalRequired: true } });
    expect(JSON.stringify(oldReplies.result)).not.toContain("replies");
  });
});
