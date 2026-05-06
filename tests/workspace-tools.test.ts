import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTenantWorkspace, validateSkillProposalCompleteness, type TenantScope } from "../packages/workspace-core/src/index.js";
import { createSafetyAuditEvent, decideToolRequest, type SafetyDecision, type ToolRequest } from "../packages/safety-gateway/src/index.js";
import type { GatedDecision, GatedToolRequest, SafetyGatewayPort } from "../packages/gated-tools/src/index.js";
import {
  canWorkspaceArtifactAnswerCurrentPmsFact,
  createWorkspaceAuditBuffer,
  workspaceCreateSkillProposal,
  workspaceEditProposal,
  workspaceListActiveSkills,
  workspaceRead,
  workspaceWriteProposal,
  WorkspaceToolError
} from "../packages/workspace-tools/src/index.js";

const tenantId = "tenant_1";
const customer = { profile: "customer" as const, id: "guest_1" };
const admin = { profile: "admin" as const, id: "admin_1" };

describe("workspace-tools Safety-gated tenant workspace adapters", () => {
  it("gates before workspace writes and allows admin proposal writes only", async () => {
    const scope = await initializedScope();
    const customerOrder: string[] = [];
    const denied = await workspaceWriteProposal({
      gateway: safetyGateway(customerOrder),
      actor: customer,
      rootDir: scope.rootDir,
      tenantId,
      reason: "attempt customer write",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/SKILL.md",
      content: "# Denied\n"
    });

    expect(denied).toMatchObject({ outcome: "deny" });
    expect(customerOrder).toEqual(["decide:workspace_write_proposal", "audit:deny"]);
    await expect(stat(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });

    const adminOrder: string[] = [];
    const audit = createWorkspaceAuditBuffer();
    const allowed = await workspaceWriteProposal({
      gateway: safetyGateway(adminOrder),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "draft reviewed skill proposal",
      sourceEpisodeRefs: ["episode_1"],
      workspaceAudit: audit,
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/SKILL.md",
      content: "# Skill\n"
    });

    expect(allowed).toMatchObject({ outcome: "allow" });
    expect(adminOrder).toEqual(["decide:workspace_write_proposal", "audit:allow"]);
    expect(audit.events()).toHaveLength(1);
    if (allowed.outcome === "allow") {
      expect(allowed.value).toMatchObject({ authority: "workspace_advisory", canAnswerCurrentPmsFact: false });
      expect(allowed.value.file.zone).toBe("proposals");
    }
    await expect(readFile(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "SKILL.md"), "utf8")).resolves.toBe("# Skill\n");
  });

  it("denies active area writes and requires a write reason through Safety Gateway", async () => {
    const scope = await initializedScope();
    const activeWrite = await workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "attempt active write",
      logicalPath: "/workspaces/tenant_1/active/skills/SKILL.md",
      content: "# Active\n"
    });
    const missingReason = await workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/SKILL.md",
      content: "# Missing reason\n"
    });

    expect(activeWrite).toMatchObject({ outcome: "deny" });
    expect(activeWrite.decision.reasons[0]?.code).toBe("workspace_proposal_required");
    expect(missingReason).toMatchObject({ outcome: "deny" });
    expect(missingReason.decision.reasons[0]?.code).toBe("workspace_reason_required");
    await expect(stat(path.join(scope.rootDir, "workspaces", tenantId, "active", "skills", "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects traversal, symlink, .env, sensitive extensions, and oversized inputs without writes", async () => {
    const scope = await initializedScope();
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "bad traversal",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/../SKILL.md",
      content: "bad"
    })).resolves.toMatchObject({ outcome: "deny" });
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "bad env",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/.env",
      content: "TOKEN=1"
    })).resolves.toMatchObject({ outcome: "deny" });
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "bad key",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/private.key",
      content: "secret"
    })).resolves.toMatchObject({ outcome: "deny" });
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "bad extension",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.txt",
      content: "unsupported"
    })).rejects.toMatchObject({ code: "unsupported_file_kind" });
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      maxBytes: 4,
      reason: "oversized",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md",
      content: "too large"
    })).rejects.toMatchObject({ code: "file_too_large" });

    const outsideDir = await tempRoot();
    await writeFile(path.join(outsideDir, "outside.md"), "original", "utf8");
    await mkdir(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1"), { recursive: true });
    await symlink(path.join(outsideDir, "outside.md"), path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "linked.md"));
    await expect(workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "symlink write",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/linked.md",
      content: "mutated"
    })).rejects.toMatchObject({ code: "symlink_escape" });
    await expect(readFile(path.join(outsideDir, "outside.md"), "utf8")).resolves.toBe("original");
  });

  it("edits proposal files only after allow and rejects ambiguous edits before writing", async () => {
    const scope = await initializedScope();
    await workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "seed proposal",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md",
      content: "alpha beta beta\n"
    });

    await expect(workspaceEditProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "ambiguous edit",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md",
      oldText: "beta",
      newText: "gamma"
    })).rejects.toBeInstanceOf(WorkspaceToolError);

    const edited = await workspaceEditProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "single edit",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md",
      oldText: "alpha",
      newText: "omega"
    });

    expect(edited).toMatchObject({ outcome: "allow" });
    await expect(readFile(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "notes.md"), "utf8")).resolves.toBe("omega beta beta\n");
  });

  it("creates only structurally complete skill proposals with risk, eval, and status artifacts", async () => {
    const scope = await initializedScope();
    const order: string[] = [];
    await expect(workspaceCreateSkillProposal({
      gateway: safetyGateway(order),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "incomplete proposal",
      proposalId: "proposal_1",
      skillMarkdown: "# Skill\n",
      evalFixturesJson: "[]",
      riskReportMarkdown: "",
      statusJson: JSON.stringify({ state: "ready_for_review" })
    })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(workspaceCreateSkillProposal({
      gateway: safetyGateway(order),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "active status proposal",
      proposalId: "proposal_1",
      skillMarkdown: "# Skill\n",
      evalFixturesJson: "[]",
      riskReportMarkdown: "# Risk\n",
      statusJson: JSON.stringify({ state: "active" })
    })).rejects.toMatchObject({ code: "invalid_input" });
    expect(order).toEqual([]);
    await expect(stat(path.join(scope.rootDir, "workspaces", tenantId, "proposals", "proposal_1", "status.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const created = await workspaceCreateSkillProposal({
      gateway: safetyGateway(order),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "complete proposal",
      proposalId: "proposal_1",
      skillMarkdown: "# Skill\n",
      evalFixturesJson: JSON.stringify([{ input: "hi", expected: "safe" }]),
      riskReportMarkdown: "# Risk\n\nNo production mutation.\n",
      statusJson: JSON.stringify({ state: "ready_for_review" })
    });

    expect(created).toMatchObject({ outcome: "allow" });
    if (created.outcome === "allow") expect(created.value.proposal).toMatchObject({ complete: true, statusState: "ready_for_review" });
    await expect(validateSkillProposalCompleteness(scope, "proposal_1")).resolves.toMatchObject({ complete: true });
  });

  it("returns active skill names and marks workspace artifacts advisory, never PMS fact authority", async () => {
    const scope = await initializedScope();
    await writeFile(path.join(scope.rootDir, "workspaces", tenantId, "active", "skills", "approved-skill.md"), "# Active\n", "utf8");
    await workspaceWriteProposal({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "seed advisory note",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md",
      content: "Current room price is 100.\n"
    });

    const listed = await workspaceListActiveSkills({ gateway: safetyGateway([]), actor: admin, rootDir: scope.rootDir, tenantId, reason: "list active" });
    const read = await workspaceRead({
      gateway: safetyGateway([]),
      actor: admin,
      rootDir: scope.rootDir,
      tenantId,
      reason: "read advisory proposal",
      logicalPath: "/workspaces/tenant_1/proposals/proposal_1/notes.md"
    });

    expect(listed).toMatchObject({ outcome: "allow" });
    if (listed.outcome === "allow") expect(listed.value).toMatchObject({ skills: ["approved-skill.md"], canAnswerCurrentPmsFact: false });
    expect(read).toMatchObject({ outcome: "allow" });
    if (read.outcome === "allow") {
      expect(read.value.authority).toBe("workspace_advisory");
      expect(read.value.canAnswerCurrentPmsFact).toBe(false);
      expect(read.value.file.content).toContain("Current room price");
    }
    expect(canWorkspaceArtifactAnswerCurrentPmsFact()).toBe(false);
  });
});

async function initializedScope(): Promise<TenantScope> {
  const rootDir = await tempRoot();
  await createTenantWorkspace(rootDir, tenantId);
  return { rootDir, tenantId };
}

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "pms-agent-workspace-tools-"));
}

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
