# W3 整体架构总览

> **作者**：陈远枢（运营总监）
> **日期**：2026-06-08
> **适用版本**：ManhuaWorks v0.3.0
> **覆盖范围**：W3 三周内交付的所有微服务
> **阅读时长**：≈ 8 分钟

## 1. 概述

W3 阶段（2026-06-08 ~ 2026-28）共交付 **8 个后端微服务** + **2 个独立子模块**，构成本次内测所需的核心后端集群。本文档用一张 Mermaid 图把全部服务、依赖、端口、数据流画清楚，并给出端口分配表。

**与 W2 的关系**：
- W2 已交付：`ai-router` (8083)、`ai-keys` (8082)、`workflow-engine` v1 (8084)
- W3 新增/重写：`asset-service`、`ai-helper`、`workflow-engine v2`、`orchestrator`、`auth-service`、`project-service`、`billing-service`、`notification-service`

---

## 2. 整体架构图

```mermaid
graph TB
    %% ============== 客户端 ==============
    subgraph 客户端
        STU[创作者工作台<br/>apps/studio<br/>Vue 3 + Vite]
        USR[用户后台<br/>apps/user-portal<br/>Vue 3]
        OPS[业务总后台<br/>apps/ops-portal]
        ADM[平台总后台<br/>apps/admin-portal]
        DEV[开发者后台<br/>apps/dev-portal]
        DESK[桌面客户端<br/>apps/installer<br/>Electron]
    end

    %% ============== 边缘层 ==============
    subgraph 边缘层
        CDN[CDN<br/>阿里云 + CloudFront]
        GW[API Gateway<br/>Kong 3.x<br/>:8000]
    end

    %% ============== W2 既有服务 ==============
    subgraph W2既有服务
        AIRT[ai-router<br/>:8083]
        AIKEY[ai-keys<br/>:8082]
        WF1[workflow-engine v1<br/>:8084 旧版]
    end

    %% ============== W3 核心服务 ==============
    subgraph W3新增服务
        AUTH[auth-service<br/>:8081]
        PROJ[project-service<br/>:8087]
        ASSET[asset-service<br/>:8085]
        AIH[ai-helper<br/>:8086]
        WF2[workflow-engine v2<br/>:8084 重写]
        ORCH[orchestrator<br/>:8088]
        BILL[billing-service<br/>:8089]
        NOTI[notification-service<br/>:8090]
    end

    %% ============== 数据层 ==============
    subgraph 数据层
        PG[(PostgreSQL 16<br/>主库 + 6 业务库)]
        RD[(Redis 7<br/>缓存/限流/Pub-Sub)]
        S3[(对象存储<br/>OSS / S3 / MinIO)]
    end

    %% ============== 外部 AI ==============
    subgraph 外部AI供应商
        V[火山引擎]
        A[阿里云百炼]
        T[腾讯混元]
        Z[智谱GLM]
    end

    %% ============== 客户端到网关 ==============
    STU -->|HTTPS| GW
    USR -->|HTTPS| GW
    OPS -->|HTTPS| GW
    ADM -->|HTTPS| GW
    DEV -->|HTTPS| GW
    DESK -->|HTTPS| GW

    %% ============== 网关到服务 ==============
    GW -->|/v1/auth| AUTH
    GW -->|/v1/projects| PROJ
    GW -->|/v1/assets| ASSET
    GW -->|/v1/ai| AIRT
    GW -->|/v1/keys| AIKEY
    GW -->|/v1/helper| AIH
    GW -->|/v1/workflows| WF2
    GW -->|/v1/orchestrator| ORCH
    GW -->|/v1/billing| BILL
    GW -->|/v1/notifications| NOTI

    %% ============== 服务间调用 ==============
    AUTH -.JWT 校验.-> GW
    PROJ --> ASSET
    PROJ --> WF2
    ORCH --> WF2
    ORCH --> AIRT
    ORCH --> AIH
    ORCH --> ASSET
    WF2 --> AIRT
    WF2 --> AIH
    AIH --> AIRT
    BILL --> AIRT
    BILL --> ASSET
    NOTI -->|事件订阅| RD

    %% ============== 数据连接 ==============
    AUTH --> PG
    PROJ --> PG
    ASSET --> PG
    ASSET --> S3
    AIH --> PG
    AIH --> RD
    WF2 --> PG
    WF2 --> RD
    ORCH --> PG
    ORCH --> RD
    BILL --> PG
    NOTI --> PG

    %% ============== CDN ==============
    ASSET -.签名 URL.-> CDN
    CDN -.回源.-> S3

    %% ============== 外部 AI ==============
    AIRT --> V
    AIRT --> A
    AIRT --> T
    AIRT --> Z

    %% ============== 风格 ==============
    style GW fill:#fde68a
    style W2既有服务 fill:#e5e7eb
    style W3新增服务 fill:#dbeafe
    style 数据层 fill:#d1fae5
    style 外部AI供应商 fill:#fecaca
```

---

## 3. 端口分配表

| # | 服务名 | 端口 | 协议 | 数据库 | 状态 | 负责人 | 文档 |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 1 | `api-gateway` | **8000** | HTTP | - | 既有 | 后端组 | W1 文档 |
| 2 | `auth-service` | **8081** | HTTP | `auth_db` | W3 新建 | 沈书白 | W3_AUTH |
| 3 | `ai-keys` | **8082** | HTTP | `keys_db` | W2 完成 | 陈远枢 | `api/ai-keys.md` |
| 4 | `ai-router` | **8083** | HTTP | - | W2 完成 | 陈远枢 | `api/ai-router.md` |
| 5 | `workflow-engine` | **8084** | HTTP+WS | `workflow_db` | W3 重写 | 陈远枢 | `W3_WORKFLOW_REFINED.md` |
| 6 | `asset-service` | **8085** | HTTP | `asset_db` | W3 新建 | 陈远枢 | `W3_ASSET.md` |
| 7 | `ai-helper` | **8086** | HTTP | `helper_db` | W3 新建 | 陈远枢 | `W3_AI_HELPER.md` |
| 8 | `project-service` | **8087** | HTTP | `project_db` | W3 新建 | 沈书白 | W3_PROJECT |
| 9 | `orchestrator` | **8088** | HTTP+WS | `orchestrator_db` | W3 新建 | 陈远枢 | `W3_ORCHESTRATOR.md` |
| 10 | `billing-service` | **8089** | HTTP | `billing_db` | W3 新建 | 林若涵 | W3_BILLING |
| 11 | `notification-service` | **8090** | HTTP+WS | `noti_db` | W3 新建 | 林若涵 | W3_NOTIFICATION |
| - | `ai-router` metrics | 9103 | HTTP | - | 既有 | - | Prometheus |
| - | `workflow` metrics | 9104 | HTTP | - | W3 | - | Prometheus |
| - | `asset` metrics | 9105 | HTTP | - | W3 | - | Prometheus |
| - | `ai-helper` metrics | 9106 | HTTP | - | W3 | - | Prometheus |
| - | `orchestrator` metrics | 9108 | HTTP | - | W3 | - | Prometheus |
| - | `PostgreSQL` 主库 | 5432 | TCP | - | 既有 | 运维 | - |
| - | `Redis` 7 | 6379 | TCP | - | 既有 | 运维 | - |
| - | `MinIO` (dev) | 9000/9001 | HTTP | - | 既有 | 运维 | - |
| - | `Kong` Admin | 8001 | HTTP | - | 既有 | 运维 | - |
| - | `Prometheus` | 9090 | HTTP | - | 既有 | 运维 | - |
| - | `Grafana` | 3000 | HTTP | - | 既有 | 运维 | - |

---

## 4. 服务依赖矩阵

> ✅ = 直接 HTTP 调用 | 📡 = 事件订阅 | ➖ = 无依赖

| 服务 \ 依赖 | auth | ai-keys | ai-router | workflow | asset | ai-helper | project | orchestrator | billing | noti |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| **auth-service** | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| **ai-keys** | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| **ai-router** | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | 📡 | ➖ |
| **workflow-engine** | ✅ | ➖ | ✅ | ➖ | 📡 | 📡 | 📡 | ➖ | 📡 | 📡 |
| **asset-service** | ✅ | ➖ | ➖ | 📡 | ➖ | 📡 | 📡 | 📡 | 📡 | ➖ |
| **ai-helper** | ✅ | ➖ | ✅ | 📡 | 📡 | ➖ | 📡 | ➖ | 📡 | ➖ |
| **project-service** | ✅ | ➖ | ➖ | ✅ | ✅ | ➖ | ➖ | 📡 | ➖ | 📡 |
| **orchestrator** | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | 📡 | 📡 |
| **billing-service** | ✅ | ✅ | ✅ | 📡 | 📡 | 📡 | 📡 | 📡 | ➖ | 📡 |
| **notification-service** | ✅ | ➖ | ➖ | 📡 | 📡 | 📡 | 📡 | 📡 | 📡 | ➖ |

**循环依赖检查**：✅ 无循环（billing 监听事件，不主动调用其他服务）

---

## 5. 事件总线（EventBus 协议）

所有服务通过 **Redis Pub-Sub** 共享事件总线，事件命名规范 `domain.entity.action`：

| 事件名 | 发布者 | 订阅者 | 载荷示例 |
|:--|:--|:--|:--|
| `auth.user.created` | auth-service | billing, noti | `{userId, email, plan}` |
| `auth.user.deleted` | auth-service | 全部 | `{userId}` |
| `project.created` | project-service | workflow, asset | `{projectId, userId, type}` |
| `asset.created` | asset-service | workflow, ai-helper, billing | `{assetId, userId, size}` |
| `asset.deleted` | asset-service | workflow, ai-helper | `{assetId, soft}` |
| `workflow.run.started` | workflow-engine | orchestrator, noti | `{runId, projectId}` |
| `workflow.run.completed` | workflow-engine | orchestrator, billing, noti | `{runId, totalCost}` |
| `workflow.run.failed` | workflow-engine | noti | `{runId, error}` |
| `ai.task.completed` | ai-router | billing, orchestrator | `{taskId, cost, tokens}` |
| `billing.subscription.changed` | billing-service | auth, noti | `{userId, plan, status}` |
| `noti.send.email` | billing-service | notification-service | `{to, template, data}` |

---

## 6. 数据流主路径（端到端）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户浏览器
    participant G as API Gateway
    participant A as auth-service
    participant P as project-service
    participant W as workflow-engine
    participant R as ai-router
    participant S as asset-service
    participant B as billing-service
    participant AI as 外部 AI 供应商

    U->>G: 1. POST /v1/auth/login
    G->>A: 2. 校验账号
    A-->>G: 3. JWT token
    G-->>U: 4. 返回 token

    U->>G: 5. POST /v1/projects/<br/>{name, type}
    G->>P: 6. 创建项目
    P->>P: 7. 写 project_db
    P-->>G: 8. projectId
    G-->>U: 9. 返回项目

    U->>G: 10. POST /v1/workflows/start<br/>{projectId, script}
    G->>W: 11. 启动工作流
    W->>P: 12. 读取项目+剧本
    P-->>W: 13. 剧本分镜

    loop 每个镜头
        W->>R: 14. POST /v1/ai/image/generate
        R->>AI: 15. 调用火山/阿里
        AI-->>R: 16. 图片 URL
        R-->>W: 17. 返回图片
        W->>S: 18. POST /v1/assets
        S->>S: 19. 落库 asset_db + 上传 OSS
        S-->>W: 20. assetId
    end

    W->>B: 21. 事件：workflow.run.completed<br/>{totalCost: ¥5.8}
    B->>B: 22. 扣减用户余额
    B-->>U: 23. 推送扣费通知
```

---

## 7. 部署拓扑（生产环境）

```mermaid
graph TB
    subgraph SLB[负载均衡]
        ALB[阿里云 SLB<br/>HTTPS 443]
    end

    subgraph K8S[Kubernetes 集群 - 3 节点]
        POD1[Pod: gateway ×3]
        POD2[Pod: auth ×2]
        POD3[Pod: project ×3]
        POD4[Pod: workflow ×4]
        POD5[Pod: asset ×2]
        POD6[Pod: ai-helper ×2]
        POD7[Pod: orchestrator ×2]
        POD8[Pod: billing ×2]
        POD9[Pod: noti ×2]
        POD10[Pod: ai-router ×4]
        POD11[Pod: ai-keys ×2]
    end

    subgraph RDS[托管服务]
        PG[PostgreSQL 主从<br/>阿里云 RDS]
        RDIS[Redis 集群<br/>阿里云 Redis]
        OSS[对象存储<br/>阿里云 OSS]
    end

    subgraph MON[监控]
        PROM[Prometheus]
        GRA[Grafana]
        ALERT[AlertManager]
    end

    ALB --> POD1
    POD1 --> POD2 & POD3 & POD4 & POD5 & POD6 & POD7 & POD8 & POD9 & POD10 & POD11
    POD5 --> OSS
    POD2 & POD3 & POD4 & POD5 & POD6 & POD7 & POD8 --> PG
    POD4 & POD6 & POD7 --> RDIS
    POD4 & POD5 & POD6 & POD7 --> PROM
    PROM --> GRA
    PROM --> ALERT
```

**副本数原则**：
- 计算密集（ai-router、workflow）：4 副本
- 业务读写（project、auth）：2-3 副本
- IO 密集（asset、billing）：2 副本

---

## 8. SLO 目标（Service Level Objective）

| 服务 | 可用性 | P95 延迟 | 错误率 | 备注 |
|:--|:--|:--|:--|:--|
| api-gateway | 99.95% | < 50ms | < 0.1% | 入口核心 |
| auth-service | 99.9% | < 200ms | < 0.5% | 登录注册 |
| project-service | 99.5% | < 300ms | < 1% | 读写均衡 |
| workflow-engine | 99.5% | < 500ms | < 1% | WS 长连接 |
| asset-service | 99.5% | < 500ms | < 0.5% | 上传下载 |
| ai-helper | 99% | < 1s | < 2% | LLM 依赖 |
| orchestrator | 99.5% | < 1s | < 1% | 复杂编排 |
| billing-service | 99.99% | < 200ms | < 0.01% | 计费不能错 |
| notification-service | 99% | < 2s | < 2% | 异步容忍高 |
| ai-router | 99.5% | < 800ms | < 1% | 4 家冗余 |

---

## 9. 启动顺序与健康检查

```mermaid
flowchart LR
    A[PostgreSQL] -->|DB ready| B[Redis]
    B -->|Cache ready| C[api-gateway]
    C --> D[auth-service]
    D --> E[ai-keys]
    E --> F[ai-router]
    F --> G[asset-service]
    G --> H[ai-helper]
    H --> I[workflow-engine]
    I --> J[project-service]
    J --> K[orchestrator]
    K --> L[billing-service]
    L --> M[notification-service]
    M --> N[全部就绪]

    style A fill:#d1fae5
    style N fill:#d1fae5
```

**健康检查端点**：每个服务都暴露 `GET /health`，返回 `{status, db, redis, version}`

---

## 10. 监控与告警

| 指标 | 阈值 | 告警级别 |
|:--|:--|:--|
| 服务 P99 延迟 > 2s | 持续 5 分钟 | P2 |
| 错误率 > 5% | 持续 3 分钟 | P1 |
| 服务 down | 1 分钟内 | P0 |
| CPU > 80% | 持续 10 分钟 | P3 |
| 内存 > 85% | 持续 5 分钟 | P3 |
| DB 连接数 > 80% | 立即 | P2 |
| 磁盘 > 90% | 立即 | P1 |

告警通道：飞书机器人 + 短信（仅 P0/P1）。

---

## 11. 后续规划（W4+）

- **W4**：完善 billing-service 真实支付（支付宝/微信），加入对账模块
- **W5**：抽离 ai-router 的熔断器为独立 `resilience` 中间件
- **W6**：引入 `service-mesh`（Istio）做细粒度流量管理
- **W7**：拆分 `project-service` 为读（query）/ 写（command）两个服务
- **W8**：增加 `analytics-service`（埋点 + 漏斗 + 留存）

---

## 12. 变更记录

| 版本 | 日期 | 作者 | 变更 |
|:--|:--|:--|:--|
| v0.1 | 2026-06-08 | 陈远枢 | 初稿（W3 任务 6）|
