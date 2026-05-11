# Agent 优先 React Monorepo Roadmap V1

状态：draft
范围：在 `pms-agent-v2` monorepo 内推进自有 React 手机前端
日期：2026-05-11
来源产品文档：`docs/prod/agent-first-mobile-pms-product-v1.md`

## 1. 技术共识

当前项目可以干净推进自有前端，但必须按新产品边界推进，不能把移动前端伪装成 Feishu adapter，也不能把 PMS 真相逻辑搬到前端。

目标 monorepo 形态：

```text
pms-agent-v2
  apps/
    agent-service/        # 现有 Agent runtime，继续保留 Feishu/eval turn
    product-gateway/      # 新增：移动产品 BFF / Agent Gateway
    mobile-web/           # 新增：React + Vite + Tailwind CSS + shadcn/ui 手机前端
  packages/
    product-contracts/    # 新增：移动端 AgentTask/ActionCard 合约
    adapter-contracts/    # 现有：Feishu/AgentResult 基础合约
    unified-agent/        # 现有：LLM/Agent 编排
    pms-platform-client/  # 现有：PMS evidence client
```

`pms-platform` 继续只做 PMS truth/read model/workflow/audit/idempotency，不放 React 前端。

前端技术组合固定为：

- `React`
- `Vite`
- `Tailwind CSS`
- `shadcn/ui`

UI 方向固定为极简移动工作台：少装饰、少层级、少文本说明，优先呈现 Agent Feed、任务卡、动作卡、状态和确认按钮。

## 2. 不变量

1. 移动端不能直接持有 PMS bearer token。
2. 移动端不能直接调用 `pms-platform` mutation API。
3. 移动端不能复用 `FeishuTurnInput` 伪装成 Feishu。
4. Agent 可以准备动作，但不能替代 PMS truth。
5. 最终 mutation 必须通过 typed action、Safety Gateway 或 pending-action callback。
6. React app 只依赖 `product-contracts` 和浏览器安全 API，不 import 后端 runtime。
7. 所有新增源码继续受 350 行 owner-bound 预算约束。
8. 新前端必须进入 monorepo build/test gate，不能成为游离应用。
9. UI 必须极简；不得做营销式 landing page、重装饰 hero、复杂大盘首页或多层卡片嵌套。

## 3. 当前前置状态

已具备：

- `pms-agent-v2` 已是 `pnpm` monorepo，workspace 覆盖 `apps/*` 和 `packages/*`。
- `pms-platform` 已有本地 HTTP + SQLite sandbox。
- `pms-platform` 已有房间、库存、预订、pending-action、保洁、维修、operation request 等 typed routes。
- `pms-agent-v2` 已有 LLM-first runtime、Safety Gateway、PMS evidence、approval card、audit JSONL。
- `docs/prod/agent-first-mobile-pms-product-v1.md` 已定义 Agent-first 手机产品形态。

需要先处理：

- 当前 `pms-agent-v2` 工作区已有多处未提交变更。正式实施前应先提交或归档当前 hardening 和产品文档变更。
- `pms-agent-v2` 的今日到店/离店 client 路由仍使用旧路径，需要对齐 `pms-platform` 当前路径：
  - `POST /v1/pms/reservations/today-arrivals`
  - `POST /v1/pms/reservations/today-departures`
- `AGENTS.md` 中门禁统计仍有历史数字漂移，建议在前端实施前同步。

## 4. Roadmap 总览

| 阶段 | 主题 | Owner boundary | 目标 |
| --- | --- | --- | --- |
| R0 | 基线清理 | repo hygiene | 清理工作区、对齐路由、更新门禁说明 |
| R1 | 产品合约 | `packages/product-contracts` | 定义移动 Agent contract |
| R2 | Product Gateway | `apps/product-gateway` | 建立 BFF/API 边界和 token custody |
| R3 | React 手机壳 | `apps/mobile-web` | 建立 React + Tailwind CSS + shadcn/ui 极简移动 shell |
| R4 | 只读 Agent Feed | gateway + mobile | 接 PMS read model 和 Agent feed |
| R5 | 预订草稿流 | gateway + mobile | 支持单房/团队 draft/quote/prepare-confirm |
| R6 | Typed mutation | gateway + mobile | 支持 pending-action confirm 与运营命令 |
| R7 | Review & Audit | gateway + mobile | 复盘、审计、ledger、基础运营治理 |

## 5. R0：基线清理

Owner boundary: repo hygiene

目标：

- 让当前仓库进入可审查、可回滚状态。
- 避免 React 变更和已有 hardening 变更混在一起。
- 修复移动端会立即踩到的 PMS route mismatch。

任务：

1. 提交或归档当前 AI-readiness hardening 变更。
2. 提交 `docs/prod/agent-first-mobile-pms-product-v1.md`。
3. 对齐 `pms-platform-client` 到店/离店路由。
4. 更新 `AGENTS.md` 中 `pnpm test` 的测试/eval 数字和 AI-readiness guard 描述。
5. 复跑完整门禁。

验证：

```bash
pnpm build
pnpm test
```

done_when:

- 工作区只剩下一批明确属于 R0 的变更。
- `pnpm test` 通过。
- 到店/离店 client routes 与 `pms-platform` manifest 一致。

## 6. R1：产品合约

Owner boundary: `packages/product-contracts`

目标：

- 定义移动 Agent 产品层合约，避免 React app 直接消费 Feishu-shaped contract。

新增包：

```text
packages/product-contracts/
  src/
    mobile-turn.ts
    agent-task.ts
    action-card.ts
    object-ref.ts
    ledger.ts
    index.ts
  package.json
  tsconfig.json
```

核心类型：

- `MobileAgentTurnInput`
- `MobileActorRole`
- `AgentTask`
- `AgentTaskStatus`
- `ActionCard`
- `ActionCardAction`
- `MutationStatus`
- `ConfirmationMode`
- `ObjectRef`
- `AgentLedgerEntry`

合约原则：

- 所有外部输入必须有 validator。
- 未验证 JSON 先用 `Record<string, unknown>`。
- 不使用 `as Partial<T>`。
- 不把 `FeishuTurnInput` 作为移动端输入。
- 不暴露 PMS token、raw prompt、raw tool stack trace。

验证：

```bash
pnpm build
pnpm test
```

done_when:

- `product-contracts` 可被 `mobile-web` 和 `product-gateway` 同时依赖。
- contract tests 覆盖 valid/invalid mobile turn、action card、object ref。
- `pnpm test` 通过。

## 7. R2：Product Gateway

Owner boundary: `apps/product-gateway`

目标：

- 建立移动前端唯一后端入口。
- 保管 PMS/Agent token。
- 把移动请求转成 Agent turn、PMS read model 或 typed action。

新增应用：

```text
apps/product-gateway/
  src/
    config.ts
    server.ts
    auth.ts
    routes/
      health-routes.ts
      mobile-turn-routes.ts
      task-routes.ts
      object-routes.ts
      review-routes.ts
    clients/
      agent-client.ts
      pms-platform-client.ts
    task-ledger.ts
    index.ts
  package.json
  tsconfig.json
```

第一批 API：

- `GET /health`
- `POST /api/mobile/turn`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `GET /api/objects/rooms/:roomId`
- `GET /api/review/shift-summary`

边界：

- Gateway 可以调用 `pms-agent-v2` `agent-service`。
- Gateway 可以调用 `pms-platform`。
- Gateway 不实现 PMS business rules。
- Gateway 不绕过 Safety Gateway 做高风险 mutation。
- Gateway 不把 bearer token 返回给浏览器。

验证：

```bash
pnpm --filter @pms-agent-v2/product-gateway build
pnpm test
```

done_when:

- Gateway 能返回 mock `AgentTask`。
- Gateway 能代理只读 room/dashboard/availability 查询。
- Auth/token custody 有最小测试。
- 没有浏览器端 token 暴露。

## 8. R3：React 手机壳

Owner boundary: `apps/mobile-web`

目标：

- 建立 React + Vite + Tailwind CSS + shadcn/ui 移动端 shell。
- 完成四个主导航入口。
- 固化极简 UI 基线。

新增应用：

```text
apps/mobile-web/
  src/
    app/
      App.tsx
      routes.tsx
    features/
      agent/
      tasks/
      objects/
      review/
    shared/
      api/
      components/
      layout/
      styles/
    main.tsx
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  components.json
```

前端技术栈：

- React 作为 UI 框架。
- Vite 作为 dev/build 工具。
- Tailwind CSS 作为样式系统。
- shadcn/ui 作为基础组件来源。
- lucide-react 作为图标来源。

导航：

- `Agent`
- `Tasks`
- `Objects`
- `Review`

设计要求：

- UI 必须极简，默认使用低装饰、低噪音、强任务聚焦的移动工作台风格。
- 第一屏是 `Today Agent Feed`。
- 不做 dashboard landing page。
- 不做营销式 hero。
- 控件面向手机单手操作。
- 使用 shadcn/ui 的 Button、Card、Badge、Tabs/Navigation、Dialog/Drawer、Sheet、Input、Textarea、Toast/Sonner 等基础组件。
- 使用 lucide-react 图标按钮、chips、bottom navigation、action cards。
- 卡片不嵌套卡片。
- 卡片圆角保持克制，不超过 8px，除非 shadcn/ui 默认 token 有明确要求。
- 文本不能溢出按钮或卡片。
- 不使用一色系大面积装饰。
- Tailwind utility 只表达布局和状态，不在组件内堆叠不可维护的样式逻辑。
- shadcn/ui 组件允许本地复制和定制，但不得引入与产品无关的大型设计系统。

验证：

```bash
pnpm --filter @pms-agent-v2/mobile-web build
pnpm --filter @pms-agent-v2/mobile-web test
pnpm test
```

done_when:

- React app 能启动。
- 四个 tab 可导航。
- Agent Feed 可展示 mock cards。
- Tailwind CSS 生效。
- shadcn/ui 至少落地 Button/Card/Badge 三类基础组件。
- build 通过。

## 9. R4：只读 Agent Feed

Owner boundary: product read orchestration

目标：

- 将 `Today Agent Feed` 接入真实 PMS read model。
- 先做 read-only，避免过早引入 mutation 风险。

接入能力：

- hotel profile。
- room type catalog。
- dashboard。
- room。
- reservations get。
- today arrivals。
- today departures。
- inventory summary。
- room reservation context。
- availability search。

移动端体验：

- 用户输入自然语言。
- Gateway 创建 mobile turn。
- Agent/Gateway 返回 read-only `AgentTask`。
- Feed 展示 evidence-backed cards。
- 没有 evidence 的 PMS 事实不能显示为确定结果。

验证：

```bash
pnpm --filter @pms-agent-v2/product-gateway test
pnpm --filter @pms-agent-v2/mobile-web test
pnpm test
```

done_when:

- 可用房、房态、到店、离店、预订查询都能形成 feed card。
- 每个事实卡都有 evidence refs。
- 没有 PMS mutation。

## 10. R5：预订草稿工作流

Owner boundary: reservation workflow cards

目标：

- 支持单房和团队预订工作流，但停在 prepare-confirm / pending-action card。

接入能力：

- `reservation-drafts/create`
- `reservation-drafts/update`
- `reservation-drafts/quote`
- `reservation-drafts/prepare-confirm`
- `reservation-group-drafts/create`
- `reservation-group-drafts/update`
- `reservation-group-drafts/quote`
- `reservation-group-drafts/prepare-confirm`
- `pending-actions/status`

移动端体验：

- Agent 补槽。
- 显示候选房。
- 显示 draft 状态。
- 显示 quote capability gap。
- 显示 pending-action card。
- 明确显示“尚未最终创建预订”。

验证：

```bash
pnpm test
```

done_when:

- 单房预订 journey 可从自然语言走到 pending-action card。
- 团队预订 journey 可从自然语言走到 pending-action card。
- 不调用 confirm/cancel。
- UI 不展示 raw draftId。

## 11. R6：Typed Mutation

Owner boundary: explicit action execution

目标：

- 支持明确卡片确认下的 PMS mutation。

接入能力：

- `pending-actions/confirm`
- `pending-actions/cancel`
- `check-in`
- `check-out`
- `housekeeping/done`
- `housekeeping/inspection`
- `housekeeping/rework`
- `maintenance/report`
- `maintenance/done`
- `maintenance/restore-sellable`

移动端体验：

- 所有 mutation 先展示 dry-run 或 prepare card。
- 用户必须点击/滑动明确确认。
- 结果展示 committed/rejected/failed/expired。
- 所有 mutation 记录 ledger。

验证：

```bash
pnpm test
```

done_when:

- 单房和团队 pending-action confirm 都可展示 committed/rejected。
- 入住、退房、保洁、维修动作都有明确确认卡。
- 自然语言确认不会触发 mutation。

## 12. R7：Review、审计和治理

Owner boundary: retrospective review

目标：

- 把 Review 做成复盘和治理入口，而不是主工作台。

能力：

- Agent task ledger。
- Safety audit readback。
- PMS audit/event summary。
- Shift summary。
- failed/rejected action review。
- manager filter。

移动端体验：

- 经理能按班次查看完成动作。
- 能看到每个动作的 evidence、audit、确认人和时间。
- 能过滤 failed/rejected/expired。

验证：

```bash
pnpm test
```

done_when:

- Review tab 能展示班次总结。
- 每条记录可追溯到 task/evidence/audit。
- 报表不成为主操作入口。

## 13. 门禁策略

根命令最终应覆盖新前端：

```bash
pnpm build
pnpm test
```

建议新增脚本：

```json
{
  "build:gateway": "pnpm --filter @pms-agent-v2/product-gateway build",
  "build:mobile": "pnpm --filter @pms-agent-v2/mobile-web build",
  "test:gateway": "pnpm --filter @pms-agent-v2/product-gateway test",
  "test:mobile": "pnpm --filter @pms-agent-v2/mobile-web test"
}
```

`guard:ai-readiness` 应继续扫描：

- `apps/product-gateway/src/**/*.ts`
- `apps/mobile-web/src/**/*.ts`
- `apps/mobile-web/src/**/*.tsx`
- `packages/product-contracts/src/**/*.ts`

## 14. UI 工程约束

React 前端必须遵守：

- 技术栈固定为 `React + Tailwind CSS + shadcn/ui`。
- UI 必须极简：优先信息密度、状态清晰、动作明确；避免大面积装饰、渐变背景、营销式首屏和复杂图表首页。
- 组件按 feature 拆分。
- 单文件接近 350 行前必须拆 owner-bound module。
- API client、schema、UI 组件、状态管理分离。
- 不在 React 组件中硬编码 PMS business rules。
- 不在浏览器保存 PMS/Agent 服务 token。
- 不在 UI 中展示 raw stack trace、raw prompt、raw tool payload。
- Action card 的 mutation status 必须由后端 contract 提供。
- shadcn/ui 组件按需引入，组件代码归属 `shared/components/ui`。
- Tailwind class 过长或重复时抽到 owner-bound 组件，不创建全局杂物样式文件。

## 15. 风险和缓解

### 风险：前端直接变成 PMS API 拼装器

缓解：

- React app 只调用 Product Gateway。
- Gateway 做移动产品 orchestration。
- PMS business truth 仍在 `pms-platform`。

### 风险：移动端继续沿用 Feishu contract

缓解：

- R1 必须新增 `MobileAgentTurnInput`。
- `/api/mobile/turn` 不接受 `channel: "feishu"`。

### 风险：React app 污染现有 build/test

缓解：

- 每个 app 独立 `tsconfig`。
- root `pnpm test` 包含 mobile/gateway gate。
- 组件和 tests 受 AI-readiness guard 管理。

### 风险：Agent 结果还是纯文本

缓解：

- R1 定义 `AgentTask` 和 `ActionCard`。
- R2 Gateway 做 text-to-card 包装的过渡层。
- 后续再让 Agent runtime 原生输出移动任务结构。

### 风险：过早做报表

缓解：

- R4-R6 聚焦 Agent Feed 和动作卡。
- R7 才做 Review。

## 16. 推荐立即执行顺序

1. 完成 R0，确保当前仓库干净。
2. 建 `packages/product-contracts`，先不碰 React。
3. 建 `apps/product-gateway`，跑通 mock mobile turn。
4. 建 `apps/mobile-web`，用 mock contract 做手机壳。
5. 接 PMS read-only feed。
6. 接预订草稿和 pending-action。
7. 接 typed mutation。
8. 做 Review。

## 17. 成功标准

第一版成功不是“页面多”，而是：

- 手机端第一屏就是 Agent Feed。
- 用户可以用自然语言发起工作。
- Agent 返回结构化 ActionCard。
- PMS 事实都有 evidence。
- 高风险 mutation 都有明确确认。
- 所有结果可回看、可审计、可复盘。

如果这条线成立，后续再扩展报表、push、语音、离线和多角色权限。
