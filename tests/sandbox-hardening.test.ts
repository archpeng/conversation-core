import { describe, expect, it } from "vitest";
import {
  gatedBash,
  gatedEdit,
  gatedRead,
  gatedWrite
} from "../packages/gated-tools/src/index.js";
import { decideToolRequest } from "../packages/safety-gateway/src/index.js";
import { safetyGateway } from "./unified-agent.helpers.js";

const admin = { profile: "admin" as const, id: "admin_1" };
const tenantId = "tenant_1";
const sandboxRoot = "/workspaces/run_1/sandbox";
const sandboxFile = `${sandboxRoot}/checks/output.txt`;
const proposalFile = "/workspaces/run_1/proposal/SKILL.md";

describe("sandbox and file hardening", () => {
  it("Loop 6 passes with sandbox read constraints and proposal-only write/edit", async () => {
    const calls: string[] = [];
    const gateway = safetyGateway();

    const sandboxRead = await gatedRead({
      gateway,
      actor: admin,
      tenantId,
      workspace: { kind: "sandbox", path: sandboxFile },
      path: sandboxFile,
      executor: () => {
        calls.push("sandbox-read");
        return "read";
      }
    });
    const proposalWrite = await gatedWrite({
      gateway,
      actor: admin,
      tenantId,
      workspace: { kind: "proposal", path: proposalFile },
      path: proposalFile,
      executor: () => {
        calls.push("proposal-write");
        return "write";
      }
    });
    const proposalEdit = await gatedEdit({
      gateway,
      actor: admin,
      tenantId,
      workspace: { kind: "proposal", path: proposalFile },
      path: proposalFile,
      executor: () => {
        calls.push("proposal-edit");
        return "edit";
      }
    });
    const sandboxWrite = await gatedWrite({
      gateway,
      actor: admin,
      tenantId,
      workspace: { kind: "sandbox", path: sandboxFile },
      path: sandboxFile,
      executor: () => {
        calls.push("sandbox-write");
        return "write";
      }
    });
    const sandboxEdit = await gatedEdit({
      gateway,
      actor: admin,
      tenantId,
      workspace: { kind: "sandbox", path: sandboxFile },
      path: sandboxFile,
      executor: () => {
        calls.push("sandbox-edit");
        return "edit";
      }
    });

    expect(sandboxRead).toMatchObject({ outcome: "allow" });
    expect(proposalWrite).toMatchObject({ outcome: "allow" });
    expect(proposalEdit).toMatchObject({ outcome: "allow" });
    expect(sandboxWrite).toMatchObject({ outcome: "deny" });
    expect(sandboxEdit).toMatchObject({ outcome: "deny" });
    expect(calls).toEqual(["sandbox-read", "proposal-write", "proposal-edit"]);
  });

  it.each([
    ["sandbox root", "sandbox_read", "/root/.ssh/id_rsa", "sandbox"],
    ["sandbox env", "sandbox_read", "/workspaces/run_1/sandbox/.env", "sandbox"],
    ["sandbox production", "sandbox_read", "/workspaces/run_1/sandbox/production/out.txt", "sandbox"],
    ["proposal root", "proposal_write", "/workspaces/run_1/proposal/root/SKILL.md", "proposal"],
    ["proposal env", "proposal_edit", "/workspaces/run_1/proposal/.env", "proposal"],
    ["proposal production", "proposal_read", "/workspaces/run_1/proposal/production/rule.md", "proposal"]
  ])("denies %s file paths before execution", (_label, capabilityId, path, kind) => {
    const decision = decideToolRequest({
      capabilityId,
      actor: admin,
      tenantId,
      workspace: { kind: kind as "sandbox" | "proposal", path },
      target: path
    });

    expect(decision.outcome).toBe("deny");
    expect(decision.audit.targetKind).toBe("redacted");
  });

  it("denies mismatched safe workspace and unsafe target paths", () => {
    const sandboxTargetEscape = decideToolRequest({
      capabilityId: "sandbox_read",
      actor: admin,
      tenantId,
      workspace: { kind: "sandbox", path: sandboxRoot },
      target: "/etc/passwd"
    });
    const proposalTargetEscape = decideToolRequest({
      capabilityId: "proposal_write",
      actor: admin,
      tenantId,
      workspace: { kind: "proposal", path: proposalFile },
      target: "/production/SKILL.md"
    });

    expect(sandboxTargetEscape.outcome).toBe("deny");
    expect(proposalTargetEscape.outcome).toBe("deny");
  });

  it.each(["pnpm test", " pnpm   build ", "tsc --noEmit"])("allows only deterministic validation command %s in sandbox", async (command) => {
    const calls: string[] = [];
    const result = await gatedBash({
      gateway: safetyGateway(),
      actor: admin,
      tenantId,
      workspace: { kind: "sandbox", path: sandboxRoot },
      command,
      executor: ({ request }) => {
        calls.push(request.target ?? "");
        return "ok";
      }
    });

    expect(result).toMatchObject({ outcome: "allow" });
    expect(calls).toEqual([command]);
  });

  it.each(["curl https://example.invalid", "wget https://example.invalid", "ssh host", "scp a b", "rm -rf /", "printenv", "cat .env", "docker ps", "kubectl get pods"])(
    "denies sandbox bash command %s without executor side effects",
    async (command) => {
      const calls: string[] = [];
      const result = await gatedBash({
        gateway: safetyGateway(),
        actor: admin,
        tenantId,
        workspace: { kind: "sandbox", path: sandboxRoot },
        command,
        executor: () => {
          calls.push(command);
          return "ran";
        }
      });

      expect(result).toMatchObject({ outcome: "deny" });
      expect(result.decision.reasons[0]).toMatchObject({ code: "sandbox_command_allowlist" });
      expect(calls).toEqual([]);
    }
  );

  it("denies bash outside sandbox workspace constraints", async () => {
    const calls: string[] = [];
    const result = await gatedBash({
      gateway: safetyGateway(),
      actor: admin,
      tenantId,
      workspace: { kind: "proposal", path: proposalFile },
      command: "pnpm test",
      executor: () => {
        calls.push("bash");
        return "ran";
      }
    });

    expect(result).toMatchObject({ outcome: "deny" });
    expect(result.decision.reasons[0]).toMatchObject({ code: "sandbox_workspace_required" });
    expect(calls).toEqual([]);
  });
});
