import { describe, expect, it } from "vitest";
import {
  capabilityRegistry,
  createSafetyAuditEvent,
  createSafetyAuditJsonlWriter,
  decideToolRequest,
  getCapabilityDefinition,
  serializeSafetyAuditEvent,
  type ToolRequest
} from "../packages/safety-gateway/src/index.js";

const customerBase = {
  actor: { profile: "customer" as const, id: "guest_1" },
  tenantId: "tenant_1"
};

const adminBase = {
  actor: { profile: "admin" as const, id: "admin_1" },
  tenantId: "tenant_1"
};

describe("Safety Gateway policy kernel", () => {
  it.each([
    ["pms_availability_search", "low"],
    ["pms_reservation_prepare_confirm", "medium"]
  ])("allows tenant-scoped customer %s through registered PMS capability constraints", (capabilityId, riskLevel) => {
    const decision = decideToolRequest({ ...customerBase, capabilityId });

    expect(decision.outcome).toBe("allow");
    expect(decision.capability).toEqual(capabilityRegistry[capabilityId as "pms_availability_search" | "pms_reservation_prepare_confirm"]);
    expect(decision.reasons[0]).toMatchObject({
      code: "capability_constraints_satisfied",
      capabilityId,
      riskLevel
    });
  });

  it.each(["sandbox_bash", "sandbox_write", "sandbox_edit", "sandbox_read", "http_request"])(
    "denies customer %s through risk and constraint decisions",
    (capabilityId) => {
      const decision = decideToolRequest({
        ...customerBase,
        capabilityId,
        workspace: { kind: capabilityId === "http_request" ? "none" : "sandbox", path: "/tmp/private" },
        target: "secret-token-value"
      });

      expect(decision.outcome).toBe("deny");
      expect(decision.capability?.id).toBe(capabilityId);
      expect(decision.reasons[0]?.constraintId).toBe(capabilityId === "http_request" ? "http_default_deny" : "customer_read_only");
      expect(decision.audit.targetKind).toBe("redacted");
    }
  );

  it("allows admin proposal writes only inside the proposal workspace", () => {
    const allowed = decideToolRequest({
      ...adminBase,
      capabilityId: "proposal_write",
      workspace: { kind: "proposal", path: "/workspaces/proposal_1/proposal/p1.md" },
      target: "/workspaces/proposal_1/proposal/p1.md"
    });
    const denied = decideToolRequest({
      ...adminBase,
      capabilityId: "proposal_write",
      workspace: { kind: "proposal", path: "/production/rates.json" }
    });

    expect(allowed.outcome).toBe("allow");
    expect(allowed.reasons[0]).toMatchObject({ code: "proposal_workspace_allowed", capabilityId: "proposal_write", riskLevel: "medium" });
    expect(denied.outcome).toBe("deny");
    expect(denied.reasons[0]?.constraintId).toBe("proposal_workspace_required");
  });

  it("requires typed approval for PMS confirmation with a pending action", () => {
    const missingPending = decideToolRequest({ ...customerBase, capabilityId: "pms_confirm" });
    const withPending = decideToolRequest({ ...customerBase, capabilityId: "pms_confirm", pendingActionId: "pending_1" });

    expect(missingPending.outcome).toBe("deny");
    expect(missingPending.reasons[0]?.constraintId).toBe("pending_action_required");
    expect(withPending.outcome).toBe("require_approval");
    expect(withPending.reasons[0]?.constraintId).toBe("typed_approval_required");
    expect(withPending.audit.hasPendingAction).toBe(true);
  });

  it("denies arbitrary HTTP by default", () => {
    const decision = decideToolRequest({
      ...adminBase,
      capabilityId: "http_request",
      target: "https://example.invalid/with-secret-token"
    });

    expect(decision.outcome).toBe("deny");
    expect(decision.reasons[0]).toMatchObject({
      code: "http_default_deny",
      constraintId: "http_default_deny",
      riskLevel: "critical"
    });
  });

  it("turns every decision outcome into a redacted JSONL audit event", () => {
    const writer = createSafetyAuditJsonlWriter();
    const requests: ToolRequest[] = [
      { ...customerBase, capabilityId: "pms_availability_search" },
      { ...adminBase, capabilityId: "http_request", target: "https://example.invalid/private-token" },
      { ...customerBase, capabilityId: "pms_confirm", pendingActionId: "pending_1" },
      { ...customerBase, capabilityId: "unknown_capability", target: "secret-target" }
    ];

    for (const [index, request] of requests.entries()) {
      const decision = decideToolRequest(request);
      const event = createSafetyAuditEvent(decision, { id: `audit_${index}`, at: "2026-05-06T12:00:00.000Z" });
      const jsonl = serializeSafetyAuditEvent(event);

      expect(event.outcome).toBe(decision.outcome);
      expect(event.reasonCodes).toEqual(decision.reasons.map((reason) => reason.code));
      writer.append(event);
      expect(jsonl.endsWith("\n")).toBe(true);
      expect(jsonl).not.toContain("private-token");
      expect(jsonl).not.toContain("tenant_1");
    }

    expect(writer.events()).toHaveLength(requests.length);
    expect(writer.flush()).not.toContain("private-token");
    expect(writer.flush()).not.toContain("tenant_1");
  });

  it("does not keep coarse PMS read or workflow compatibility capability registrations", () => {
    expect(getCapabilityDefinition("pms_read")).toBeUndefined();
    expect(getCapabilityDefinition("pms_workflow")).toBeUndefined();
  });

  const safeReadCapabilityIds = [
    "pms_availability_search",
    "pms_inventory_summary",
    "pms_room_reservation_context",
    "pms_reservation_lookup",
    "pms_get_room",
    "pms_today_arrivals",
    "pms_today_departures",
    "pms_pending_action_status"
  ] as const;

  it.each(safeReadCapabilityIds)(
    "registers and allows tenant-scoped customer %s through safe-read capability",
    (capabilityId) => {
      const definition = getCapabilityDefinition(capabilityId);
      expect(definition).toBeDefined();
      expect(definition?.kind).toBe("pms");
      expect(definition?.risk.level).toBe("low");
      expect(definition?.constraints).toEqual(["tenant_scope_required"]);

      const decision = decideToolRequest({ ...customerBase, capabilityId });
      expect(decision.outcome).toBe("allow");
      expect(decision.capability?.id).toBe(capabilityId);
      expect(decision.reasons[0]).toMatchObject({
        code: "capability_constraints_satisfied",
        capabilityId,
        riskLevel: "low"
      });
    }
  );

  it("does not expose final confirm or cancel capability registrations beyond pms_confirm", () => {
    const allIds = Object.keys(capabilityRegistry);
    const confirmOrCancelIds = allIds.filter(
      (id) => (id.includes("confirm") && !id.includes("prepare_confirm")) || id.includes("cancel")
    );
    expect(confirmOrCancelIds).toEqual(["pms_confirm"]);
  });
});
