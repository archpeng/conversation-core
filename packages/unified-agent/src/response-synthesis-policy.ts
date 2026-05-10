import type { ResponseSynthesisInput } from "./response-synthesis.js";

// Output policy classifiers. Keep new business behavior in typed tools/evidence; add lexical checks here only for safety and evidence validation.
export function looksLikeCurrentPmsFactReply(text: string): boolean {
  return /PMS\s*(证据|evidence).*?(有|未查到|available|unavailable|priceCents|状态)/i.test(text)
    || /(有\s*\d+\s*个可订候选|未查到可订房型|可订的?房型|可选房型|可用房型|可住(房间|客房)|可用(房间|客房)|暂无可订|没有可订|空房\s*[:：]?\s*(有|无)|available\s*[:=]\s*(true|false))/i.test(text)
    || /(本酒店|酒店|PMS).*?(房型|客房类型).*?(配置|未配置|共有|包括|有)|房型.*?(未配置|已配置|共有|包括)/i.test(text)
    || /(PMS\s*)?(priceCents=\d+|价格\s*[:：=]\s*\d+|\d+\s*元)/i.test(text)
    || /(预订|订单|reservation|pending action|pendingActionStatus|room state|roomState).*?(状态为|status\s*[:=]|已确认|confirmed|已取消|cancelled)/i.test(text);
}

export function currentPmsEvidenceRefs(input: ResponseSynthesisInput): Set<string> {
  const refs = new Set<string>();
  for (const evidence of input.pmsEvidence ?? []) refs.add(evidence.evidenceRef);
  return refs;
}

export function claimsCompletedHighRiskMutation(text: string): boolean {
  return /(PMS|预订|订单|reservation|booking).*?(已确认|已取消|已完成|已执行|已写入|已更新|confirmed|cancelled|completed|mutated)/i.test(text);
}

export function containsUnsafeOutput(text: string): boolean {
  return /<\/?hidden_prompt>|tenant_access_token|authorization:\s*bearer|tool[_ -]?call|tool trace|stack trace|\b(room|pending|tenant|session|actor|message)_secret_[A-Za-z0-9_-]+\b/i.test(text);
}

export function cleanOutputText(text: string): string {
  return text.replace(/[\r\t]+/g, " ").trim();
}

export function uniqueRefs(refs: readonly string[]): string[] {
  return Array.from(new Set(refs.filter((ref) => typeof ref === "string" && ref.trim().length > 0)));
}
