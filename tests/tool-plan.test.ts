import { describe, expect, it } from "vitest";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import {
  buildVisibleGatedToolManifest,
  executeToolPlan,
  generatePmsSafeReadTools,
  loadAgentProfile,
  PMS_SAFE_READ_TOOLS,
  pmsToolDescription,
  parseToolPlan,
  registerGatedTools,
  type PiToolDefinition
} from "../packages/unified-agent/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";

const customer = { profile: "customer" as const, id: "customer_1" };
const admin = { profile: "admin" as const, id: "admin_1" };

describe("C1 LLM gated tool planning", () => {
  it("builds profile-visible gated manifests without raw executor names", () => {
    const customerTools = registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    });
    const adminTools = registerGatedTools({
      profile: loadAgentProfile("admin"),
      gateway: safetyGateway([]),
      actor: admin,
      tenantId: "tenant_1"
    });

    expect(buildVisibleGatedToolManifest(loadAgentProfile("customer"), customerTools).map((tool) => tool.name))
      .toEqual(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm"]);
    expect(buildVisibleGatedToolManifest(loadAgentProfile("admin"), adminTools).map((tool) => tool.name))
      .toEqual(["gated_proposal_read", "gated_proposal_write", "gated_proposal_edit"]);
    expect(JSON.stringify(buildVisibleGatedToolManifest(loadAgentProfile("customer"), customerTools))).not.toMatch(/"(read|write|edit|bash|http|http_request|sandbox_bash)"/);
  });

  it("validates LLM proposed actions against the visible manifest", () => {
    const manifest = buildVisibleGatedToolManifest(loadAgentProfile("customer"), registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    }));

    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }, manifest))
      .toEqual({ ok: true, plan: { type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } } });
    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } }, manifest))
      .toEqual({ ok: true, plan: { type: "call_tool", toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } } });
    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1 } }, manifest))
      .toEqual({ ok: true, plan: { type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 1 } } });
    expect(parseToolPlan({
      type: "bounded_read_then_workflow",
      read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } },
      workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, roomTypeText: "洞穴房" } }
    }, manifest)).toEqual({
      ok: true,
      plan: {
        type: "bounded_read_then_workflow",
        read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, guestName: "王晓" } },
        workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2, roomTypeText: "洞穴房" } }
      }
    });
    expect(parseToolPlan({ type: "ask_clarification", message: "请提供日期。" }, manifest))
      .toEqual({ ok: true, plan: { type: "ask_clarification", message: "请提供日期。" } });
    expect(parseToolPlan({ type: "refuse", reason: "policy", message: "不能执行。" }, manifest))
      .toEqual({ ok: true, plan: { type: "refuse", reason: "policy", message: "不能执行。" } });
    expect(parseToolPlan({ type: "require_approval", message: "需要卡片审批。" }, manifest))
      .toEqual({ ok: true, plan: { type: "require_approval", message: "需要卡片审批。" } });
  });

  it("rejects non-visible tools, raw executors, and customer workspace or bash plans", () => {
    const manifest = buildVisibleGatedToolManifest(loadAgentProfile("customer"), registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    }));

    expect(parseToolPlan({ type: "call_tool", toolName: "gated_proposal_write", params: { path: "/workspaces/x/proposal/a.md" } }, manifest))
      .toEqual({ ok: false, reason: "tool_not_visible" });
    expect(parseToolPlan({ type: "call_tool", toolName: "bash", params: { command: "pnpm test" } }, manifest))
      .toEqual({ ok: false, reason: "raw_tool_not_visible" });
    expect(parseToolPlan({ type: "call_tool", toolName: "read", params: { path: "AGENTS.md" } }, manifest))
      .toEqual({ ok: false, reason: "raw_tool_not_visible" });
    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability", checkInDate: "后天", quantity: 0 } }, manifest))
      .toEqual({ ok: false, reason: "invalid_tool_params" });
    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", roomId: "", guestName: "王晓", checkInDate: "后天", quantity: 0 } }, manifest))
      .toEqual({ ok: false, reason: "invalid_tool_params" });
    expect(parseToolPlan({ type: "call_tool", toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", quantity: 2 } }, manifest))
      .toEqual({ ok: false, reason: "invalid_tool_params" });
    expect(parseToolPlan({
      type: "bounded_read_then_workflow",
      read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } },
      workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10", roomTypeText: "" } }
    }, manifest)).toEqual({ ok: false, reason: "invalid_tool_params" });
    expect(parseToolPlan({
      type: "bounded_read_then_workflow",
      read: { toolName: "gated_pms_read", params: { target: "availability", checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } },
      workflow: { toolName: "gated_pms_workflow", params: { target: "prepare_confirm", roomId: "room-A1", guestName: "王晓", checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } }
    }, manifest)).toEqual({ ok: false, reason: "invalid_tool_params" });
  });

  it("executes accepted calls only through gated Pi tools after Safety Gateway decisions", async () => {
    const order: string[] = [];
    const profile = loadAgentProfile("customer");
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway(order),
      actor: customer,
      tenantId: "tenant_1",
      executors: {
        pmsRead: () => {
          order.push("executor");
          return { evidenceRef: "pms_ev_1" };
        }
      }
    });
    const manifest = buildVisibleGatedToolManifest(profile, tools);
    const parsed = parseToolPlan({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }, manifest);

    expect(parsed.ok).toBe(true);
    const result = parsed.ok ? await executeToolPlan(parsed.plan, tools) : undefined;

    expect(result?.ok).toBe(true);
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor"]);
  });

  it("prevents executor side effects when Safety Gateway denies or requires approval", async () => {
    const deniedOrder: string[] = [];
    const deniedTool: PiToolDefinition = {
      name: "gated_pms_read",
      label: "Gated PMS Read",
      description: "Read tenant PMS facts.",
      parameters: {},
      async execute() {
        deniedOrder.push("decide:pms_read");
        deniedOrder.push("audit:deny");
        return { content: [{ type: "text", text: "denied" }], details: { outcome: "deny", auditId: "audit_pms_read_deny" } };
      }
    };
    const approvalTool: PiToolDefinition = {
      name: "gated_pms_confirm",
      label: "Gated PMS Confirm",
      description: "Confirm PMS pending action.",
      parameters: {},
      async execute() {
        deniedOrder.push("decide:pms_confirm");
        deniedOrder.push("audit:require_approval");
        return { content: [{ type: "text", text: "approval" }], details: { outcome: "require_approval", auditId: "audit_pms_confirm_require_approval" } };
      }
    };

    const denied = await executeToolPlan({ type: "call_tool", toolName: "gated_pms_read", params: { target: "availability" } }, [deniedTool]);
    const approval = await executeToolPlan({ type: "call_tool", toolName: "gated_pms_confirm", params: { pendingActionId: "pending_1" } }, [approvalTool]);

    expect(denied).toEqual({ ok: false, result: { type: "refusal", reason: "policy", message: "Requested action was denied by policy." } });
    expect(approval).toEqual({ ok: false, result: { type: "refusal", reason: "policy", message: "Requested action requires typed approval." } });
    expect(deniedOrder).toEqual(["decide:pms_read", "audit:deny", "decide:pms_confirm", "audit:require_approval"]);
  });

  it("keeps natural-language confirm from becoming direct PMS mutation", async () => {
    const order: string[] = [];
    const profile = loadAgentProfile("customer");
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway(order),
      actor: customer,
      tenantId: "tenant_1",
      executors: {
        pmsConfirm: () => {
          order.push("confirm_executor");
          return { mutated: true };
        }
      }
    });
    const manifest = buildVisibleGatedToolManifest(profile, tools);
    const parsed = parseToolPlan({ type: "call_tool", toolName: "gated_pms_confirm", params: { pendingActionId: "pending_1" } }, manifest);
    const result = parsed.ok ? await executeToolPlan(parsed.plan, tools) : undefined;

    expect(parsed.ok).toBe(true);
    expect(result).toEqual({ ok: false, result: { type: "refusal", reason: "policy", message: "Requested action requires typed approval." } });
    expect(order).toEqual(["decide:pms_confirm", "audit:require_approval"]);
  });
});

describe("P2 capability-derived PMS tool descriptors", () => {
  it("generatePmsSafeReadTools() returns 7 tools with non-empty descriptions", () => {
    const tools = generatePmsSafeReadTools({
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    });

    expect(tools).toHaveLength(7);
    expect(tools.map((t) => t.name).sort()).toEqual([...PMS_SAFE_READ_TOOLS].sort());
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("pmsToolDescription returns the curated description for a known capability", () => {
    const description = pmsToolDescription("pms_availability_search");
    expect(description).toContain("Search full-stay available room candidates");
    expect(description).toContain("pms_inventory_summary");
  });

  it("pmsToolDescription throws for unknown capability", () => {
    expect(() => pmsToolDescription("pms_unknown" as any)).toThrow("Unknown PMS safe-read capability");
  });

  it("generated tool names match PMS_SAFE_READ_TOOLS", () => {
    const tools = generatePmsSafeReadTools({
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    });
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toEqual([...PMS_SAFE_READ_TOOLS]);
  });

  it("generated tools produce visible gated manifest items", () => {
    const profile = { ...loadAgentProfile("customer"), useGeneratedTools: true };
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway([]),
      actor: customer,
      tenantId: "tenant_1"
    });
    const manifest = buildVisibleGatedToolManifest(profile, tools);
    const manifestNames = manifest.map((m) => m.name);
    for (const toolName of PMS_SAFE_READ_TOOLS) {
      expect(manifestNames).toContain(toolName);
    }
    expect(manifestNames).toContain("gated_pms_workflow");
    expect(manifestNames).toContain("gated_pms_confirm");
  });

  it("generated tools execute through Safety Gateway with correct capability target", async () => {
    const order: string[] = [];
    const profile = { ...loadAgentProfile("customer"), useGeneratedTools: true };
    const tools = registerGatedTools({
      profile,
      gateway: safetyGateway(order),
      actor: customer,
      tenantId: "tenant_1",
      executors: {
        pmsRead: () => {
          order.push("executor");
          return { evidenceRef: "pms_ev_1", source: { system: "pms-platform", method: "searchAvailability" }, summary: "found" };
        }
      }
    });
    const manifest = buildVisibleGatedToolManifest(profile, tools);
    const parsed = parseToolPlan({ type: "call_tool", toolName: "pms_availability_search", params: { checkInDate: "2026-05-09", checkOutDate: "2026-05-10" } }, manifest);

    expect(parsed.ok).toBe(true);
    const result = parsed.ok ? await executeToolPlan(parsed.plan, tools) : undefined;

    expect(result?.ok).toBe(true);
    expect(order).toEqual(["decide:pms_read", "audit:allow", "executor"]);
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
