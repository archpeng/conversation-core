# PMS Agent V2 对话架构

状态：当前架构说明  
范围：`pms-agent-v2` 对话与运行时机制  
最后复核：2026-05-09

## 目标

`pms-agent-v2` 是飞书驱动的 PMS 智能助手。目标是让 LLM 先理解用户任务，再通过少数高信息密度的 PMS Pi custom tools 读取权威 PMS evidence、准备安全 workflow evidence，并由 response synthesis 输出 `AgentResult`。

核心顺序：

```text
LLM observes -> Pi native custom tools -> Safety Gateway -> pms-platform evidence -> response synthesis
```

Agent 不拥有 PMS 事实、不拥有权限决策，也不拥有最终 PMS 变更权。

## 单轮生命周期

1. `apps/agent-service` 校验 `FeishuTurnInput`，获取或创建 `UnifiedAgentSession`。
2. `runAgentTurn(...)` 记录脱敏 continuity。
3. `turnPrompt(...)` 注入 policy、continuity、advisory context、当前 profile 可见 Pi custom tools。
4. Pi/LLM 可直接调用一个或多个可见 PMS tools。
5. 每个 tool 都经过 `runGatedTool -> Safety Gateway -> runtime executor -> pms-platform-client -> audit`。
6. `runPiNativeToolResults(...)` 收集 `tool_execution_end` 的 evidence refs 和 pending-action refs。
7. `response-synthesis` 校验最终文本、审批卡、拒绝结果。
8. 只有当 LLM 失败或返回空文本时，才进入受限 deterministic fallback。

## Customer PMS Tool Surface

安全读能力：

- `pms_availability_search`
- `pms_inventory_summary`
- `pms_room_reservation_context`
- `pms_reservation_lookup`
- `pms_get_room`
- `pms_today_arrivals`
- `pms_today_departures`
- `pms_pending_action_status`

安全 workflow 能力：

- `pms_reservation_draft_create`
- `pms_reservation_draft_update`
- `pms_reservation_quote`
- `pms_reservation_prepare_confirm`
- `pms_reservation_group_draft_create`
- `pms_reservation_group_draft_update`
- `pms_reservation_group_quote`
- `pms_reservation_group_prepare_confirm`

`pms_availability_search` 的语义是“整个入住区间每天都可售的候选房”，不是“酒店总房数”。用户问为什么返回 12 间但酒店有 13 间时，LLM 应继续调用 `pms_inventory_summary` 后再回答。

`prepare_confirm` 只产生 typed approval card / pending-action evidence。最终 confirm/cancel 不作为自然语言工具暴露，只能走审批卡/网关。

## Safety Boundary

所有 PMS tools 都使用独立 capability ID 进入 Safety Gateway。runtime executor 只接收已允许的 `GatedToolRequest`，并通过 `pms-platform-client` 调 typed routes。当前 PMS facts 必须来自 `PmsEvidence<T>`；session memory、workspace、skills、用户原话和 model prior 不能替代 PMS evidence。

## Fallback Boundary

deterministic fallback 只在 LLM 不可用时运行。它可以做最小安全降级，例如 greeting 或 availability fallback；booking preparation 不在 fallback 中暗自编排，必须由可用 LLM 组合 safe workflow tools。
