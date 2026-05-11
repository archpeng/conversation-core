# Agent 优先移动 PMS 产品文档 V1

状态：draft
范围：面向手机客户端的一整套专用 PMS 前端产品定义
日期：2026-05-11

## 1. 产品判断

这个产品不应该被定义为“传统 PMS 前端 + AI 助手侧栏”。

更准确的形态是：

> 一个以 Agent 为主服务界面的移动酒店运营系统。用户通过自然语言表达现场意图，Agent 读取 PMS 真相、生成可执行任务卡、补齐缺失信息、展示风险和证据，并在需要真实修改 PMS 状态时要求明确确认。

报表不是第一屏，也不是主要工作入口。报表的定位应降级为回顾、审计、班次复盘和管理分析。

## 2. 产品定位

占位产品名：`PMS Agent Mobile`

一句话定位：

> 面向酒店一线运营的移动 Agent 工作台，用自然语言和任务卡完成预订、入住、退房、保洁、维修和审批，并由 PMS 平台提供事实、状态变化、审计和幂等保障。

产品是：

- 移动优先。
- Agent 优先。
- PMS 真相源驱动。
- 任务卡和动作卡驱动。
- 高风险动作显式确认。
- 可审计、可回放、可复盘。

产品不是：

- 通用 BI 看板。
- 纯聊天机器人。
- 低代码 PMS 配置平台。
- PMS 真相源替代品。
- 用自然语言绕过审批和安全门禁的入口。

## 3. 核心原则

### 3.1 Agent 是第一屏

用户打开 App 后首先看到的是 `Today Agent Feed`，而不是房态图、报表或菜单。

第一屏回答：

- 现在有什么需要处理？
- Agent 已经准备好了哪些动作？
- 哪些事项需要我确认？
- 哪些事项阻塞了？
- 哪些 PMS 状态刚刚变化？

### 3.2 自然语言发起工作，结构化卡片完成工作

用户可以说：

- “明天帮李女士订两间花园别墅。”
- “A2 客人到了，办理入住。”
- “1001 已退房，安排保洁。”
- “客人说空调坏了，先停售并建维修。”
- “今天还有哪些预离没处理？”

但最终执行不能靠一句“好的”或“确认”。最终必须落到结构化动作卡，例如：

- `创建预订草稿`
- `选择候选房间`
- `准备确认卡`
- `确认 pending action`
- `办理入住`
- `确认退房`
- `标记保洁完成`
- `上报维修并停售`

### 3.3 PMS 真相不能来自模型

Agent 可以解释、总结和建议，但以下事实必须来自 `pms-platform`：

- 房态。
- 库存。
- 可用房。
- 预订。
- 到店/离店。
- pending action。
- 保洁任务。
- 维修状态。
- operation request。

### 3.4 每张卡都显示 mutation 边界

每个可执行动作都必须明确告诉用户：

- 是否只读。
- 是否只是草稿。
- 是否等待确认。
- 是否已经提交。
- 是否被 PMS 拒绝。
- 是否过期。
- 是否会真实修改 PMS 状态。

### 3.5 报表是回顾功能

报表只回答：

- 今天做了什么？
- 哪些动作失败了？
- 哪些动作被谁确认？
- 哪些风险被 Agent 拦住？
- 哪些 PMS 变化来自哪个 evidence 和 audit？

报表不是一线员工的主要工作路径。

## 4. 目标用户

### 4.1 前台

核心任务：

- 查可用房。
- 创建和继续预订。
- 处理到店和离店。
- 办理入住和退房。
- 处理预订冲突。
- 回答住客运营问题。

产品要求：

- 少输入。
- 快速补槽。
- 直接看到下一步。
- PMS 接受/拒绝状态清晰。
- 高风险动作必须确认。

### 4.2 保洁

核心任务：

- 查看待清洁任务。
- 标记清洁完成。
- 处理检查通过/失败。
- 处理返工。

产品要求：

- 卡片简单。
- 大按钮。
- 少文字。
- 弱网状态清楚。

### 4.3 维修

核心任务：

- 接收维修问题。
- 标记维修完成。
- 恢复可售。
- 理解房间停售影响。

产品要求：

- 房间上下文清晰。
- 维修状态明确。
- 未来可扩展图片、备注和现场证据。

### 4.4 经理

核心任务：

- 审批高风险动作。
- 查看待处理队列。
- 审计 Agent 行为。
- 查看班次总结。

产品要求：

- 异常优先。
- 可追溯。
- 能看到 evidence、audit、确认人和时间。

## 5. 手机端信息架构

底部导航建议保留四个入口。

### 5.1 Agent

主工作台。

包含：

- 文字输入。
- 语音输入。
- 快捷意图 chips。
- 今日 Agent feed。
- Agent 准备好的任务卡。
- 待确认动作卡。
- 最近完成动作。

这是主要工作路径。

### 5.2 Tasks

待办和异常队列。

包含：

- Pending confirmations。
- Operation requests。
- 保洁任务。
- 维修任务。
- 预订冲突。
- Agent 失败或被 PMS 拒绝的动作。

这是问责和异常处理路径。

### 5.3 Objects

对象查询和详情。

包含：

- 房间。
- 预订。
- 草稿。
- Pending action。
- Operation request。
- 保洁任务。
- 维修单。

它不是主要入口，只用于查对象和查看详情。

### 5.4 Review

回顾、审计和报表。

包含：

- 班次总结。
- 日结回顾。
- Agent action ledger。
- PMS mutation 历史。
- Safety audit。
- 失败动作和人工介入记录。

## 6. 第一屏：Today Agent Feed

第一屏应采用“运营流”结构，而不是大盘结构。

示例：

- `到店待处理`：李女士 14:00 到店，A2 可用。动作：`办理入住`。
- `预订确认`：2 间花园别墅已找到 A1/A2。动作：`准备确认卡`。
- `退房建议`：1001 已到预离时间。动作：`发起退房 dry-run`。
- `维修风险`：A3 空调维修中，建议保持停售。动作：`查看维修单`。
- `保洁队列`：1001 退房后将创建保洁任务。动作：`分配保洁`。

Feed item 状态：

- `suggested`
- `needs_slots`
- `draft_ready`
- `awaiting_confirmation`
- `committed`
- `rejected`
- `failed`
- `expired`

## 7. 核心交互模型

### 7.1 Intent Composer

输入方式：

- 文本。
- 语音。
- 快捷意图。
- 房间、预订、日期等上下文 chips。

Composer 不直接调用 PMS mutation。它只创建一次 Agent turn。

### 7.2 Agent 响应结构

移动端不应该只消费纯文本。

建议 Agent/BFF 返回：

- `message`：简短自然语言说明。
- `cards`：一个或多个结构化卡片。
- `nextActions`：可执行下一步。
- `evidenceRefs`：PMS evidence 引用。
- `auditRefs`：Safety/PMS audit 引用。
- `objectRefs`：房间、预订、pending action、operation request 等对象引用。

### 7.3 Action Card

每张动作卡必须展示：

- 动作名称。
- 目标对象。
- 当前状态。
- 建议状态。
- mutation 状态。
- 风险等级。
- 确认方式。
- PMS evidence 摘要。
- 主按钮。
- 次按钮，例如取消、编辑、稍后处理。

示例：

```text
准备确认：团队预订
客人：李女士
房型：花园别墅
数量：2
日期：2026-05-12 -> 2026-05-14
候选房：A1, A2
状态：draft_ready
影响：尚不创建最终预订
下一步：生成 typed confirmation
```

### 7.4 确认模式

允许：

- 点击明确按钮。
- 滑动确认。
- 经理审批卡。
- typed callback handoff。

禁止：

- 把“好的”当作审批。
- 把“确认”这类自然语言当作最终 mutation 授权。
- Agent 根据语气推断 approval。
- 高风险 PMS 动作后台自动确认。

## 8. 核心旅程

### 8.1 可用房到预订草稿

用户：

> 明天帮李女士订两间花园别墅。

Agent 流程：

1. 解析客人、日期、房型、数量。
2. 调用 PMS availability search。
3. 创建团队预订草稿。
4. 缺槽时只问缺失项。
5. 展示候选房间。
6. quote。
7. prepare-confirm。
8. 展示 pending-action 卡片。

mutation 边界：

- draft 和 prepare-confirm 是工作流状态。
- 最终预订只在 typed pending-action confirm 后 materialize。

### 8.2 到店入住

用户：

> A2 客人到了，办理入住。

Agent 流程：

1. 读取房间和预订上下文。
2. 校验房态、清洁状态、可售状态。
3. 运行 check-in dry-run。
4. 展示当前状态和下一状态。
5. 用户显式确认。
6. 展示 committed 结果。

### 8.3 退房到保洁

用户：

> 1001 退房了。

Agent 流程：

1. 读取房间和在住上下文。
2. 运行 checkout dry-run。
3. 展示退房后的房态变化和保洁任务预览。
4. 用户显式确认退房。
5. 展示 committed 房态和保洁任务。

### 8.4 维修与停售

用户：

> A3 空调坏了，先停售。

Agent 流程：

1. 读取房态。
2. 准备维修上报。
3. 说明 sale status 影响。
4. 用户确认维修上报。
5. 展示维修单和房间可售状态。

### 8.5 班次复盘

经理打开 `Review`。

Agent 生成：

- 完成入住。
- 完成退房。
- 新增预订。
- 失败动作。
- 被拒绝动作。
- 待人工处理。
- 仍未清洁房间。
- 仍停售房间。
- 审计异常。

## 9. 当前后端能力映射

### 9.1 PMS 真相层：pms-platform

`pms-platform` 当前可作为移动产品的 PMS 后端真相源。

已具备：

- 本地 HTTP 服务。
- SQLite sandbox 持久化。
- 房间读模型。
- dashboard 读模型。
- 酒店 profile。
- 房型 catalog。
- 预订查询。
- 今日到店/离店。
- 房间预订上下文。
- 库存 summary 和 intervals。
- 可用房搜索。
- 单房预订草稿。
- 团队预订草稿。
- quote。
- prepare-confirm。
- pending-action status/confirm/cancel。
- check-in/check-out。
- 保洁完成、检查、返工。
- 维修上报、完成、恢复可售。
- operation request create/get/list/update。
- audit、event、idempotency、projection outbox。

可直接消费的主要路由：

- `POST /v1/pms/room`
- `POST /v1/pms/dashboard`
- `POST /v1/pms/hotel/profile`
- `POST /v1/pms/room-types/catalog`
- `POST /v1/pms/reservations/get`
- `POST /v1/pms/reservations/today-arrivals`
- `POST /v1/pms/reservations/today-departures`
- `POST /v1/pms/room/reservation-context`
- `POST /v1/pms/inventory/intervals`
- `POST /v1/pms/inventory/summary`
- `POST /v1/pms/availability/search`
- `POST /v1/pms/reservation-drafts/create`
- `POST /v1/pms/reservation-drafts/update`
- `POST /v1/pms/reservation-drafts/quote`
- `POST /v1/pms/reservation-drafts/prepare-confirm`
- `POST /v1/pms/reservation-drafts/cancel`
- `POST /v1/pms/reservation-group-drafts/create`
- `POST /v1/pms/reservation-group-drafts/update`
- `POST /v1/pms/reservation-group-drafts/quote`
- `POST /v1/pms/reservation-group-drafts/prepare-confirm`
- `POST /v1/pms/reservation-group-drafts/cancel`
- `POST /v1/pms/pending-actions/status`
- `POST /v1/pms/pending-actions/confirm`
- `POST /v1/pms/pending-actions/cancel`
- `POST /v1/pms/check-in`
- `POST /v1/pms/check-out`
- `POST /v1/pms/housekeeping/done`
- `POST /v1/pms/housekeeping/inspection`
- `POST /v1/pms/housekeeping/rework`
- `POST /v1/pms/maintenance/report`
- `POST /v1/pms/maintenance/done`
- `POST /v1/pms/maintenance/restore-sellable`
- `POST /v1/pms/operation-requests/create`
- `POST /v1/pms/operation-requests/get`
- `POST /v1/pms/operation-requests/list`
- `POST /v1/pms/operation-requests/update`

### 9.2 Agent 服务层：pms-agent-v2

`pms-agent-v2` 当前应作为移动 Agent 服务入口，而不是 PMS 真相源。

已具备：

- LLM-first turn handling。
- Safety Gateway。
- PMS evidence 包装。
- Gated PMS tools。
- 预订准备和审批卡工作流。
- runtime safety audit JSONL。
- session continuity。
- admin customization/workspace proposal 工具。

当前服务路由：

- `GET /health`
- `POST /v1/feishu-turn`
- `POST /v1/eval-turn`

## 10. 推荐系统架构

移动端不应直接调用 `pms-platform` 并持有后端 bearer token。

推荐：

```text
Mobile App
  -> Product BFF / Agent Gateway
      -> pms-agent-v2
          -> Safety Gateway
          -> pms-platform-client
      -> pms-platform
          -> typed PMS routes
          -> SQLite/local or future production store
```

BFF/Gateway 负责：

- 用户认证。
- 移动端 session。
- RBAC。
- PMS/Agent token 保管。
- CORS。
- Push token 注册。
- 请求 correlation。
- 移动端响应结构整理。
- Agent task ledger 查询。

规则：

- 手机端调用 BFF，不直接调用 PMS Platform。
- Agent 负责理解、计划、解释和准备动作。
- PMS Platform 负责事实、状态变化、审计和幂等。
- 最终 mutation 必须通过 typed action 或 pending-action callback。
- 报表来自 PMS read model、audit、event、ledger，不来自 LLM 自由总结。

## 11. 移动端领域对象

### 11.1 AgentTask

表示 Agent 准备的一项工作。

字段：

- `taskId`
- `status`
- `intentText`
- `profile`
- `createdAt`
- `updatedAt`
- `summary`
- `cards`
- `evidenceRefs`
- `auditRefs`
- `objectRefs`
- `nextActions`

### 11.2 ActionCard

表示一个可执行动作。

字段：

- `cardId`
- `actionType`
- `riskLevel`
- `mutationStatus`
- `confirmationMode`
- `target`
- `currentState`
- `proposedState`
- `evidenceSummary`
- `primaryAction`
- `secondaryActions`

### 11.3 ObjectRef

表示 PMS 对象引用。

类型：

- `room`
- `reservation`
- `reservationDraft`
- `reservationGroupDraft`
- `pendingAction`
- `operationRequest`
- `housekeepingTask`
- `maintenanceTicket`

### 11.4 AgentLedgerEntry

表示一次 Agent 步骤记录。

字段：

- `entryId`
- `taskId`
- `step`
- `outcome`
- `toolName`
- `pmsOperation`
- `auditId`
- `evidenceRef`
- `errorCode`
- `createdAt`

## 12. MVP 范围

### 12.1 Must Have

- Agent tab。
- 文本 intent composer。
- Agent feed。
- Action card。
- 可用房查询。
- 单房预订草稿。
- 团队预订草稿。
- quote。
- prepare-confirm。
- pending-action status/confirm/cancel 卡片。
- 房间查询。
- 今日到店/离店。
- check-in dry-run + confirm。
- checkout dry-run + confirm。
- 保洁 done/inspection。
- 维修 report/restore sellable。
- operation request list/detail。
- Review tab：班次总结和审计轨迹。

### 12.2 Should Have

- 语音输入。
- pending confirmation push。
- 经理筛选。
- 弱网提交状态。
- 对象搜索。
- 基础角色导航。

### 12.3 Not in MVP

- 支付。
- 房价计划。
- 真实报价引擎。
- 发票。
- 财务对账。
- OTA/channel manager。
- 完整多物业 SaaS 管理后台。
- 通用报表构建器。
- 通用 workflow builder。
- 原始 SQL 或 raw data explorer。

## 13. 关键风险

### 13.1 纯聊天 UI 不安全

缓解：

- 所有可执行动作都用 typed action card。
- 自然语言确认不等于审批。
- 每张卡显示 mutation status。

### 13.2 Agent 幻觉被误认为 PMS 真相

缓解：

- 每个事实答案展示 PMS evidence。
- UI 区分 Agent explanation 和 PMS read model。
- 没有 evidence 的事实不能展示为确定事实。

### 13.3 手机端被中断后状态丢失

缓解：

- 持久化 AgentTask。
- 持久化 ActionCard 状态。
- 所有提交显示 submitted/accepted/rejected。
- 使用 idempotency key 和 correlation id。

### 13.4 手机端泄露后端 token

缓解：

- 增加 BFF。
- 手机端不保存 PMS bearer token。
- 只保存用户级 session token。

### 13.5 产品被报表牵引成传统 PMS

缓解：

- Review 放在第四 tab。
- Agent Feed 保持第一屏。
- 报表只做复盘和治理。

### 13.6 到店/离店路由存在集成缝隙

当前发现：

- `pms-platform` 使用 `POST /v1/pms/reservations/today-arrivals`。
- `pms-platform` 使用 `POST /v1/pms/reservations/today-departures`。
- 当前 `pms-agent-v2` client 仍有旧路由 `/v1/pms/arrivals/today` 和 `/v1/pms/departures/today`。

缓解：

- 在移动 Agent 流程正式使用今日到店/离店前，先对齐 `pms-agent-v2` client 路由。

## 14. 实施切片

### P0：移动产品契约

目标：

- 定义移动端 `AgentTask`、`ActionCard`、`ObjectRef`、`AgentLedgerEntry`。

完成条件：

- BFF 可以返回 mock AgentTask。
- 移动原型可以渲染 feed、卡片详情和 review entry。

### P1：只读 Agent Feed

目标：

- 从 PMS read model 渲染 Agent Feed。

完成条件：

- 用户可以问可用房、房态、到店、离店、预订查询。
- 每个事实答案都有 PMS evidence。

### P2：预订草稿工作流

目标：

- 支持单房和团队预订草稿。

完成条件：

- 支持 create/update/quote/prepare-confirm。
- 最终 mutation 仍被 pending-action card 阻断。

### P3：Typed Confirmation

目标：

- 支持 pending-action confirm/cancel。

完成条件：

- 单房和团队确认都通过 `pms-platform` materialize。
- UI 展示 committed/rejected/expired。

### P4：运营命令

目标：

- 增加入住、退房、保洁、维修动作。

完成条件：

- 每个 mutation 命令都有 dry-run preview 和 confirm card。

### P5：复盘与审计

目标：

- 增加 shift review、audit、Agent task ledger。

完成条件：

- 经理可查看已完成动作、失败动作、evidence refs、audit refs。

## 15. 待决策问题

1. 第一个客户端使用 Native、React Native，还是 mobile web？
2. 语音输入是否进入 MVP？
3. BFF 放在新 repo、本 repo，还是靠近 `pms-platform`？
4. 第一批角色只做前台，还是前台 + 经理？
5. 是扩展 `pms-agent-v2` 的 `AgentResult`，还是由 BFF 包装成移动端专用 contract？
6. Push 先走 Feishu，还是手机原生 push？
7. 是否要在 MVP 中支持离线队列，还是只支持弱网状态提示？

## 16. 当前可行性判断

当前后端能力足以启动专用移动端产品原型。

已经具备：

- PMS read models。
- Availability search。
- 单房/团队 reservation draft workflow。
- Pending-action confirmation semantics。
- Check-in/check-out。
- Housekeeping/maintenance commands。
- Operation request queue。
- Safety Gateway。
- Runtime audit。
- SQLite local sandbox。

生产前必须补齐：

- Mobile BFF / Agent Gateway。
- Auth 和 RBAC。
- Token custody。
- 到店/离店路由对齐。
- 移动端 Agent task ledger。
- Push notification 策略。
- 生产部署和持久化策略。
- 前端 typed schema 或 SDK。

## 17. North Star

北极星体验：

> 酒店员工可以只拿手机值班：把现场发生的事告诉 Agent，检查 Agent 生成的结构化动作卡，只确认那些有 PMS 证据、有风险说明、符合权限边界的动作。

产品成功的标志：

- 用户不再以 PMS 模块为中心工作。
- 用户以运营意图为中心工作。
- Agent 帮用户准备动作，但不绕过 PMS 真相和确认边界。
- 管理者可以事后复盘每个动作的 evidence、audit 和确认链路。
