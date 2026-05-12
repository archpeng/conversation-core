import type { PmsEvidence } from "@pms-agent-v2/pms-platform-client";
import type { RedactedSessionState } from "./continuity.js";

export type ContextAuthority = "mandatory_policy" | "pms_evidence" | "workspace_advisory" | "session_continuity" | "user_claim" | "model_prior";

export type ContextBundleItem = {
  readonly source: string;
  readonly authority: ContextAuthority;
  readonly summary: string;
  readonly evidenceRefs: readonly string[];
  readonly canAnswerCurrentPmsFact: boolean;
};

export type ContextBundle = {
  readonly items: readonly ContextBundleItem[];
};

export type WorkspaceAdvisoryContextInput = {
  readonly source: string;
  readonly summary: string;
  readonly evidenceRefs?: readonly string[];
};

export type BuildContextBundleInput = {
  readonly state: RedactedSessionState;
  readonly userMessage: string;
  readonly workspaceAdvisory?: readonly WorkspaceAdvisoryContextInput[];
  readonly pmsEvidence?: readonly PmsEvidence<unknown>[];
  readonly modelPriorSummary?: string;
};

const maxItems = 8;
const maxSummaryChars = 240;

// C3 contract note: context items are authority-labeled observations for prompt/tool planning.
// Workspace/session/user/model context is advisory only; current PMS facts require pms_evidence items.
export function buildContextBundle(input: BuildContextBundleInput): ContextBundle {
  const items: ContextBundleItem[] = [];
  items.push({
    source: "AGENTS.md#PMS Evidence Law",
    authority: "mandatory_policy",
    summary: "Current PMS facts require pms-platform evidence; advisory memory/workspace/session/user/model context is not fact authority.",
    evidenceRefs: [],
    canAnswerCurrentPmsFact: false
  });

  const sessionSummary = summarizeSession(input.state);
  if (sessionSummary) {
    items.push({
      source: "session.continuity",
      authority: "session_continuity",
      summary: sessionSummary,
      evidenceRefs: input.state.evidenceRefs,
      canAnswerCurrentPmsFact: false
    });
  }

  for (const advisory of input.workspaceAdvisory ?? []) {
    items.push({
      source: advisory.source,
      authority: "workspace_advisory",
      summary: cleanSummary(advisory.summary),
      evidenceRefs: advisory.evidenceRefs ?? [],
      canAnswerCurrentPmsFact: false
    });
  }

  for (const evidence of input.pmsEvidence ?? []) {
    items.push({
      source: `pms-platform:${evidence.source.method}`,
      authority: "pms_evidence",
      summary: cleanSummary(evidence.summary),
      evidenceRefs: [evidence.evidenceRef],
      canAnswerCurrentPmsFact: true
    });
  }

  if (input.userMessage.trim()) {
    items.push({
      source: "turn.user_message",
      authority: "user_claim",
      summary: cleanSummary(input.userMessage),
      evidenceRefs: [],
      canAnswerCurrentPmsFact: false
    });
  }

  if (input.modelPriorSummary?.trim()) {
    items.push({
      source: "model.prior",
      authority: "model_prior",
      summary: cleanSummary(input.modelPriorSummary),
      evidenceRefs: [],
      canAnswerCurrentPmsFact: false
    });
  }

  return { items: items.slice(0, maxItems) };
}

export function workspaceAdvisoryFromToolValue(value: unknown, fallbackSource = "workspace.safe_tool"): WorkspaceAdvisoryContextInput | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.authority !== "workspace_advisory" || record.canAnswerCurrentPmsFact !== false) return undefined;
  const file = record.file && typeof record.file === "object" ? record.file as Record<string, unknown> : undefined;
  const source = typeof file?.logicalPath === "string" ? file.logicalPath : fallbackSource;
  const content = typeof file?.content === "string" ? file.content : JSON.stringify(publicWorkspaceSummary(record));
  return { source, summary: cleanSummary(content), evidenceRefs: [] };
}

export function contextBundlePrompt(bundle: ContextBundle): string {
  return [
    "Authority-labeled context:",
    ...bundle.items.map((item) => [
      `- source=${item.source}`,
      `authority=${item.authority}`,
      `canAnswerCurrentPmsFact=${item.canAnswerCurrentPmsFact}`,
      `evidenceRefs=${item.evidenceRefs.join(",") || "none"}`,
      `summary=${item.summary}`
    ].join(" | "))
  ].join("\n");
}

function publicWorkspaceSummary(record: Record<string, unknown>): unknown {
  if (Array.isArray(record.skills)) return { skills: record.skills };
  if (record.proposal && typeof record.proposal === "object") return { proposal: record.proposal };
  return { authority: record.authority, canAnswerCurrentPmsFact: record.canAnswerCurrentPmsFact };
}

function summarizeSession(state: RedactedSessionState): string | undefined {
  const parts = [
    state.currentIntent ? `intent=${state.currentIntent}` : undefined,
    state.slots.length > 0 ? `slots=${state.slots.map((slot) => slot.name).join(",")}` : undefined,
    state.missingSlots.length > 0 ? `missing=${state.missingSlots.join(",")}` : undefined,
    state.pendingActionRefs.length > 0 ? `pendingRefs=${state.pendingActionRefs.length}` : undefined,
    state.evidenceRefs.length > 0 ? `evidenceRefs=${state.evidenceRefs.length}` : undefined,
    state.objectRefs.length > 0 ? `objectRefs=${state.objectRefs.map((ref) => `${ref.kind}:${ref.id}`).join(",")}` : undefined,
    state.safetyFlags.length > 0 ? `safety=${state.safetyFlags.join(",")}` : undefined
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? cleanSummary(parts.join("; ")) : undefined;
}

function cleanSummary(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/pms_ev_[A-Za-z0-9_:-]+/g, "pms_ev_redacted").trim().slice(0, maxSummaryChars);
}
