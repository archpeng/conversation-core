import type { AgentResult } from "@pms-agent-v2/adapter-contracts";
import type { GatedToolResult } from "@pms-agent-v2/gated-tools";
import type { UnifiedAgentProfile } from "./profile.js";
import type { PiToolDefinition, PiToolResult } from "./pi-session.js";

type RefusalReason = "policy" | "unsupported" | "invalid_request";

export type VisibleGatedToolManifestItem = {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
};

export type ToolPlanAction =
  | { readonly type: "call_tool"; readonly toolName: string; readonly params: Record<string, unknown> }
  | { readonly type: "ask_clarification"; readonly message: string }
  | { readonly type: "refuse"; readonly reason: RefusalReason; readonly message: string }
  | { readonly type: "require_approval"; readonly message: string };

export type ToolPlanValidationResult =
  | { readonly ok: true; readonly plan: ToolPlanAction }
  | { readonly ok: false; readonly reason: string };

export type ExecuteToolPlanResult =
  | { readonly ok: true; readonly toolResult: PiToolResult }
  | { readonly ok: false; readonly result: AgentResult };

const rawToolNames = new Set(["read", "write", "edit", "bash", "http", "http_request", "gated_http", "sandbox_bash"]);
const planTypes = ["call_tool", "ask_clarification", "refuse", "require_approval"] as const;
const refusalReasons: readonly RefusalReason[] = ["unsupported", "policy", "invalid_request"];

// C1 contract note: this module gives the LLM a bounded manifest and validates proposed actions.
// It does not execute raw tools or decide Safety Gateway policy; visible Pi tools remain gated wrappers.
export function buildVisibleGatedToolManifest(profile: UnifiedAgentProfile, tools: readonly PiToolDefinition[]): readonly VisibleGatedToolManifestItem[] {
  const visible = new Set(profile.visibleToolNames);
  return tools
    .filter((tool) => visible.has(tool.name) && !rawToolNames.has(tool.name))
    .map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
}

export function parseToolPlan(value: unknown, manifest: readonly VisibleGatedToolManifestItem[]): ToolPlanValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "tool_plan_object_required" };
  const record = value as Record<string, unknown>;
  if (!isAllowed(record.type, planTypes)) return { ok: false, reason: "invalid_tool_plan_type" };

  if (record.type === "call_tool") return parseCallToolPlan(record, manifest);
  if (record.type === "ask_clarification") return parseMessagePlan(record, "ask_clarification", "invalid_clarification_message");
  if (record.type === "require_approval") return parseMessagePlan(record, "require_approval", "invalid_approval_message");
  return parseRefusalPlan(record);
}

export async function executeToolPlan(plan: ToolPlanAction, tools: readonly PiToolDefinition[]): Promise<ExecuteToolPlanResult> {
  if (plan.type !== "call_tool") return { ok: false, result: planResult(plan) };
  const tool = tools.find((candidate) => candidate.name === plan.toolName);
  if (!tool) return { ok: false, result: { type: "refusal", reason: "unsupported", message: "Requested gated tool is not available." } };

  const toolResult = await tool.execute(`llm_plan_${plan.toolName}`, plan.params);
  const details = toolResult.details as Partial<GatedToolResult<unknown>>;
  if (details.outcome === "deny") return { ok: false, result: { type: "refusal", reason: "policy", message: "Requested action was denied by policy." } };
  if (details.outcome === "require_approval") return { ok: false, result: { type: "refusal", reason: "policy", message: "Requested action requires typed approval." } };
  return { ok: true, toolResult };
}

function parseCallToolPlan(record: Record<string, unknown>, manifest: readonly VisibleGatedToolManifestItem[]): ToolPlanValidationResult {
  if (typeof record.toolName !== "string") return { ok: false, reason: "invalid_tool_name" };
  if (rawToolNames.has(record.toolName)) return { ok: false, reason: "raw_tool_not_visible" };
  if (!manifest.some((tool) => tool.name === record.toolName)) return { ok: false, reason: "tool_not_visible" };
  if (!record.params || typeof record.params !== "object" || Array.isArray(record.params)) return { ok: false, reason: "invalid_tool_params" };
  return { ok: true, plan: { type: "call_tool", toolName: record.toolName, params: record.params as Record<string, unknown> } };
}

function parseMessagePlan<T extends "ask_clarification" | "require_approval">(
  record: Record<string, unknown>,
  type: T,
  invalidReason: string
): ToolPlanValidationResult {
  if (typeof record.message !== "string" || record.message.trim().length === 0) return { ok: false, reason: invalidReason };
  return { ok: true, plan: { type, message: record.message } };
}

function parseRefusalPlan(record: Record<string, unknown>): ToolPlanValidationResult {
  if (!isAllowed(record.reason, refusalReasons)) return { ok: false, reason: "invalid_refusal_reason" };
  if (typeof record.message !== "string" || record.message.trim().length === 0) return { ok: false, reason: "invalid_refusal_message" };
  return { ok: true, plan: { type: "refuse", reason: record.reason, message: record.message } };
}

function planResult(plan: Exclude<ToolPlanAction, { readonly type: "call_tool" }>): AgentResult {
  if (plan.type === "ask_clarification") return { type: "refusal", reason: "invalid_request", message: plan.message };
  if (plan.type === "require_approval") return { type: "refusal", reason: "policy", message: plan.message };
  return { type: "refusal", reason: plan.reason, message: plan.message };
}

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
