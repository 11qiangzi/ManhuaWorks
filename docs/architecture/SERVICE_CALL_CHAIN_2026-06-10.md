# ManhuaWorks 功能间调用链关系文件

> **作者**：谢擎 🗄️ 开发部后端
> **日期**：2026-06-10 00:50
> **版本**：v1.0
> **基于**：林染 BUSINESS_LOGIC_FLOW_2026-06-10.md (196 节点) + API_REFERENCE.md
> **用途**：明天后端开发参考——每一条链路都有真实端点+真实端口+鉴权方式+错误处理
> **服务数**：12（5 核心 + 4 AI + 2 支撑 + 1 Gateway）

---

## 一、全景服务调用拓扑 (Master Call Topology)

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Web as 🟢 前端 (web/studio/admin/user-portal)
    participant GW as 🟡 Kong Gateway :8000
    participant USVC as 🔵 user-service :8088
    participant PSVC as 🔵 project-service :8089
    participant WSVC as 🔵 workflow-engine :8084
    participant BSVC as 🔵 billing-service :8090
    participant ASVC as 🔵 asset-service :8085
    participant CSVC as 🔵 collab-service :8091
    participant AOR as 🟣 ai-orchestrator :8087
    participant ART as 🟣 ai-router :8083
    participant AHP as 🟣 ai-helper :8086
    participant AKY as 🟣 ai-keys-service :8082
    participant PG as 🟤 PostgreSQL :5432
    participant RD as 🟤 Redis :6379
    participant OSS as 🟤 对象存储 (OSS/MinIO)

    Note over User,OSS: ═══ 全系统 12 服务调用拓扑 ═══

    User->>Web: 访问任一前端入口
    Web->>GW: HTTPS (5173/5174/5175/5180)
    
    Note over GW: 路由规则<br/>/v1/auth → user-service<br/>/v1/projects → project-service<br/>/v1/workflows → workflow-engine<br/>/v1/billing → billing-service<br/>/v1/assets → asset-service<br/>/v1/collab → collab-service<br/>/v1/ai → ai-router<br/>/v1/helper → ai-helper<br/>/v1/orchestrator → ai-orchestrator<br/>/v1/keys → ai-keys-service

    GW->>USVC: /v1/auth/* (JWT 认证)
    GW->>PSVC: /v1/projects/* (CRUD)
    GW->>WSVC: /v1/workflows/* (DAG 调度)
    GW->>BSVC: /v1/billing/* (充值扣费)
    GW->>ASVC: /v1/assets/* (资产存储)
    GW->>CSVC: /v1/collab/* (团队协作)

    USVC-->>PG: 用户/订阅/配额 读写
    PSVC-->>PG: 项目/场景/角色 读写
    WSVC-->>PG: 工作流模板/运行历史
    BSVC-->>PG: 余额/发票/订单/成本
    ASVC-->>PG: 资产元数据
    ASVC-->>OSS: 资产二进制存储

    WSVC->>AOR: 启动 Pipeline (P1-P5)
    AOR->>ART: 供应商路由
    ART->>AHP: 创作辅助请求
    AOR-->>PG: Pipeline 状态
    AOR-->>RD: 进度缓存

    BSVC-->>RD: 监听计费事件 (Pub-Sub)
    WSVC-->>RD: 发布工作流事件
    ART-->>RD: 发布 AI 任务事件
```

---

## 二、链路 1：用户登录鉴权 (4 前端统一入口)

```mermaid
sequenceDiagram
    actor U as 👤 用户
    participant FE as 🟢 Vue (LoginView.vue)
    participant GW as 🟡 Kong :8000
    participant USVC as 🔵 user-service :8088
    participant PG as 🟤 PostgreSQL :5432

    Note over U,PG: ═══ 链路 1a: 邮箱+密码登录 (POST /api/v1/auth/login) ═══

    U->>FE: 输入 email + password
    FE->>GW: POST /api/v1/auth/login >> {email, password} (HTTPS)
    Note right of FE: 🔑 无鉴权 (公开端点)
    GW->>USVC: POST /api/v1/auth/login (转发)
    USVC->>PG: SELECT * FROM users WHERE email=$1
    PG-->>USVC: user row (含 passwordHash)
    USVC->>USVC: bcryptjs.compare(password, hash)
    USVC->>USVC: sign JWT (payload: {userId, role}, exp: 24h)
    USVC->>USVC: sign refreshToken (exp: 7d)
    alt 密码正确 (200 OK)
        USVC-->>GW: {code:0, data:{accessToken, refreshToken}}
        GW-->>FE: 200 OK
        FE->>FE: localStorage.set('mhw.access_token', token)
        FE->>FE: router.push → 按 hostname 跳转
    else 密码错误 (401 Unauthorized)
        USVC-->>GW: {code:40101, message:"邮箱或密码错误"}
        GW-->>FE: 401
        FE->>U: toast: '邮箱或密码错误'
    else 邮箱不存在 (404 Not Found)
        USVC-->>GW: {code:40401, message:"用户不存在"}
        GW-->>FE: 404
    else 服务器异常 (500 Internal Server Error)
        USVC-->>GW: {code:50000, message:"服务器内部错误"}
        GW-->>FE: 500
        FE->>U: toast: '登录失败 (500)'
    end

    Note over U,PG: ═══ 链路 1b: Token 验证 (GET /api/v1/me) ═══

    U->>FE: 刷新页面 / 直接进入
    FE->>FE: 检查 localStorage: mhw.access_token
    FE->>GW: GET /api/v1/me >> Authorization: Bearer <jwt>
    Note right of FE: 🔑 Bearer JWT (必传)
    GW->>USVC: GET /api/v1/me (authMiddleware 验证)
    USVC->>USVC: jwt.verify(token, SECRET)
    USVC->>PG: SELECT * FROM users WHERE id=$1
    alt token 有效 (200)
        PG-->>USVC: user row
        USVC-->>GW: {code:0, data:{user:{id,email,displayName,role}}}
        GW-->>FE: 200
        FE->>FE: 渲染对应首页
    else token 过期/无效 (401)
        USVC-->>GW: {code:40102, message:"token 无效或已过期"}
        GW-->>FE: 401
        FE->>FE: 清 token → 跳登录页
    end

    Note over U,PG: ═══ 链路 1c: Token 刷新 (POST /api/v1/auth/refresh) ═══

    FE->>FE: 定时器: token 过期前 5min
    FE->>GW: POST /api/v1/auth/refresh >> {refreshToken}
    Note right of FE: 🔑 无鉴权 (用 refreshToken 自身验证)
    GW->>USVC: POST /api/v1/auth/refresh
    USVC->>USVC: jwt.verify(refreshToken)
    alt refreshToken 有效 (200)
        USVC->>USVC: 签发新 accessToken + refreshToken
        USVC-->>GW: {code:0, data:{accessToken, refreshToken}}
        GW-->>FE: 200
        FE->>FE: localStorage 更新 token
    else refreshToken 过期 (401)
        USVC-->>GW: {code:40103, message:"refreshToken 已过期"}
        GW-->>FE: 401
        FE->>FE: 清 token → 跳登录页
    end

    Note over U,PG: ═══ 链路 1d: 登出 (POST /api/v1/auth/logout) ═══

    FE->>GW: POST /api/v1/auth/logout >> Authorization: Bearer <jwt>
    Note right of FE: 🔑 Bearer JWT
    GW->>USVC: POST /api/v1/auth/logout
    USVC->>USVC: 验 token → 清 server session
    USVC-->>GW: {code:0, message:"已登出"}
    GW-->>FE: 200
    FE->>FE: localStorage.remove('mhw.access_token')
    FE->>FE: localStorage.remove('token')
    FE->>FE: router.push → /login
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 邮箱登录 | Vue LoginView | user-service:8088 | POST | `/api/v1/auth/login` | 无 (公开) | -->> | 200 | 400/401/404/500 |
| Token 验证 | Vue (localStorage) | user-service:8088 | GET | `/api/v1/me` | Bearer JWT | -->> | 200 | 401/500 |
| Token 刷新 | 前端定时器 | user-service:8088 | POST | `/api/v1/auth/refresh` | refreshToken | -->> | 200 | 401/500 |
| 登出 | Vue 任意页 | user-service:8088 | POST | `/api/v1/auth/logout` | Bearer JWT | -->> | 200 | 401/500 |
| 邮箱注册 | Vue RegisterView | user-service:8088 | POST | `/api/v1/auth/register` | 无 (公开) | -->> | 201 | 400/409/500 |
| 改密码 | Vue AccountView | user-service:8088 | POST | `/api/v1/me/password` | Bearer JWT | -->> | 200 | 400/401/403/500 |

---

## 三、链路 2：项目管理 CRUD (project-service)

```mermaid
sequenceDiagram
    actor U as 👤 创作者
    participant FE as 🟢 Vue (DashboardView / ProjectDetailView)
    participant GW as 🟡 Kong :8000
    participant USVC as 🔵 user-service :8088
    participant PSVC as 🔵 project-service :8089
    participant PG as 🟤 PostgreSQL :5432

    Note over U,PG: ═══ 链路 2a: 项目列表 (GET /api/v1/projects) ═══

    U->>FE: 进入 Dashboard
    FE->>GW: GET /api/v1/projects?limit=20&status=active >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT (强制鉴权)
    GW->>PSVC: GET /api/v1/projects (转发 + inject user_id from JWT)
    PSVC->>PG: SELECT * FROM projects WHERE owner_id=$1 AND status!='trashed' LIMIT 20
    PG-->>PSVC: rows[]
    PSVC-->>GW: {code:0, data:{projects:[], total:N}}
    GW-->>FE: 200
    FE->>FE: 渲染项目卡片列表

    Note over U,PG: ═══ 链路 2b: 创建项目 (POST /api/v1/projects) ═══

    U->>FE: 打开 CreateProjectModal → 填 title+synopsis
    FE->>GW: POST /api/v1/projects >> {title, synopsis} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>PSVC: POST /api/v1/projects
    PSVC->>PSVC: validate({title: required, synopsis: optional})
    PSVC->>PG: INSERT INTO projects(owner_id,title,synopsis,status) VALUES($1,$2,$3,'draft')
    PG-->>PSVC: created row
    PSVC-->>GW: {code:0, data:{project:{id,title,synopsis,status:'draft'}}}
    GW-->>FE: 201
    FE->>FE: router.push → /projects/:id

    Note over U,PG: ═══ 链路 2c: 项目详情 (GET /api/v1/projects/:id) ═══

    U->>FE: 点击项目卡片
    FE->>GW: GET /api/v1/projects/:id >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>PSVC: GET /api/v1/projects/:id
    PSVC->>PG: SELECT * FROM projects WHERE id=$1 AND owner_id=$2
    alt 项目存在且属于当前用户 (200)
        PG-->>PSVC: project row
        PSVC-->>GW: {code:0, data:{project:{...}}}
        GW-->>FE: 200
        FE->>FE: 渲染 ProjectDetailView (详情+角色+分镜)
    else 项目不存在 (404)
        PG-->>PSVC: (空)
        PSVC-->>GW: {code:40400, message:"项目不存在"}
        GW-->>FE: 404
        FE->>U: toast: '项目不存在'
    else 不属于该用户 (403)
        PSVC-->>GW: {code:40300, message:"无权访问该项目"}
        GW-->>FE: 403
    end

    Note over U,PG: ═══ 链路 2d: 编辑/删除项目 ═══

    FE->>GW: PATCH /api/v1/projects/:id >> {title?, synopsis?, status?} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>PSVC: PATCH /api/v1/projects/:id
    PSVC->>PG: UPDATE projects SET ... WHERE id=$1 AND owner_id=$2
    PSVC-->>GW: {code:0, data:{project:{...}}}
    GW-->>FE: 200

    FE->>GW: DELETE /api/v1/projects/:id >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>PSVC: DELETE /api/v1/projects/:id (软删)
    PSVC->>PG: UPDATE projects SET status='trashed' WHERE id=$1 AND owner_id=$2
    PG-->>PSVC: updated
    PSVC-->>GW: {code:0, message:"项目已删除"}
    GW-->>FE: 200
    FE->>FE: 刷新项目列表
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 项目列表 | DashboardView | project-service:8089 | GET | `/api/v1/projects?limit&status` | Bearer JWT (强制) | -->> | 200 | 401/500 |
| 创建项目 | CreateProjectModal | project-service:8089 | POST | `/api/v1/projects` | Bearer JWT | -->> | 201 | 400/401/500 |
| 项目详情 | ProjectDetailView | project-service:8089 | GET | `/api/v1/projects/:id` | Bearer JWT | -->> | 200 | 401/403/404/500 |
| 编辑项目 | ProjectDetailView | project-service:8089 | PATCH | `/api/v1/projects/:id` | Bearer JWT | -->> | 200 | 401/403/500 |
| 软删项目 | ProjectDetailView | project-service:8089 | DELETE | `/api/v1/projects/:id` | Bearer JWT | -->> | 200 | 401/403/500 |
| 角色列表 | CharacterView | project-service:8089 | GET | `/api/v1/characters?projectId` | Bearer JWT | -->> | 200 | 401/500 |
| 创建角色 | CharacterView | project-service:8089 | POST | `/api/v1/characters` | Bearer JWT | -->> | 201 | 401/500 |
| 场景分镜 | ProjectDetailView | project-service:8089 | GET | `/api/v1/projects/:id/shots` | Bearer JWT | -->> | 200 | 401/404/500 |

---

## 四、链路 3：工作流执行 (workflow-engine → ai-orchestrator → 供应商)

```mermaid
sequenceDiagram
    actor U as 👤 创作者
    participant FE as 🟢 Vue (WorkflowDesigner)
    participant GW as 🟡 Kong :8000
    participant WSVC as 🔵 workflow-engine :8084
    participant AOR as 🟣 ai-orchestrator :8087
    participant AHP as 🟣 ai-helper :8086
    participant ART as 🟣 ai-router :8083
    participant BSVC as 🔵 billing-service :8090
    participant ASVC as 🔵 asset-service :8085
    participant RD as 🟤 Redis :6379
    participant PG as 🟤 PostgreSQL :5432
    participant OSS as 🟤 对象存储

    Note over U,OSS: ═══ 链路 3a: 创建+启动工作流 ═══

    U->>FE: 拖拽节点 → 构建 DAG
    FE->>GW: POST /api/v1/workflows >> {nodes[], edges[], projectId} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>WSVC: POST /api/v1/workflows
    WSVC->>PG: INSERT INTO workflows(...)
    PG-->>WSVC: workflow row
    WSVC-->>GW: {code:0, data:{workflow:{id,...}}}
    GW-->>FE: 201

    U->>FE: 点击 '启动工作流'
    FE->>GW: POST /api/v1/workflows/start >> {workflowId, projectId, script} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>WSVC: POST /api/v1/workflows/start
    WSVC->>PG: INSERT INTO workflow_runs(id,workflow_id,status:'queued')
    WSVC-->>RD: PUBLISH workflow.run.started
    WSVC-->>GW: {code:0, data:{runId, status:'queued'}}
    GW-->>FE: 200

    Note over U,OSS: ═══ 链路 3b: S1 剧本拆分 (ai-orchestrator Pipeline P1) ═══

    WSVC->>WSVC: BullMQ worker 出队
    WSVC->>AOR: POST /v1/orchestrator/jobs >> {pipeline:'P1', novel} + x-api-key
    Note right of WSVC: 🔑 x-api-key (服务间)
    AOR->>AOR: 启动 P1: novel→screenplay
    AOR-->>PG: INSERT INTO pipeline_jobs(id,type:'P1',status:'running')
    AOR->>ART: POST /v1/ai/llm >> {prompt: novel→screenplay}
    ART-->>AOR: screenplay text
    AOR-->>PG: UPDATE pipeline_jobs SET status='completed'
    AOR-->>RD: SET orchestrator:job:{id}:result <screenplay>
    AOR-->>WSVC: {code:0, data:{jobId, status:'completed', result}}
    WSVC->>WSVC: 推进到下一个节点

    Note over U,OSS: ═══ 链路 3c: S2∥S3 并行 (角色提取 + 场景设计) ═══

    par S2 角色提取
        WSVC->>AHP: POST /api/v1/helper/character-check >> {script, projectId} + x-api-key
        Note right of WSVC: 🔑 x-api-key (服务间)
        AHP-->>PG: 查询历史角色数据
        AHP->>ART: POST /v1/ai/llm >> {prompt: extract characters}
        ART-->>AHP: characters[]
        AHP-->>WSVC: {code:0, data:{characters:[]}}
    and S3 场景设计
        WSVC->>ART: POST /v1/ai/image/generate >> {prompt: 场景概念图} + x-api-key
        Note right of WSVC: 🔑 x-api-key (服务间)
        ART->>ART: 供应商路由: 火山 Seedream 优先
        ART-->>ART: 等待生成 (20-40s)
        ART-->>WSVC: {code:0, data:{imageUrl}}
    end

    Note over U,OSS: ═══ 链路 3d: S4 分镜脚本 (ai-orchestrator Pipeline P2) ═══

    WSVC->>AOR: POST /v1/orchestrator/jobs >> {pipeline:'P2', screenplay, characters} + x-api-key
    AOR->>ART: POST /v1/ai/llm >> {prompt: screenplay → storyboard}
    ART-->>AOR: storyboard[]
    AOR-->>WSVC: {code:0, data:{storyboard:[]}}

    Note over U,OSS: ═══ 链路 3e: S5 图像生成 → S6∥S7 视频+配音 → P5 合集成片 ═══

    WSVC->>ART: POST /v1/ai/image/generate (批量分镜) + x-api-key
    ART-->>WSVC: images[]

    par S6 视频生成
        WSVC->>ART: POST /v1/ai/video/generate >> {imageRefs, duration} + x-api-key
        ART-->>ART: 供应商路由: Seedance/智影/CogVideoX
        ART-->>WSVC: videoURLs[]
    and S7 字幕配音
        WSVC->>ART: POST /v1/ai/tts >> {text, voice} + x-api-key
        ART-->>WSVC: audioURLs[]
    end

    WSVC->>AOR: POST /v1/orchestrator/jobs >> {pipeline:'P5', videos, audio, subtitles} + x-api-key
    Note right of WSVC: 🔑 x-api-key → P5 合集成片
    AOR->>ART: (视频合成 / FFmpeg)
    ART-->>AOR: final video URL
    AOR-->>WSVC: {code:0, data:{episodeUrl}}

    Note over U,OSS: ═══ 链路 3f: 资产落库 + 计费结算 ═══

    WSVC->>ASVC: POST /api/v1/assets >> {type:'video', url, projectId, metadata} + x-api-key
    Note right of WSVC: 🔑 x-api-key
    ASVC-->>PG: INSERT INTO assets(...)
    ASVC->>OSS: putObject(video binary)
    OSS-->>ASVC: CDN signed URL
    ASVC-->>WSVC: {code:0, data:{asset:{id, cdnUrl}}}

    WSVC-->>RD: PUBLISH workflow.run.completed {runId, cost, assetIds}
    WSVC->>PG: UPDATE workflow_runs SET status='completed'
    WSVC-->>GW: WebSocket 推送: workflow.{id}.progress (completed)

    RD-->>BSVC: SUBSCRIBE workflow.run.completed
    BSVC->>BSVC: 计算扣费: tokens × 单价
    BSVC->>PG: UPDATE users_balance SET balance_cents -= cost
    BSVC-->>RD: PUBLISH billing.subscription.changed (如余额不足)

    Note over U,OSS: ═══ 链路 3g: 实时进度推送 (WebSocket) ═══

    FE->>WSVC: wss://workflow-engine:8084/ws?token=jwt >> 订阅 workflow.{id}.progress
    Note right of FE: 🔑 Bearer JWT (握手时)
    WSVC-->>FE: 实时推送: {step: 'S5 图像生成', progress: '7/10'}
    WSVC-->>FE: 实时推送: {step: 'S5 图像生成', progress: '10/10'}
    WSVC-->>FE: 实时推送: {step: 'P5 合集成片', progress: '完成'}
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点/频道 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 创建工作流 | WorkflowDesigner | workflow-engine:8084 | POST | `/api/v1/workflows` | Bearer JWT | -->> | 201 | 401/500 |
| 启动工作流 | WorkflowDesigner | workflow-engine:8084 | POST | `/api/v1/workflows/start` | Bearer JWT | -->> | 200 | 401/404/500 |
| 暂停/继续/重试 | WorkflowDesigner | workflow-engine:8084 | POST | `/api/v1/workflows/:id/pause\|resume\|retry` | Bearer JWT | -->> | 200 | 401/404/500 |
| 剧本拆分 (P1) | workflow-engine | ai-orchestrator:8087 | POST | `/v1/orchestrator/jobs` | x-api-key | -->> | 200 | 400/500 |
| 分镜脚本 (P2) | workflow-engine | ai-orchestrator:8087 | POST | `/v1/orchestrator/jobs` | x-api-key | -->> | 200 | 400/500 |
| 合集成片 (P5) | workflow-engine | ai-orchestrator:8087 | POST | `/v1/orchestrator/jobs` | x-api-key | -->> | 200 | 400/500 |
| 查询 Pipeline 状态 | workflow-engine | ai-orchestrator:8087 | GET | `/v1/orchestrator/jobs/:id` | x-api-key | -->> | 200 | 404/500 |
| 角色提取 | workflow-engine | ai-helper:8086 | POST | `/api/v1/helper/character-check` | x-api-key | -->> | 200 | 400/500 |
| 图像生成 (S5) | workflow-engine | ai-router:8083 | POST | `/api/v1/ai/image/generate` | x-api-key | -->> | 200 | 400/500 |
| 视频生成 (S6) | workflow-engine | ai-router:8083 | POST | `/api/v1/ai/video/generate` | x-api-key | -->> | 200 | 400/500 |
| TTS (S7) | workflow-engine | ai-router:8083 | POST | `/api/v1/ai/tts` | x-api-key | -->> | 200 | 400/500 |
| 资产入库 | workflow-engine | asset-service:8085 | POST | `/api/v1/assets` | x-api-key | -->> | 201 | 400/500 |
| 事件发布 | workflow-engine | Redis :6379 | PUB | `workflow.run.started\|completed\|failed` | — | - (异步) | — | — |
| 事件订阅 (扣费) | Redis :6379 | billing-service:8090 | SUB | `workflow.run.completed` | — | - (异步) | — | — |
| WebSocket 推送 | workflow-engine:8084 | Vue | WS | `workflow.{id}.progress` | JWT (握手) | <--> (长连) | — | 401 |

---

## 五、链路 4：计费充值 (billing-service)

```mermaid
sequenceDiagram
    actor U as 👤 用户
    participant FE as 🟢 Vue (AccountView / RechargeModal)
    participant GW as 🟡 Kong :8000
    participant BSVC as 🔵 billing-service :8090
    participant PG as 🟤 PostgreSQL :5432
    participant RD as 🟤 Redis :6379

    Note over U,RD: ═══ 链路 4a: 查询余额 (GET /api/v1/billing/balance) ═══

    U->>FE: 进入账户页
    FE->>GW: GET /api/v1/billing/balance >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: GET /api/v1/billing/balance
    BSVC->>PG: SELECT balance_cents, currency FROM user_balances WHERE user_id=$1
    PG-->>BSVC: {balanceCents, currency}
    BSVC-->>GW: {code:0, data:{balanceCents, currency}}
    GW-->>FE: 200
    FE->>FE: 渲染余额卡片

    Note over U,RD: ═══ 链路 4b: 充值 (POST /api/v1/billing/recharge) ═══

    U->>FE: 选择金额 → 点击充值
    FE->>GW: POST /api/v1/billing/recharge >> {userId, amount, currency:'CNY'} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: POST /api/v1/billing/recharge

    Note over BSVC,RD: 5 步内部流程 (事务)
    BSVC->>BSVC: 1. 校验: userId === token.userId → 403 不可给他人充
    BSVC->>PG: 2. INSERT INTO invoices(user_id,amount_cents,status:'issued') 
    PG-->>BSVC: invoice row (INV-20260610-XXXXXX)
    BSVC->>BSVC: 3. mockPayment: sleep(100ms), 95% success rate
    alt 支付成功 (95%)
        BSVC->>PG: 4. INSERT INTO payments(invoice_id,amount_cents,status:'success')
        PG-->>BSVC: payment row
        BSVC->>PG: 5. UPDATE user_balances SET balance_cents += amount WHERE user_id=$1
        PG-->>BSVC: updated
        BSVC-->>GW: {code:0, data:{balanceCents:newBalance, invoice:{...}, payment:{...}}}
        GW-->>FE: 200
        FE->>U: toast: '充值成功'
        FE->>FE: 刷新余额
    else 支付失败 (5%)
        BSVC->>PG: 4. UPDATE invoices SET status='failed'
        BSVC-->>GW: {code:40201, message:"支付失败，请重试"}
        GW-->>FE: 402
        FE->>U: toast: '支付失败，请重试'
    end

    Note over U,RD: ═══ 链路 4c: 发票/订单/成本查询 ═══

    FE->>GW: GET /api/v1/billing/invoices?limit=20 >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: GET /api/v1/billing/invoices
    BSVC->>PG: SELECT * FROM invoices WHERE user_id=$1 ORDER BY created_at DESC
    BSVC-->>GW: {code:0, data:{invoices:[]}}
    GW-->>FE: 200

    FE->>GW: GET /api/v1/orders >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: GET /api/v1/orders
    BSVC->>PG: 查历史充值订单
    BSVC-->>GW: {code:0, data:{orders:[]}}
    GW-->>FE: 200

    FE->>GW: GET /api/v1/billing/cost-logs >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: GET /api/v1/billing/cost-logs
    BSVC->>PG: SELECT * FROM cost_logs WHERE user_id=$1 ORDER BY created_at DESC
    BSVC-->>GW: {code:0, data:{costLogs:[]}}
    GW-->>FE: 200

    Note over U,RD: ═══ 链路 4d: 订阅管理 ═══

    FE->>GW: GET /api/v1/subscriptions >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: GET /api/v1/subscriptions
    BSVC->>PG: SELECT * FROM subscriptions WHERE user_id=$1
    BSVC-->>GW: {code:0, data:{subscription:{plan, expiresAt}}}
    GW-->>FE: 200

    FE->>GW: POST /api/v1/subscriptions >> {plan:'pro'} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: POST /api/v1/subscriptions
    BSVC->>PG: INSERT/UPDATE subscriptions SET plan=$1 WHERE user_id=$2
    BSVC-->>RD: PUBLISH billing.subscription.changed
    BSVC-->>GW: {code:0, data:{subscription:{plan:'pro', expiresAt:...}}}
    GW-->>FE: 200

    Note over U,RD: ═══ 链路 4e: 自动扣费 (事件驱动, 异步) ═══

    RD-->>BSVC: SUBSCRIBE ai.task.completed {taskId, cost, tokens, userId}
    BSVC->>PG: UPDATE user_balances SET balance_cents -= cost WHERE user_id=$1
    alt 余额不足
        BSVC->>PG: UPDATE subscriptions SET status='paused' WHERE user_id=$1
        BSVC-->>RD: PUBLISH billing.subscription.changed (paused)
        BSVC-->>RD: PUBLISH noti.send.email {userId, type:'low_balance'}
    end

    Note over U,RD: ═══ 链路 4f: 退款 ═══

    FE->>GW: POST /api/v1/refunds >> {orderId, reason} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>BSVC: POST /api/v1/refunds
    BSVC->>PG: INSERT INTO refunds(order_id, reason, status:'pending')
    BSVC-->>GW: {code:0, data:{refund:{id, status:'pending_review'}}}
    GW-->>FE: 200
    Note over BSVC: 人工审核 → 原路退回
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 查余额 | AccountView | billing-service:8090 | GET | `/api/v1/billing/balance` | Bearer JWT | -->> | 200 | 401/500 |
| 充值 | RechargeModal | billing-service:8090 | POST | `/api/v1/billing/recharge` | Bearer JWT | -->> | 200 | 401/402/403/500 |
| 发票列表 | InvoiceListView | billing-service:8090 | GET | `/api/v1/billing/invoices` | Bearer JWT | -->> | 200 | 401/500 |
| 历史订单 | InvoiceListView | billing-service:8090 | GET | `/api/v1/orders` | Bearer JWT | -->> | 200 | 401/500 |
| 成本日志 | CostLogView | billing-service:8090 | GET | `/api/v1/billing/cost-logs` | Bearer JWT | -->> | 200 | 401/500 |
| 查订阅 | SubscriptionView | billing-service:8090 | GET | `/api/v1/subscriptions` | Bearer JWT | -->> | 200 | 401/500 |
| 创建/升级订阅 | SubscriptionView | billing-service:8090 | POST | `/api/v1/subscriptions` | Bearer JWT | -->> | 200 | 401/500 |
| 退款申请 | CostLogView | billing-service:8090 | POST | `/api/v1/refunds` | Bearer JWT | -->> | 200 | 401/500 |
| 事件订阅 (扣费) | Redis :6379 | billing-service:8090 | SUB | `ai.task.completed` | — | - (异步) | — | — |
| 事件订阅 (工作流) | Redis :6379 | billing-service:8090 | SUB | `workflow.run.completed` | — | - (异步) | — | — |
| 事件发布 (订阅变更) | billing-service:8090 | Redis :6379 | PUB | `billing.subscription.changed` | — | - (异步) | — | — |

---

## 六、链路 5：AI 推理直调 (ai-router / ai-helper / ai-orchestrator)

```mermaid
sequenceDiagram
    actor U as 👤 创作者
    participant FE as 🟢 Vue (ToolsView / WorkflowDesigner)
    participant GW as 🟡 Kong :8000
    participant ART as 🟣 ai-router :8083
    participant AHP as 🟣 ai-helper :8086
    participant AKY as 🟣 ai-keys-service :8082
    participant BSVC as 🔵 billing-service :8090
    participant ASVC as 🔵 asset-service :8085
    participant RD as 🟤 Redis :6379
    participant PG as 🟤 PostgreSQL :5432

    Note over U,PG: ═══ 链路 5a: 图像生成 (用户直调) ═══

    U->>FE: 输入 prompt + style + size
    FE->>GW: POST /api/v1/ai/image/generate >> {prompt, size, style, seed} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>ART: POST /api/v1/ai/image/generate
    ART->>RD: GET cache:image:{md5(prompt+seed)} 
    alt 缓存命中 (7天去重)
        RD-->>ART: cached image URL
        ART-->>GW: {code:0, data:{imageUrl, cached:true}}
        GW-->>FE: 200
    else 缓存未命中
        ART->>ART: 供应商路由 (火山→阿里→腾讯→智谱, 成本优先)
        ART-->>ART: 等待生成 (20-180s)
        ART->>ASVC: POST /api/v1/assets >> {type:'image', url} + x-api-key
        ASVC->>PG: INSERT INTO assets(...)
        ASVC-->>ART: {assetId, cdnUrl}
        ART->>RD: SET cache:image:{md5} <cdnUrl> EX 604800
        ART-->>RD: PUBLISH ai.task.completed {taskId, cost, tokens, userId}
        ART-->>GW: {code:0, data:{imageUrl:cdnUrl}}
        GW-->>FE: 200
    end

    Note over U,PG: ═══ 链路 5b: 创作辅助 (ai-helper 6 功能) ═══

    FE->>GW: POST /api/v1/helper/prompt-optimize >> {rawText, targetLang} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>AHP: POST /api/v1/helper/prompt-optimize
    AHP-->>PG: 查 Prompt Library → 匹配最佳模板
    AHP->>ART: POST /v1/ai/llm >> {prompt: 土味→专业 prompt}
    ART-->>AHP: optimized text
    AHP-->>GW: {code:0, data:{optimizedPrompt}}
    GW-->>FE: 200

    Note over AHP: 其他 5 个 helper 功能同理<br/>/inspire (灵感推荐)<br/>/character-check (角色一致性)<br/>/style-check (风格统一)<br/>/content-scan (违禁词扫描)<br/>/rename (智能改名)

    Note over U,PG: ═══ 链路 5c: BYOK 用户自带密钥 ═══

    U->>FE: 输入第三方 API Key
    FE->>GW: POST /api/v1/user/api-keys >> {provider, apiKey} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>USVC: POST /api/v1/user/api-keys
    USVC->>AKY: 加密存储 (KMS)
    AKY-->>PG: INSERT INTO user_api_keys(encrypted_key,...)
    AKY-->>USVC: {keyId}
    USVC-->>GW: {code:0, data:{apiKey:{id, provider, maskedKey:'sk-****abcd'}}}
    GW-->>FE: 201

    Note over U,PG: 调用时, ai-router 从 ai-keys-service 解密到内存, 绕过平台抽佣 (只收 30% 服务费)
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 图像生成 | Vue ToolsView | ai-router:8083 | POST | `/api/v1/ai/image/generate` | Bearer JWT | -->> | 200 | 400/401/500 |
| 视频生成 | Vue ToolsView | ai-router:8083 | POST | `/api/v1/ai/video/generate` | Bearer JWT | -->> | 200 | 400/401/500 |
| TTS 配音 | Vue ToolsView | ai-router:8083 | POST | `/api/v1/ai/tts` | Bearer JWT | -->> | 200 | 400/401/500 |
| 提示词优化 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/prompt-optimize` | Bearer JWT | -->> | 200 | 400/401/500 |
| 灵感推荐 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/inspire` | Bearer JWT | -->> | 200 | 400/401/500 |
| 角色一致性检查 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/character-check` | Bearer JWT | -->> | 200 | 400/401/500 |
| 风格统一性 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/style-check` | Bearer JWT | -->> | 200 | 400/401/500 |
| 违禁词扫描 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/content-scan` | Bearer JWT | -->> | 200 | 400/401/500 |
| 智能改名 | Vue ToolsView | ai-helper:8086 | POST | `/api/v1/helper/rename` | Bearer JWT | -->> | 200 | 400/401/500 |
| 图像缓存读取 | ai-router:8083 | Redis :6379 | GET | `cache:image:{md5}` | — | -->> | — | miss |
| 图像缓存写入 | ai-router:8083 | Redis :6379 | SET | `cache:image:{md5}` (TTL 7d) | — | -->> | — | — |
| AI 事件发布 | ai-router:8083 | Redis :6379 | PUB | `ai.task.completed` | — | - (异步) | — | — |
| BYOK 添加 Key | Vue AccountView | user-service:8088 | POST | `/api/v1/user/api-keys` | Bearer JWT | -->> | 201 | 400/401/500 |
| BYOK 查看列表 | Vue AccountView | user-service:8088 | GET | `/api/v1/user/api-keys` | Bearer JWT | -->> | 200 | 401/500 |
| BYOK 一次性显示 | Vue AccountView | user-service:8088 | GET | `/api/v1/user/api-keys/:id/reveal` | Bearer JWT | -->> | 200 | 401/404 |
| KMS 加密 | user-service:8088 | ai-keys-service:8082 | POST | (内部 RPC) | 服务间密钥 | -->> | 200 | 500 |
| KMS 解密 | ai-router:8083 | ai-keys-service:8082 | GET | (内部 RPC) | 服务间密钥 | -->> | 200 | 403/500 |

---

## 七、链路 6：协作服务 (collab-service)

```mermaid
sequenceDiagram
    actor U as 👤 创作者
    participant FE as 🟢 Vue (ProjectDetailView)
    participant GW as 🟡 Kong :8000
    participant CSVC as 🔵 collab-service :8091
    participant PG as 🟤 PostgreSQL :5432

    Note over U,PG: ═══ 链路 6a: 团队管理 ═══

    FE->>GW: POST /api/v1/teams >> {name} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>CSVC: POST /api/v1/teams
    CSVC->>PG: INSERT INTO teams(owner_id, name)
    CSVC-->>GW: {code:0, data:{team:{id, name}}}
    GW-->>FE: 201

    FE->>GW: GET /api/v1/teams >> Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>CSVC: GET /api/v1/teams
    CSVC->>PG: SELECT * FROM teams WHERE owner_id=$1 OR members @> ARRAY[$1]
    CSVC-->>GW: {code:0, data:{teams:[]}}
    GW-->>FE: 200

    Note over U,PG: ═══ 链路 6b: 邀请成员 ═══

    FE->>GW: POST /api/v1/teams/:id/invitations >> {email, role} + Bearer JWT
    Note right of FE: 🔑 Bearer JWT
    GW->>CSVC: POST /api/v1/teams/:id/invitations
    CSVC->>PG: INSERT INTO invitations(team_id, email, role, status:'pending')
    CSVC-->>PG: PUBLISH collab.invitation.created
    CSVC-->>GW: {code:0, data:{invitation:{id, status:'pending'}}}
    GW-->>FE: 201

    Note over U,PG: ═══ 链路 6c: WebSocket 实时协作 ═══

    FE->>CSVC: ws://collab-service:8091/ws?projectId=x&token=jwt
    Note right of FE: 🔑 Bearer JWT (握手)
    CSVC->>CSVC: 验证 JWT → 加入房间 project:{x}
    CSVC-->>FE: 实时同步: {type:'cursor', userId, position}
    CSVC-->>FE: 实时同步: {type:'edit', userId, diff}
```

| 调用链 | 发起方 | 接收方 | 方法 | 端点 | 鉴权 | 同步 | 成功码 | 错误码 |
|--------|--------|--------|------|------|------|------|--------|--------|
| 创建团队 | Vue | collab-service:8091 | POST | `/api/v1/teams` | Bearer JWT | -->> | 201 | 401/500 |
| 团队列表 | Vue | collab-service:8091 | GET | `/api/v1/teams` | Bearer JWT | -->> | 200 | 401/500 |
| 邀请成员 | Vue | collab-service:8091 | POST | `/api/v1/teams/:id/invitations` | Bearer JWT | -->> | 201 | 401/403/404/500 |
| 项目邀请 | Vue | collab-service:8091 | POST | `/api/v1/collab/invite` | Bearer JWT | -->> | 200 | 401/500 |
| 实时同步 | Vue | collab-service:8091 | WS | `/ws?projectId=x` | JWT (握手) | <--> (长连) | — | 401 |

---

## 八、完整事件总线 (Redis Pub-Sub)

```mermaid
sequenceDiagram
    participant USVC as user-service :8088
    participant PSVC as project-service :8089
    participant WSVC as workflow-engine :8084
    participant BSVC as billing-service :8090
    participant ASVC as asset-service :8085
    participant CSVC as collab-service :8091
    participant ART as ai-router :8083
    participant NTFY as notification-service :8092
    participant RD as 🟤 Redis :6379

    Note over USVC,NTFY: ═══ 全部 9 条事件总线 (异步) ═══

    USVC-)RD: PUB auth.user.created
    RD-)BSVC: SUB → 新用户自动建账户
    RD-)NTFY: SUB → 发欢迎邮件

    PSVC-)RD: PUB project.created
    RD-)WSVC: SUB → 初始化项目工作流空间
    RD-)ASVC: SUB → 预建项目资产目录

    WSVC-)RD: PUB workflow.run.started
    RD-)NTFY: SUB → 通知创作者

    WSVC-)RD: PUB workflow.run.completed
    RD-)BSVC: SUB → 计算总成本 + 扣费
    RD-)NTFY: SUB → 通知创作者 '完成'

    WSVC-)RD: PUB workflow.run.failed
    RD-)NTFY: SUB → 通知创作者 '失败'

    ART-)RD: PUB ai.task.completed
    RD-)BSVC: SUB → 自动扣费 (tokens × 单价)

    ASVC-)RD: PUB asset.created
    RD-)WSVC: SUB → 通知工作流资产就绪

    BSVC-)RD: PUB billing.subscription.changed
    RD-)USVC: SUB → 更新用户权限

    BSVC-)RD: PUB noti.send.email
    RD-)NTFY: SUB → 发邮件提醒充值/余额不足
```

| # | 事件名 | 发布者 | 订阅者 | 触发条件 | 用途 |
|---|--------|--------|--------|----------|------|
| 1 | `auth.user.created` | user-service:8088 | billing:8090, notification:8092 | 注册成功 | 新用户自动建账户 |
| 2 | `project.created` | project-service:8089 | workflow-engine:8084, asset:8085 | 创建项目 | 初始化工作流空间 |
| 3 | `workflow.run.started` | workflow-engine:8084 | notification:8092 | 启动工作流 | 通知创作者 |
| 4 | `workflow.run.completed` | workflow-engine:8084 | billing:8090, notification:8092 | 完成 DAG | 扣费 + 通知 |
| 5 | `workflow.run.failed` | workflow-engine:8084 | notification:8092 | DAG 失败 | 失败通知 |
| 6 | `ai.task.completed` | ai-router:8083 | billing:8090 | AI 调用完成 | tokens × 单价扣费 |
| 7 | `asset.created` | asset-service:8085 | workflow-engine:8084 | 资产上传成功 | 工作流获取 CDN URL |
| 8 | `billing.subscription.changed` | billing-service:8090 | user-service:8088 | 订阅升降级 | 更新用户权限 |
| 9 | `noti.send.email` | billing-service:8090 | notification:8092 | 余额不足 | 发邮件提醒 |

---

## 九、鉴权体系总览

```mermaid
sequenceDiagram
    participant FE as 🟢 Vue 前端
    participant GW as 🟡 Kong :8000
    participant SVC as 🔵 业务服务

    Note over FE,SVC: ═══ 三层鉴权 ═══

    Note over GW: 第 1 层: Kong 网关<br/>- 限流 (100 req/min per user)<br/>- CORS 白名单<br/>- 路由转发 (+ inject user_id from JWT)

    Note over SVC: 第 2 层: authMiddleware<br/>- 读 Authorization: Bearer <jwt><br/>- jwt.verify() → req.userId<br/>- 验失败 → 401

    Note over SVC: 第 3 层: 权限校验<br/>- 资源 owner 检查 (project.ownerId === req.userId → 403)<br/>- role 检查 (admin/superadmin → 403)

    Note over FE,SVC: ═══ 鉴权矩阵 ═══

    Note over FE,SVC: 公开端点 (无需鉴权):<br/>POST /api/v1/auth/login<br/>POST /api/v1/auth/register<br/>POST /api/v1/auth/refresh

    Note over FE,SVC: Bearer JWT (必传):<br/>所有其他 /api/v1/* 端点

    Note over FE,SVC: x-api-key (服务间):<br/>/v1/orchestrator/*<br/>/v1/ai/* (内部调用)<br/>/v1/helper/* (内部调用)
```

| 鉴权方式 | 适用场景 | Header | 验证位置 |
|----------|----------|--------|----------|
| 无鉴权 | `/api/v1/auth/login`, `/register`, `/refresh` | — | — |
| Bearer JWT | 所有用户面 `/api/v1/*` 端点 | `Authorization: Bearer <jwt>` | Kong → authMiddleware → jwt.verify |
| x-api-key | 服务间调用 (ai-orchestrator, workflow→ai) | `x-api-key: <service_key>` | 服务自身中间件 |
| JWT (WebSocket 握手) | wss://workflow-engine:8084/ws | URL query `?token=jwt` | 握手时验证 |

---

## 十、错误码规范 (谢擎标准)

| 错误码 | HTTP | 含义 | 触发场景 | 前端展示 |
|--------|------|------|----------|----------|
| `0` | 200/201 | 成功 | 正常请求 | data 字段 |
| `40000` | 400 | 参数错误 | 必填字段缺失/格式错 | toast: err.message |
| `40100` | 401 | 未登录 | 无 token | 跳登录页 |
| `40101` | 401 | 密码错误 | 登录密码不匹配 | toast: '邮箱或密码错误' |
| `40102` | 401 | token 无效 | jwt.verify 失败 | 清 token 跳登录 |
| `40103` | 401 | refreshToken 过期 | 超过 7 天 | 清 token 跳登录 |
| `40201` | 402 | 支付失败 | mock 支付 5% 失败 | toast: '支付失败，请重试' |
| `40300` | 403 | 无权访问 | 非项目 owner | toast: '无权访问' |
| `40301` | 403 | 不可给他人充值 | userId !== token.userId | toast: '不可给其他用户充值' |
| `40400` | 404 | 资源不存在 | 项目/用户/工作流 ID 无效 | toast: '资源不存在' |
| `40900` | 409 | 冲突 | 邮箱已注册 | toast: '该邮箱已注册' |
| `50000` | 500 | 服务器错误 | try/catch 捕获 | toast: err.message `\|` `操作失败 (${r.status})` |

---

## 十一、综合统计

### 链路统计

| 功能域 | 链路数 | 涉及服务 | 端点 |
|--------|--------|----------|------|
| 用户登录鉴权 | 6 | user-service:8088 | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/me`, `/me/password` |
| 项目管理 CRUD | 8 | project-service:8089, collab-service:8091 | `/projects`, `/projects/:id`, `/characters`, `/projects/:id/shots`, `/collab/invite` |
| 工作流执行 | 16 | workflow-engine:8084, ai-orchestrator:8087, ai-helper:8086, ai-router:8083, asset-service:8085 | `/workflows`, `/workflows/start`, `/orchestrator/jobs`, `/ai/*`, `/helper/*`, `/assets` |
| 计费充值 | 11 | billing-service:8090 | `/billing/balance`, `/billing/recharge`, `/billing/invoices`, `/orders`, `/subscriptions`, `/billing/cost-logs`, `/refunds` |
| AI 推理直调 | 16 | ai-router:8083, ai-helper:8086, ai-keys-service:8082, user-service:8088, asset-service:8085 | `/ai/image/generate`, `/ai/video/generate`, `/ai/tts`, `/helper/*`, `/user/api-keys` |
| 协作服务 | 5 | collab-service:8091 | `/teams`, `/teams/:id/invitations`, `/collab/invite`, `/ws` |
| 事件总线 | 9 | 全部 7 服务 + Redis | `auth.user.created` → `noti.send.email` |
| **总计** | **71** | **12 服务** | **35+ 真实端点** |

### 5 核心服务调用链汇总

| 服务 | 端口 | 链路数 | 主要端点 | 依赖 |
|------|------|--------|----------|------|
| **user-service** | 8088 | 16 | `/auth/*`, `/me`, `/users`, `/user/api-keys`, `/subscriptions`, `/quotas` | PostgreSQL |
| **project-service** | 8089 | 8 | `/projects`, `/projects/:id/shots`, `/characters` | PostgreSQL |
| **collab-service** | 8091 | 5 | `/teams`, `/teams/:id/invitations`, `/collab/invite`, `/ws` | PostgreSQL |
| **billing-service** | 8090 | 11 | `/billing/*`, `/orders`, `/subscriptions`, `/refunds`, `/quota` | PostgreSQL + Redis Pub-Sub |
| **ai-orchestrator** | 8087 | 6 | `/v1/orchestrator/jobs`, `/v1/orchestrator/jobs/:id` (P1-P5 pipelines) | ai-router, ai-helper, PostgreSQL, Redis |

### 鉴权覆盖

| 鉴权方式 | 端点占比 | 说明 |
|----------|----------|------|
| Bearer JWT | ~70% | 所有用户面 `/api/v1/*` 端点 |
| x-api-key | ~20% | 服务间调用 (ai-orchestrator, workflow→ai) |
| 无鉴权 | ~10% | `/auth/login`, `/register`, `/refresh` |

---

> **谢擎署名**：本调用链文件基于林染 196 节点业务流程图 + API_REFERENCE.md 真实端点，所有接口名、端口号、事件名均来自现有代码/架构文档。5 核心服务 (user/project/collab/billing/ai-orchestrator) 全部涵盖。
>
> **文件位置**：`D:\ManhuaWorks\docs\architecture\SERVICE_CALL_CHAIN_2026-06-10.md`
>
> **链路总数**：**71 条** (6 登录 + 8 项目 + 16 工作流 + 11 计费 + 16 AI + 5 协作 + 9 事件)
