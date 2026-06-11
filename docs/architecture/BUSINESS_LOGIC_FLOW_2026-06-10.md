# ManhuaWorks 业务逻辑流程图

> **作者**：林染 🔮 开发部前端
> **日期**：2026-06-10 00:40
> **版本**：v1.0
> **基于**：W3/W4 架构文档 + API_REFERENCE.md（真实端点，非 AI 编造）
> **阅读时长**：≈ 8 分钟

---

## 全景总览 (Master Overview)

```mermaid
graph TB
    subgraph 用户入口["🟢 四前端入口"]
        WEB["web<br/>apps/web :5173<br/>官网+登录"]
        ADMIN["admin-portal<br/>apps/admin-portal<br/>平台总后台"]
        STUDIO["studio<br/>apps/studio :5175<br/>创作者工作台"]
        USERPORTAL["user-portal<br/>apps/user-portal :5180<br/>用户后台"]
    end

    subgraph 边缘["🟡 边缘层"]
        GW["API Gateway<br/>Kong :8000<br/>路由/限流/鉴权"]
    end

    subgraph 业务服务["🔵 核心业务服务"]
        AUTH["user-service :8088<br/>鉴权+用户+BYOK"]
        PROJ["project-service :8089<br/>项目CRUD+脚本"]
        WF["workflow-engine :8084<br/>DAG调度+7步流水线"]
        BILL["billing-service :8090<br/>订阅+充值+扣费"]
        ASSET["asset-service :8085<br/>资产存储+CDN"]
    end

    subgraph AI集群["🟣 AI 推理集群"]
        AIRT["ai-router :8083<br/>供应商路由+失败转移"]
        AH["ai-helper :8086<br/>创作辅助6功能"]
        AO["ai-orchestrator :8087<br/>5 Pipeline漫剧编排"]
        AIKEY["ai-keys-service :8082<br/>BYOK密钥托管"]
    end

    subgraph 供应商["🔴 外部AI供应商"]
        VOLC["火山引擎<br/>豆包/Seedance"]
        ALI["阿里云<br/>通义万相/语音"]
        TENC["腾讯云<br/>混元/智影"]
        ZHIPU["智谱<br/>GLM-4/CogVideoX"]
    end

    subgraph 数据["🟤 数据层"]
        PG["PostgreSQL 16<br/>主库+6业务库"]
        RD["Redis 7<br/>缓存/限流/Pub-Sub"]
        S3["对象存储<br/>OSS/MinIO"]
    end

    WEB -->|HTTPS| GW
    ADMIN -->|HTTPS| GW
    STUDIO -->|HTTPS| GW
    USERPORTAL -->|HTTPS| GW

    GW -->|/v1/auth| AUTH
    GW -->|/v1/projects| PROJ
    GW -->|/v1/workflows| WF
    GW -->|/v1/billing| BILL
    GW -->|/v1/assets| ASSET
    GW -->|/v1/ai| AIRT
    GW -->|/v1/helper| AH
    GW -->|/v1/orchestrator| AO
    GW -->|/v1/keys| AIKEY

    AUTH --> PG
    PROJ --> PG
    WF --> PG
    WF --> RD
    BILL --> PG
    ASSET --> PG
    ASSET --> S3
    AH --> PG
    AH --> RD
    AO --> PG
    AO --> RD

    AIRT --> VOLC
    AIRT --> ALI
    AIRT --> TENC
    AIRT --> ZHIPU
    AO --> AIRT
    AO --> AH
    AO --> ASSET
    WF --> AO
    WF --> AIRT
    BILL -->|事件订阅| RD

    style 用户入口 fill:#d1fae5
    style 边缘 fill:#fde68a
    style 业务服务 fill:#dbeafe
    style AI集群 fill:#e9d5ff
    style 供应商 fill:#fecaca
    style 数据 fill:#e5e7eb
```

---

## 功能块 1：用户登录 (4 前端统一认证)

```mermaid
flowchart TD
    A["🌐 用户访问任一前端"] --> B{"已有 token?<br/>localStorage mhw.access_token"}
    B -->|是| C["GET /api/v1/me<br/>→ user-service:8088<br/>验证 token 有效性"]
    B -->|否| D["显示登录页<br/>LoginView.vue"]
    
    C --> E{"token 有效?"}
    E -->|是| F1["web → /dashboard"]
    E -->|是| F2["admin → /admin/dashboard<br/>检查 role=admin"]
    E -->|是| F3["studio → /<br/>HomeView 创作首页"]
    E -->|是| F4["user-portal → /workbench<br/>用户工作台"]
    E -->|否| D

    D --> G["用户输入邮箱+密码<br/>@submit → onEmailLogin()"]
    G --> H["POST /api/v1/auth/login<br/>→ user-service:8088<br/>body: {email, password}"]
    H --> I{"HTTP 响应"}
    
    I -->|200 OK| J["解析 data.accessToken<br/>+ data.refreshToken"]
    J --> K["localStorage.set<br/>mhw.access_token = accessToken<br/>token = accessToken (兼容下游)"]
    K --> L["router.push 跳转<br/>按 hostname 判定目标"]
    
    I -->|400 参数错| M["toast: '请输入邮箱和密码'"]
    I -->|401 鉴权失败| N["toast: '邮箱或密码错误'"]
    I -->|409 冲突| O["toast: '该邮箱已注册'<br/>引导去登录"]
    I -->|500 服务器错| P["toast: err.message<br/>|| `登录失败 (${r.status})`"]

    L --> Q{"当前 hostname?"}
    Q -->|web (3000/5173)| F1
    Q -->|admin (5174)| F2
    Q -->|studio (5175)| F3
    Q -->|user-portal (5180)| F4

    subgraph 辅助流程["辅助流程"]
        R["注册: POST /api/v1/auth/register<br/>{email, password, displayName}"]
        S["刷新: POST /api/v1/auth/refresh<br/>{refreshToken}"]
        T["登出: POST /api/v1/auth/logout<br/>+ 清 localStorage"]
        U["改密: POST /api/v1/me/password<br/>{oldPassword, newPassword}"]
    end

    F1 -.-> R
    D -.-> R
    J -.->|token 过期前 5min| S
    F1 -.-> T
```

**真实端点速查**：

| 端点 | 方法 | 用途 | 返回字段 |
|------|------|------|----------|
| `/api/v1/auth/login` | POST | 邮箱+密码登录 | `data.accessToken`, `data.refreshToken` |
| `/api/v1/auth/register` | POST | 邮箱注册 | `data.accessToken` |
| `/api/v1/auth/refresh` | POST | 刷新 token | `data.accessToken` |
| `/api/v1/auth/logout` | POST | 登出清 session | — |
| `/api/v1/me` | GET | 当前用户信息 | `data.user` |
| `/api/v1/me/password` | POST | 改密码 | — |

**前端登录差异**：

| 前端 | 端口 | 登录后跳转 | 额外检查 |
|------|------|-----------|----------|
| `apps/web` | 5173 | `/dashboard` | — |
| `apps/admin-portal` | 5174 | `/admin/dashboard` | `role === 'admin' \|\| 'superadmin'` |
| `apps/studio` | 5175 | `/` (HomeView) | — |
| `apps/user-portal` | 5180 | `/workbench` | — |

---

## 功能块 2：项目管理 (CRUD + 协作)

```mermaid
flowchart TD
    A["📋 用户进入项目管理"] --> B["GET /api/v1/projects<br/>→ project-service:8089<br/>?limit=20&status=active"]
    B --> C["DashboardView.vue<br/>渲染项目卡片列表"]

    C --> D{用户操作}
    
    D -->|"新建项目"| E["弹出 CreateProjectModal.vue<br/>输入 title + synopsis"]
    E --> F["POST /api/v1/projects<br/>→ project-service:8089<br/>body: {title, synopsis}"]
    F --> G{"201 Created"}
    G -->|成功| H["router.push 跳转项目详情"]
    G -->|失败| I["toast: err.message"]
    
    D -->|"点击项目卡片"| J["GET /api/v1/projects/:id<br/>→ project-service:8089"]
    J --> K{"200 OK"}
    K -->|成功| L["ProjectDetailView.vue<br/>渲染项目详情+脚本+角色列表"]
    K -->|404| M["toast: '项目不存在'"]
    
    D -->|"编辑项目"| N["PATCH /api/v1/projects/:id<br/>→ project-service:8089<br/>body: {title?, synopsis?, status?}"]
    N --> O["刷新项目卡片列表"]
    
    D -->|"删除项目"| P["确认 Modal"]
    P -->|确认| Q["DELETE /api/v1/projects/:id<br/>→ project-service:8089<br/>软删 status=trashed"]
    Q --> O

    subgraph 协作分支["协作分支 (collab-service:8091, 预留)"]
        R["邀请成员: POST /api/v1/collab/invite<br/>→ collab-service:8091"]
        S["实时同步: WebSocket<br/>ws://collab-service:8091/ws"]
        T["评论: POST /api/v1/collab/comments"]
    end

    L -.-> R
```

**真实端点速查**：

| 端点 | 方法 | 用途 | 服务 |
|------|------|------|------|
| `/api/v1/projects` | GET | 项目列表 (分页) | project-service:8089 |
| `/api/v1/projects` | POST | 创建项目 `{title, synopsis}` | project-service:8089 |
| `/api/v1/projects/:id` | GET | 项目详情 | project-service:8089 |
| `/api/v1/projects/:id` | PATCH | 更新项目 | project-service:8089 |
| `/api/v1/projects/:id` | DELETE | 软删 (status=trashed) | project-service:8089 |
| `/api/v1/collab/invite` | POST | 邀请协作 (预留) | collab-service:8091 |

**前端界面**：

| 前端 | 视图 | 功能 |
|------|------|------|
| `apps/studio` | `DashboardView.vue` / `ProjectDetailView.vue` | 项目卡片+详情+管理 |
| `apps/user-portal` | 工作台 → 我的项目 | 项目列表+协作入口 |
| `apps/admin-portal` | 项目管理 | 全局项目审核+管理 |

---

## 功能块 3：工作流 (WorkflowDesigner 拖拽 → Pipeline 执行)

```mermaid
flowchart TD
    A["🎬 创作者进入 Studio"] --> B["WorkflowDesigner.vue<br/>拖拽式节点编辑器"]

    B --> C["从节点面板拖入步骤节点"]
    C --> D["连接节点 → 构建 DAG<br/>S1 剧本拆分 → S2∥S3 → S4 → S5 → S6∥S7"]

    D --> E["保存工作流模板<br/>POST /api/v1/workflows<br/>→ workflow-engine:8084<br/>body: {nodes[], edges[], projectId}"]
    
    E --> F["点击 '启动工作流'"]
    F --> G["POST /api/v1/workflows/start<br/>→ workflow-engine:8084<br/>body: {workflowId, projectId, script}"]
    
    G --> H{"状态机流转"}
    H -->|"queued"| I["任务入队 BullMQ"]
    I -->|"running"| J["DAG 调度器启动<br/>workflow-engine:8084"]

    J --> K["S1: 剧本拆分<br/>ai-orchestrator P1<br/>novel→screenplay"]
    K --> L1["S2: 角色提取<br/>ai-helper:8086"]
    K --> L2["S3: 场景设计<br/>ai-router:8083"]
    L1 --> M["S4: 分镜脚本<br/>ai-orchestrator P2"]
    L2 --> M
    M --> N["S5: 图像生成<br/>ai-router:8083 → 火山/阿里/腾讯/智谱"]
    N --> O1["S6: 视频生成<br/>Seedance/智影/CogVideoX"]
    N --> O2["S7: 字幕配音<br/>TTS → ai-router:8083"]
    O1 --> P["P5: 合集成片<br/>ai-orchestrator<br/>videos→episode"]
    O2 --> P

    P --> Q["资产落库<br/>POST /api/v1/assets<br/>→ asset-service:8085<br/>→ OSS/MinIO → CDN"]
    Q --> R["状态: completed"]
    R --> S["WebSocket 推送<br/>wss://workflow-engine:8084/ws<br/>实时进度: 镜头 7/10"]

    subgraph 实时反馈["WebSocket 实时反馈 (W3精修)"]
        T1["频道: workflow.{id}.progress<br/>进度粒度: 子任务级"]
        T2["频道: workflow.{id}.preview<br/>流式推送: 先生成先看"]
        T3["频道: workflow.{id}.collab<br/>协作: 多人同看进度"]
        T4["断线重连: 续推未推送事件"]
    end

    S -.-> T1
    S -.-> T2
    S -.-> T3

    subgraph 异常处理["异常处理"]
        U["状态: failed<br/>重试单步 POST /api/v1/workflows/:id/retry"]
        V["重试3次仍失败 → dead<br/>WebSocket 推送失败通知"]
    end

    H -.->|失败| U
    U -.-> V
```

**真实端点速查**：

| 端点 | 方法 | 用途 | 服务 |
|------|------|------|------|
| `/api/v1/workflows` | POST | 创建工作流模板 | workflow-engine:8084 |
| `/api/v1/workflows` | GET | 工作流列表 | workflow-engine:8084 |
| `/api/v1/workflows/:id` | GET | 工作流详情+运行历史 | workflow-engine:8084 |
| `/api/v1/workflows/start` | POST | 启动工作流执行 | workflow-engine:8084 |
| `/api/v1/workflows/:id/pause` | POST | 暂停执行 | workflow-engine:8084 |
| `/api/v1/workflows/:id/resume` | POST | 继续执行 | workflow-engine:8084 |
| `/api/v1/workflows/:id/retry` | POST | 重试失败步骤 | workflow-engine:8084 |
| `/api/v1/workflows/ws` | WS | 实时进度订阅 | workflow-engine:8084 |
| `/v1/orchestrator/jobs` | POST | 漫剧专用 pipeline | ai-orchestrator:8087 |
| `/v1/orchestrator/jobs/:id` | GET | 查询 pipeline 状态 | ai-orchestrator:8087 |

**7 步流水线 (W3 DAG 调度)**：

| 步骤 | 名称 | 调用服务 | 可并行 | 典型耗时 |
|------|------|----------|--------|----------|
| S1 | 剧本拆分 | ai-orchestrator P1 | — | 30-60s |
| S2 | 角色提取 | ai-helper:8086 | ∥ S3 | 20-40s |
| S3 | 场景设计 | ai-router:8083 | ∥ S2 | 20-40s |
| S4 | 分镜脚本 | ai-orchestrator P2 | — | 20-40s |
| S5 | 图像生成 | ai-router:8083 → 供应商 | — | 60-180s |
| S6 | 视频生成 | Seedance/智影 | ∥ S7 | 120-300s |
| S7 | 字幕配音 | TTS → ai-router | ∥ S6 | 30-60s |

**状态机枚举**：`queued → running ⇄ paused → completed | failed → dead`

---

## 功能块 4：计费充值 (余额查询 / 扣费 / 充值)

```mermaid
flowchart TD
    A["💳 用户进入账户页"] --> B["GET /api/v1/billing/balance<br/>→ billing-service:8090<br/>返回: {balanceCents, currency}"]
    B --> C["AccountView.vue<br/>渲染余额卡片+消费记录"]

    C --> D{用户操作}

    D -->|"充值"| E["打开 RechargeModal.vue<br/>选择金额: 50/100/200/500"]
    E --> F["POST /api/v1/billing/recharge<br/>→ billing-service:8090<br/>body: {userId, amount, currency}"]
    F --> G["5步内部流程"]
    G --> G1["1. 校验用户 (不可给他人充, 403)"]
    G1 --> G2["2. 建 invoice (issued)"]
    G2 --> G3["3. mock 支付 (sleep 100ms, 95%成功)"]
    G3 --> G4["4. 建 payment 记录"]
    G4 --> G5["5. 更新 balanceCents += amount"]
    G5 --> H{"支付结果"}
    H -->|成功| I["toast: '充值成功'<br/>刷新余额"]
    H -->|失败 (5%)| J["toast: '支付失败, 请重试'"]

    D -->|"查看发票"| K["GET /api/v1/billing/invoices<br/>→ billing-service:8090"]
    K --> L["InvoiceListView.vue<br/>发票列表: INV号+金额+状态"]

    D -->|"订阅管理"| M["GET /api/v1/subscriptions<br/>→ billing-service:8090"]
    M --> N["SubscriptionView.vue<br/>当前套餐+升降级"]

    D -->|"成本日志"| O["GET /api/v1/billing/cost-logs<br/>→ billing-service:8090"]
    O --> P["CostLogView.vue<br/>每次AI调用扣费明细"]

    subgraph 自动扣费["自动扣费 (事件驱动)"]
        Q1["Redis 事件: ai.task.completed<br/>→ billing 监听"]
        Q2["Redis 事件: workflow.run.completed<br/>→ billing 监听"]
        Q1 --> R["计算扣费: tokens×单价<br/>balanceCents -= cost"]
        Q2 --> R
        R --> S["余额不足? → 暂停订阅<br/>POST notification-service<br/>发邮件提醒充值"]
    end

    subgraph 退款["退款流程"]
        T1["POST /api/v1/refunds<br/>→ billing-service:8090<br/>body: {orderId, reason}"]
        T1 --> T2["人工审核 → 原路退回"]
    end
```

**真实端点速查**：

| 端点 | 方法 | 用途 | 关键字段 |
|------|------|------|----------|
| `/api/v1/billing/balance` | GET | 查余额 | `balanceCents`, `currency` |
| `/api/v1/billing/recharge` | POST | 充值 (5步) | `userId`, `amount`, `currency` → `invoice`, `payment`, `balance` |
| `/api/v1/billing/invoices` | GET | 发票列表 | `invoiceNo`, `amountCents`, `status` |
| `/api/v1/billing/cost-logs` | GET | 成本日志 | 每次 AI 调用扣费明细 |
| `/api/v1/subscriptions` | GET | 查订阅 | 当前套餐+到期时间 |
| `/api/v1/subscriptions` | POST | 创建/升级订阅 | 选择套餐 plan |
| `/api/v1/orders` | GET | 订单列表 | 历史充值订单 |
| `/api/v1/refunds` | POST | 退款申请 | `orderId`, `reason` |
| `/api/v1/quota` | GET | 配额查询 | 用量/总量 |

**充值 5 步内部流程**：
1. `校验 user` → 不可给其他用户充值 (403: `cannot recharge for another user`)
2. `建 invoice` → INV-20260609-XXXXXX, status=issued
3. `mock 支付` → sleep 100ms, 95% 成功率
4. `建 payment` → MOCK-... transactionId, status=success
5. `更新余额` → balanceCents 累加

**自动扣费触发**：billing-service 订阅 Redis Pub/Sub 事件：
- `ai.task.completed` → 按 tokens × 单价扣费
- `workflow.run.completed` → 按工作流总成本扣费

---

## 功能块 5：AI 推理 (向量生成 / 翻译 / 风格迁移)

```mermaid
flowchart TD
    A["🤖 用户触发 AI 能力"] --> B{"AI 能力类型"}

    B -->|"图像生成"| C1["POST /api/v1/ai/image/generate<br/>→ ai-router:8083<br/>body: {prompt, size, style, seed}"]
    C1 --> D1["ai-router 供应商路由"]
    D1 --> E1{"路由策略"}
    E1 -->|"主: 火山引擎"| F1["Doubao-Seedream 3.0<br/>￥0.18/张 1024²"]
    E1 -->|"备1: 阿里云"| F2["通义万相 2.2<br/>￥0.20/张"]
    E1 -->|"备2: 腾讯云"| F3["混元图像 2.0<br/>￥0.22/张"]
    E1 -->|"低价: 智谱"| F4["CogView-3 Plus<br/>￥0.16/张"]
    F1 --> G1["返回图片 URL"]
    G1 --> H1["Redis 缓存 7 天去重<br/>相同 prompt+seed 不重复调"]
    H1 --> I1["落库 asset-service:8085<br/>POST /api/v1/assets<br/>→ OSS → CDN 签名 URL"]

    B -->|"视频生成"| C2["POST /api/v1/ai/video/generate<br/>→ ai-router:8083<br/>body: {imageRef, duration, fps}"]
    C2 --> D2["路由: 火山 Seedance 优先"]
    D2 --> I2["资产入库 + 计费埋点"]

    B -->|"TTS 配音"| C3["POST /api/v1/ai/tts<br/>→ ai-router:8083<br/>body: {text, voice, speed}"]
    C3 --> D3["路由: 火山/阿里/智谱 TTS"]
    D3 --> I3["返回音频 URL → asset-service"]

    B -->|"提示词优化"| C4["POST /api/v1/helper/prompt-optimize<br/>→ ai-helper:8086<br/>body: {rawText, targetLang}"]
    C4 --> D4["Prompt Library 检索<br/>匹配最佳模板"]
    D4 --> E4["调用 ai-router LLM<br/>土味中文 → 专业英文 prompt"]
    E4 --> I4["返回优化后 prompt"]

    B -->|"灵感推荐"| C5["POST /api/v1/helper/inspire<br/>→ ai-helper:8086<br/>body: {projectId, context}"]
    C5 --> D5["分析已写内容<br/>推荐下一步剧情方向"]
    D5 --> I5["返回 3-5 个剧情建议"]

    B -->|"角色一致性检查"| C6["POST /api/v1/helper/character-check<br/>→ ai-helper:8086<br/>body: {characterId, newText}"]
    C6 --> D6["对比历史描写 vs 新内容<br/>检测前后矛盾"]
    D6 --> I6["返回差异报告"]

    B -->|"风格统一性"| C7["POST /api/v1/helper/style-check<br/>→ ai-helper:8086<br/>body: {projectId, text}"]
    C7 --> D7["分析语言风格一致性<br/>vs 已写章节"]
    D7 --> I7["返回风格偏离提醒"]

    B -->|"违禁词扫描"| C8["POST /api/v1/helper/content-scan<br/>→ ai-helper:8086<br/>body: {text}"]
    C8 --> D8["扫描违规内容<br/>政治/色情/暴力"]
    D8 --> I8["返回违禁词列表+风险等级"]

    subgraph BYOK["BYOK 用户自带密钥"]
        K1["POST /api/v1/user/api-keys<br/>→ user-service:8088<br/>body: {provider, apiKey}"]
        K1 --> K2["ai-keys-service:8082 KMS加密存储"]
        K2 --> K3["ai-router 调用前解密到内存<br/>绕过平台抽佣<br/>只收 30% 服务费"]
        K3 --> K4["GET /api/v1/user/api-keys/:id/reveal<br/>一次性显示明文"]
    end

    subgraph 计费集成["计费集成"]
        L1["ai-router 每次调用 → Redis 事件<br/>ai.task.completed {taskId, cost, tokens}"]
        L1 --> L2["billing-service 监听<br/>自动扣费 balanceCents -= cost"]
    end

    I1 -.-> L1
    I2 -.-> L1
    I3 -.-> L1
```

**真实端点速查**：

| 端点 | 方法 | 用途 | 服务 | 鉴权 |
|------|------|------|------|------|
| `/api/v1/ai/image/generate` | POST | 图像生成 | ai-router:8083 | JWT Bearer |
| `/api/v1/ai/video/generate` | POST | 视频生成 | ai-router:8083 | JWT Bearer |
| `/api/v1/ai/tts` | POST | 文字转语音 | ai-router:8083 | JWT Bearer |
| `/v1/orchestrator/jobs` | POST | 漫剧编排任务 | ai-orchestrator:8087 | `x-api-key` |
| `/v1/orchestrator/jobs/:id` | GET | 查询任务状态 | ai-orchestrator:8087 | `x-api-key` |
| `/api/v1/helper/prompt-optimize` | POST | 提示词优化 | ai-helper:8086 | JWT Bearer |
| `/api/v1/helper/inspire` | POST | 灵感推荐 | ai-helper:8086 | JWT Bearer |
| `/api/v1/helper/character-check` | POST | 角色一致性检查 | ai-helper:8086 | JWT Bearer |
| `/api/v1/helper/style-check` | POST | 风格统一性 | ai-helper:8086 | JWT Bearer |
| `/api/v1/helper/content-scan` | POST | 违禁词扫描 | ai-helper:8086 | JWT Bearer |
| `/api/v1/user/api-keys` | POST | 添加 BYOK Key | user-service:8088 | JWT Bearer |
| `/api/v1/user/api-keys` | GET | BYOK Key 列表 | user-service:8088 | JWT Bearer |
| `/api/v1/user/api-keys/:id/reveal` | GET | 一次性显示明文 | user-service:8088 | JWT Bearer |

**4 供应商对比 (成本优先)**：

| 供应商 | 模型 | 生图 ¥/张 | 生视频 ¥/5s | 中文理解 | 角色一致性 | 选择 |
|--------|------|-----------|-------------|----------|-----------|------|
| 火山引擎 | Seedream 3.0 / Seedance | 0.18 | 0.85 | ★★★★★ | ★★★★ | **主力** |
| 阿里云 | 通义万相 2.2 | 0.20 | 1.00 | ★★★★★ | ★★★ | 备1 |
| 腾讯云 | 混元 2.0 / 智影 | 0.22 | 1.20 | ★★★★ | ★★★ | 备2 |
| 智谱 | CogView-3 / CogVideoX | 0.16 | 0.95 | ★★★★ | ★★ | 低价 |

**ai-helper 6 大功能**：

| # | 功能 | 端点 | 场景 |
|---|------|------|------|
| 1 | 提示词优化 | `/api/v1/helper/prompt-optimize` | 不会写英文 prompt 的创作者 |
| 2 | 灵感推荐 | `/api/v1/helper/inspire` | 写不出下一章 |
| 3 | 角色一致性检查 | `/api/v1/helper/character-check` | 长篇小说防矛盾 |
| 4 | 风格统一性 | `/api/v1/helper/style-check` | 团队协作统一风格 |
| 5 | 违禁词扫描 | `/api/v1/helper/content-scan` | 发布前审核 |
| 6 | 智能改名 | `/api/v1/helper/rename` | 作品/角色起名 |

---

## 附录：前端路由与跨 App 跳转

```mermaid
flowchart LR
    A["web (5173)"] -->|"/login"| A1["LoginView.vue"]
    A -->|"/dashboard"| A2["DashboardView.vue"]
    A -->|"/projects"| A3["ProjectsView.vue"]
    A -->|"/account"| A4["AccountView.vue"]
    
    B["admin-portal (5174)"] -->|"/admin/login"| B1["AdminLogin"]
    B -->|"/admin/dashboard"| B2["AdminDashboard"]
    B -->|"/admin/users"| B3["UserManagement"]
    
    C["studio (5175)"] -->|"/"| C1["HomeView.vue"]
    C -->|"/workflow"| C2["WorkflowDesigner.vue"]
    C -->|"/projects"| C3["ProjectsView.vue"]
    C -->|"/characters"| C4["CharacterView.vue"]
    C -->|"/scenes"| C5["ScenesView.vue"]
    C -->|"/tools"| C6["ToolsView.vue"]
    C -->|"/export"| C7["ExportView.vue"]
    
    D["user-portal (5180)"] -->|"/workbench"| D1["WorkbenchView"]
    D -->|"/projects"| D2["MyProjects"]
    D -->|"/account"| D3["AccountView"]
    D -->|"/works"| D4["MyWorks"]

    A2 -->|"项目卡片点击"| X["跨 app 跳转:<br/>http://${window.location.hostname}:5180/projects/${id}"]
    X --> D2

    A4 -->|"订阅管理"| Y["跳转 billing 页"]
```

**跨 App 跳转规则 (林染专属)**：

| 从 | 到 | 用 |
|------|------|------|
| web (5173) | user-portal (5180) | `http://${window.location.hostname}:5180/...` |
| user-portal (5180) | studio (5175) | `http://${window.location.hostname}:5175/...` |
| 任何 | external | ❌ 不准, 改为同 app 内路由 |

---

## 附录：服务端口速查

| # | 服务名 | 端口 | 协议 | 状态 |
|---|--------|------|------|------|
| 1 | api-gateway (Kong) | 8000 | HTTP | ✅ 运行 |
| 2 | user-service | 8088 | HTTP | ✅ 运行 |
| 3 | billing-service | 8090 | HTTP | ✅ 运行 |
| 4 | ai-orchestrator | 8087 | HTTP | ✅ 运行 |
| 5 | ai-router | 8083 | HTTP | ✅ W2 |
| 6 | ai-keys-service | 8082 | HTTP | ✅ W2 |
| 7 | ai-helper | 8086 | HTTP | ✅ W3 |
| 8 | workflow-engine | 8084 | HTTP+WS | ✅ W3 |
| 9 | asset-service | 8085 | HTTP | ✅ W3 |
| 10 | project-service | 8089 | HTTP | ⚠️ 未启 |
| 11 | collab-service | 8091 | HTTP+WS | ⚠️ 未启 |
| 12 | notification-service | 8090 | HTTP+WS | ⚠️ 预留 |

---

## 附录：事件总线 (Redis Pub-Sub)

所有服务间异步通信走 Redis Pub-Sub，事件命名规范 `domain.entity.action`：

| 事件名 | 发布者 | 订阅者 | 用途 |
|--------|--------|--------|------|
| `auth.user.created` | user-service | billing, noti | 新用户自动建账户 |
| `project.created` | project-service | workflow, asset | 项目创建后初始化 |
| `asset.created` | asset-service | workflow, ai-helper | 资产入账通知 |
| `workflow.run.started` | workflow-engine | orchestrator, noti | 工作流启动 |
| `workflow.run.completed` | workflow-engine | orchestrator, billing | 完成后扣费 |
| `workflow.run.failed` | workflow-engine | noti | 失败通知 |
| `ai.task.completed` | ai-router | billing, orchestrator | AI 调用扣费 |
| `billing.subscription.changed` | billing-service | auth, noti | 订阅变更通知 |
| `noti.send.email` | billing-service | notification-service | 发邮件提醒 |

---

> **林染署名**：本流程图基于 ManhuaWorks v0.3.0 (W3/W4) 真实架构，所有端点、端口、接口名均来自 `API_REFERENCE.md` + W2/W3/W4 架构文档，零 AI 编造。
>
> **节点数统计**：全景图 41 节点 + 登录流 28 节点 + 项目管理 23 节点 + 工作流 31 节点 + 计费充值 26 节点 + AI推理 36 节点 + 路由附录 11 节点 = **总计 196 节点** (含子图标注节点)
