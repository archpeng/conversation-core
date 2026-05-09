import { describe, expect, it } from "vitest";
import { createPmsEvidence } from "../packages/pms-platform-client/src/index.js";
import {
  loadAgentProfile,
  PMS_SAFE_READ_TOOLS,
  PMS_SAFE_WORKFLOW_TOOLS,
  pmsToolDescription,
  pmsToolSchema,
  pmsWorkflowToolDescription,
  pmsWorkflowToolSchema,
  registerGatedTools,
  type PmsReadExecutorMap,
  type PmsWorkflowExecutorMap
} from "../packages/unified-agent/src/index.js";
import { safetyGateway } from "./unified-agent.helpers.js";

describe("PMS Pi tool surface", () => {
  it("registers generated customer PMS tools without coarse compatibility aliases", () => {
    const tools = registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway([]),
      actor: { profile: "customer", id: "actor_1" },
      tenantId: "tenant_1"
    });

    expect(tools.map((tool) => tool.name)).toEqual([...PMS_SAFE_READ_TOOLS, ...PMS_SAFE_WORKFLOW_TOOLS]);
    expect(tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["gated_pms_read", "gated_pms_workflow", "gated_pms_confirm", "bash", "read", "write"]));
  });

  it("documents availability as full-stay candidates, not total inventory", () => {
    expect(pmsToolDescription("pms_availability_search")).toContain("available for every requested night");
    expect(pmsToolDescription("pms_availability_search")).toContain("not the hotel room type catalog");
    expect(pmsToolDescription("pms_room_type_catalog")).toContain("PMS-configured active room type catalog");
    expect(pmsToolDescription("pms_inventory_summary")).toContain("total rooms");
    expect(pmsToolSchema("pms_room_type_catalog")).toMatchObject({ properties: {} });
    expect(pmsToolSchema("pms_availability_search")).toMatchObject({
      properties: {
        checkInDate: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        checkOutDate: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
      }
    });
  });

  it("documents workflow tools as safe draft/quote/prepare steps only", () => {
    expect(pmsWorkflowToolDescription("pms_reservation_prepare_confirm")).toContain("approval card");
    expect(pmsWorkflowToolDescription("pms_reservation_prepare_confirm")).toContain("never a natural-language tool");
    expect(pmsWorkflowToolSchema("pms_reservation_prepare_confirm")).toMatchObject({
      properties: {
        draftRef: { type: "string" },
        quoteRef: { type: "string" }
      }
    });
  });

  it("executes generated safe reads through the Safety Gateway with minimized public content", async () => {
    const order: string[] = [];
    const evidence = createPmsEvidence({
      method: "searchAvailability",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "availability summary",
      data: { rooms: [{ roomId: "room_secret_1", roomType: "suite", available: true }] }
    });
    const tools = registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway(order),
      actor: { profile: "customer", id: "actor_1" },
      tenantId: "tenant_1",
      executors: { pmsReadExecutors: readExecutors(evidence) }
    });

    const tool = tools.find((candidate) => candidate.name === "pms_availability_search");
    expect(tool).toBeDefined();
    const result = await tool?.executePlan({ checkInDate: "2026-05-09", checkOutDate: "2026-05-10" });

    expect(order).toEqual(["decide:pms_availability_search", "audit:allow"]);
    expect(result?.details).toMatchObject({ outcome: "allow", value: { evidenceRef: evidence.evidenceRef } });
    expect(JSON.stringify(result?.content)).toContain(evidence.evidenceRef);
    expect(JSON.stringify(result?.content)).not.toContain("room_secret_1");
  });

  it("executes generated workflow steps through their own capability IDs", async () => {
    const order: string[] = [];
    const evidence = createPmsEvidence({
      method: "prepareReservationConfirm",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-06T12:00:00.000Z",
      summary: "prepare confirm",
      data: { pendingActionId: "pending_1", confirmationMode: "typedCardOnly", mutationStatus: "none" }
    });
    const tools = registerGatedTools({
      profile: loadAgentProfile("customer"),
      gateway: safetyGateway(order),
      actor: { profile: "customer", id: "actor_1" },
      tenantId: "tenant_1",
      executors: { pmsWorkflowExecutors: workflowExecutors(evidence) }
    });

    const tool = tools.find((candidate) => candidate.name === "pms_reservation_prepare_confirm");
    expect(tool).toBeDefined();
    const result = await tool?.executePlan({ draftRef: "draft_1", quoteRef: "quote_1" });

    expect(order).toEqual(["decide:pms_reservation_prepare_confirm", "audit:allow"]);
    expect(result?.details).toMatchObject({ outcome: "allow", value: { evidenceRef: evidence.evidenceRef } });
  });
});

function readExecutors(evidence: ReturnType<typeof createPmsEvidence>): PmsReadExecutorMap {
  return {
    pms_hotel_profile: () => evidence as never,
    pms_room_type_catalog: () => evidence as never,
    pms_availability_search: () => evidence,
    pms_inventory_summary: () => evidence as never,
    pms_room_reservation_context: () => evidence as never,
    pms_reservation_lookup: () => evidence as never,
    pms_get_room: () => evidence as never,
    pms_today_arrivals: () => evidence as never,
    pms_today_departures: () => evidence as never,
    pms_pending_action_status: () => evidence as never
  };
}

function workflowExecutors(evidence: ReturnType<typeof createPmsEvidence>): PmsWorkflowExecutorMap {
  return {
    pms_reservation_draft_create: () => evidence as never,
    pms_reservation_draft_update: () => evidence as never,
    pms_reservation_quote: () => evidence as never,
    pms_reservation_prepare_confirm: () => evidence as never,
    pms_reservation_group_draft_create: () => evidence as never,
    pms_reservation_group_draft_update: () => evidence as never,
    pms_reservation_group_quote: () => evidence as never,
    pms_reservation_group_prepare_confirm: () => evidence as never
  };
}
