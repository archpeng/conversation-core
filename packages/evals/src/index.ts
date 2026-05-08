import { fileURLToPath } from "node:url";
import { createSafetyAuditJsonlWriter, type SafetyAuditEvent, type SafetyAuditJsonlWriter } from "@pms-agent-v2/safety-gateway";
import {
  adminSkillProposal,
  contextAdvisoryNotTruth,
  focusedClarification,
  groundedAvailability,
  llmFactTextRequiresEvidence,
  llmPlanBeforeKeywordFallback,
  llmPlanNaturalConfirmNoMutation,
  llmPlanNonVisibleToolRejected,
  llmPlanPmsReadGrounded,
  llmPlanRawToolRejected,
  naturalConfirm,
  prepareConfirm,
  profileBoundary,
  promptInjection,
  promptInjectionEvidenceBoundary,
  sandboxDenials,
  sessionContinuity,
  structuredSlotFollowup,
  visibleToolPlanBoundary
} from "./eval-cases.js";

export const evalCategories = [
  "grounding",
  "prepare-confirm",
  "natural-confirm",
  "sandbox",
  "skill-proposal",
  "prompt-injection",
  "profile-boundary",
  "session-continuity",
  "intent-clarification",
  "context-advisory",
  "tool-planning",
  "response-synthesis"
] as const;

export type EvalCategory = (typeof evalCategories)[number];

export type EvalCaseResult = {
  id: string;
  category: EvalCategory;
  passed: boolean;
  details?: string;
};

export type EvalRunResult = {
  ok: boolean;
  passed: number;
  failed: readonly EvalCaseResult[];
  results: readonly EvalCaseResult[];
  audit: {
    events: readonly SafetyAuditEvent[];
    jsonl: string;
  };
};

export async function runMvpEvals(): Promise<EvalRunResult> {
  const writer = createSafetyAuditJsonlWriter();
  const results: EvalCaseResult[] = [];

  for (const evalCase of evalCases(writer)) {
    try {
      await evalCase.run();
      results.push({ id: evalCase.id, category: evalCase.category, passed: true });
    } catch (error) {
      results.push({
        id: evalCase.id,
        category: evalCase.category,
        passed: false,
        details: error instanceof Error ? error.message : "unknown eval failure"
      });
    }
  }

  const jsonl = writer.flush();
  const failed = results.filter((result) => !result.passed);
  if (failed.length === 0) assertRedactedAudit(jsonl);

  return {
    ok: failed.length === 0,
    passed: results.length - failed.length,
    failed,
    results,
    audit: { events: writer.events(), jsonl }
  };
}

function evalCases(writer: SafetyAuditJsonlWriter): readonly { id: string; category: EvalCategory; run: () => Promise<void> }[] {
  return [
    { id: "grounded-availability", category: "grounding", run: () => groundedAvailability(writer) },
    { id: "prepare-confirm-audit-chain", category: "prepare-confirm", run: () => prepareConfirm(writer) },
    { id: "natural-confirm-no-mutation", category: "natural-confirm", run: () => naturalConfirm(writer) },
    { id: "sandbox-high-risk-denials", category: "sandbox", run: () => sandboxDenials(writer) },
    { id: "admin-skill-proposal-audit-chain", category: "skill-proposal", run: () => adminSkillProposal(writer) },
    { id: "prompt-injection-no-profile-escalation", category: "prompt-injection", run: () => promptInjection(writer) },
    { id: "profile-boundary-tools", category: "profile-boundary", run: () => profileBoundary(writer) },
    { id: "session-continuity-redacted", category: "session-continuity", run: () => sessionContinuity(writer) },
    { id: "intent-focused-clarification", category: "intent-clarification", run: () => focusedClarification() },
    { id: "structured-slot-followup-rereads-pms", category: "session-continuity", run: () => structuredSlotFollowup(writer) },
    { id: "context-advisory-not-pms-truth", category: "context-advisory", run: () => contextAdvisoryNotTruth() },
    { id: "prompt-injection-no-uncited-pms-facts", category: "prompt-injection", run: () => promptInjectionEvidenceBoundary(writer) },
    { id: "visible-tool-plan-boundary", category: "tool-planning", run: () => visibleToolPlanBoundary(writer) },
    { id: "llm-plan-pms-read-grounded", category: "tool-planning", run: () => llmPlanPmsReadGrounded(writer) },
    { id: "llm-plan-raw-tool-rejected", category: "tool-planning", run: () => llmPlanRawToolRejected(writer) },
    { id: "llm-plan-non-visible-tool-rejected", category: "tool-planning", run: () => llmPlanNonVisibleToolRejected(writer) },
    { id: "llm-plan-natural-confirm-no-mutation", category: "tool-planning", run: () => llmPlanNaturalConfirmNoMutation(writer) },
    { id: "llm-fact-text-requires-evidence", category: "response-synthesis", run: () => llmFactTextRequiresEvidence(writer) },
    { id: "llm-plan-before-keyword-fallback", category: "tool-planning", run: () => llmPlanBeforeKeywordFallback(writer) }
  ];
}

function assertRedactedAudit(jsonl: string): void {
  for (const raw of [
    "tenant_1",
    "session_secret",
    "actor_secret",
    "admin_secret",
    "room_secret",
    "pending_secret",
    "PRIVATE_TOKEN",
    "PMS_PAYLOAD",
    "guest_name",
    "feishu_open_id"
  ]) {
    assert(!jsonl.includes(raw), `audit JSONL leaked raw value: ${raw}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runEvalCli(): Promise<void> {
  const result = await runMvpEvals();
  const failed = result.failed.map((item) => `${item.id}: ${item.details ?? "failed"}`).join("\n");
  console.log(JSON.stringify({ ok: result.ok, passed: result.passed, total: result.results.length, auditEvents: result.audit.events.length }, null, 2));
  if (!result.ok) {
    if (failed) console.error(failed);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runEvalCli();
}
