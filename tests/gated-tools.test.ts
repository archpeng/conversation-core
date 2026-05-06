import { describe, expect, it } from "vitest";
import {
  createSafetyAuditEvent,
  decideToolRequest,
  type SafetyDecision,
  type ToolRequest
} from "../packages/safety-gateway/src/index.js";
import {
  gatedBash,
  gatedEdit,
  gatedHttp,
  gatedPmsConfirm,
  gatedPmsRead,
  gatedPmsWorkflow,
  gatedRead,
  gatedWrite,
  runGatedTool,
  type GatedDecision,
  type GatedToolRequest,
  type SafetyGatewayPort
} from "../packages/gated-tools/src/index.js";

const customer = { profile: "customer" as const, id: "guest_1" };
const admin = { profile: "admin" as const, id: "admin_1" };

describe("gated tool runner", () => {
  it("evaluates and audits before constrained execution", async () => {
    const order: string[] = [];
    const gateway = safetyGateway(order);

    const result = await runGatedTool({
      gateway,
      request: { capabilityId: "pms_read", actor: customer, tenantId: "tenant_1" },
      executor: () => {
        order.push("executor");
        return { rooms: 1 };
      }
    });

    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor"]);
    expect(result).toMatchObject({ outcome: "allow", auditId: "audit_pms_read_allow" });
    if (result.outcome === "allow") expect(result.value).toEqual({ rooms: 1 });
  });

  it("returns deny without executor side effects", async () => {
    const order: string[] = [];
    const result = await gatedHttp({
      gateway: safetyGateway(order),
      actor: admin,
      tenantId: "tenant_1",
      url: "https://example.invalid/private-token",
      executor: () => {
        order.push("executor");
        return "network-called";
      }
    });

    expect(result).toMatchObject({ outcome: "deny", auditId: "audit_http_request_deny" });
    expect(order).toEqual(["decide:http_request", "audit:deny"]);
  });

  it("returns approval without executor side effects", async () => {
    const order: string[] = [];
    const result = await gatedPmsConfirm({
      gateway: safetyGateway(order),
      actor: customer,
      tenantId: "tenant_1",
      pendingActionId: "pending_1",
      executor: () => {
        order.push("executor");
        return "confirmed";
      }
    });

    expect(result).toMatchObject({ outcome: "require_approval", auditId: "audit_pms_confirm_require_approval" });
    expect(order).toEqual(["decide:pms_confirm", "audit:require_approval"]);
  });

  it("routes every PMS and filesystem wrapper through the Safety Gateway", async () => {
    const order: string[] = [];
    const gateway = safetyGateway(order);

    const pmsReadResult = await gatedPmsRead({
      gateway,
      actor: customer,
      tenantId: "tenant_1",
      executor: () => "availability"
    });
    const pmsWorkflowResult = await gatedPmsWorkflow({
      gateway,
      actor: admin,
      tenantId: "tenant_1",
      executor: () => "draft-workflow"
    });
    const proposalPath = "/workspaces/proposal_1/proposal/rate-change.md";
    const fileReadResult = await gatedRead({
      gateway,
      actor: admin,
      tenantId: "tenant_1",
      workspace: { kind: "proposal", path: proposalPath },
      path: proposalPath,
      executor: () => "proposal-read"
    });
    const fileWriteResult = await gatedWrite({
      gateway,
      actor: admin,
      tenantId: "tenant_1",
      workspace: { kind: "proposal", path: proposalPath },
      path: proposalPath,
      executor: () => "proposal-written"
    });
    const fileEditResult = await gatedEdit({
      gateway,
      actor: admin,
      tenantId: "tenant_1",
      workspace: { kind: "proposal", path: proposalPath },
      path: proposalPath,
      executor: () => "proposal-edited"
    });
    const bashResult = await gatedBash({
      gateway,
      actor: customer,
      tenantId: "tenant_1",
      workspace: { kind: "sandbox", path: "/workspace" },
      command: "cat secret.txt",
      executor: () => "bash-ran"
    });

    expect(pmsReadResult).toMatchObject({ outcome: "allow", auditId: "audit_pms_read_allow" });
    expect(pmsWorkflowResult).toMatchObject({ outcome: "allow", auditId: "audit_pms_workflow_allow" });
    expect(fileReadResult).toMatchObject({ outcome: "allow", auditId: "audit_proposal_read_allow" });
    expect(fileWriteResult).toMatchObject({ outcome: "allow", auditId: "audit_proposal_write_allow" });
    expect(fileEditResult).toMatchObject({ outcome: "allow", auditId: "audit_proposal_edit_allow" });
    expect(bashResult).toMatchObject({ outcome: "deny", auditId: "audit_sandbox_bash_deny" });
    expect(order).toEqual([
      "decide:pms_read",
      "audit:allow",
      "decide:pms_workflow",
      "audit:allow",
      "decide:proposal_read",
      "audit:allow",
      "decide:proposal_write",
      "audit:allow",
      "decide:proposal_edit",
      "audit:allow",
      "decide:sandbox_bash",
      "audit:deny"
    ]);
  });
});

function safetyGateway(order: string[]): SafetyGatewayPort {
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
