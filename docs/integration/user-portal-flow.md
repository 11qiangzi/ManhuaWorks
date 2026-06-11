# user-portal 端到端集成流

> **目的**：从用户注册到第一次完成作品导出的**完整链路**，覆盖 user-portal 全模块协作。
> **范围**：浏览器 → api-gateway → user-service / project-service / asset-service / collab-service / billing-service / workflow-engine
> **作者**：陆流光
> **更新日期**：2026-06-08

## 角色

| 角色 | 身份 | 计划 |
|:--|:--|:--|
| **林启**（主用户） | 个人创作者，前考古助理，写灰星 1500 章 | Pro |
| **苏眀**（协作者） | 受邀编辑，帮忙改剧本 | Pro |
| **新用户 A** | 完全没接触过 ManhuaWorks | Free |

---

## 流程总览

```mermaid
flowchart LR
    A[1. 注册/登录] --> B[2. 创建项目]
    B --> C[3. 上传资产]
    C --> D[4. 邀请协作者]
    D --> E[5. 协作编辑]
    E --> F[6. 评论反馈]
    F --> G[7. 导出作品]
    
    A -->|触发| A1[user-service]
    B -->|触发| B1[project-service]
    C -->|触发| C1[asset-service]
    D -->|触发| D1[collab-service]
    E -->|触发| E1[asset-service v2<br/>+ workflow-engine]
    F -->|触发| F1[collab-service]
    G -->|触发| G1[workflow-engine<br/>+ ai-orchestrator]
    
    style A fill:#FFE4B5
    style G fill:#90EE90
```

---

## 1. 登录（林启）

### 1.1 浏览器侧

```ts
// src/views/Login.vue
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()
const router = useRouter()

async function handleLogin() {
  try {
    await userStore.login('linqi@example.com', 'P@ssw0rd!')
    router.push('/projects')
  } catch (err) {
    if (err.code === '2fa_required') {
      router.push({ name: '2fa', query: { challenge: err.challenge_id }})
    } else {
      toast.error(err.message)
    }
  }
}
```

### 1.2 请求链

```mermaid
sequenceDiagram
    participant V as Vue SPA
    participant G as api-gateway:8080
    participant U as user-service:8081
    participant R as Redis
    
    V->>G: POST /v1/auth/login
    G->>G: 限流检查 (5/min/IP)
    G->>U: 转发（带 mTLS）
    U->>U: bcrypt 校验密码
    U->>R: 存 refresh_token (TTL 7d)
    U-->>G: { access_token, refresh_token, user }
    G-->>V: 200 + Set-Cookie HttpOnly (refresh)
    V->>V: localStorage.setItem('access_token', ...)
    V->>V: Pinia store.user = user
```

### 1.3 Pinia 状态

```ts
// src/stores/user.ts
export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    accessToken: '',
    refreshToken: '',
  }),
  actions: {
    async login(email: string, password: string) {
      const { data } = await api.post('/v1/auth/login', { email, password })
      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      this.user = data.user
    }
  }
})
```

---

## 2. 创建项目

### 2.1 用户操作

林启登录后点「新建项目」→ 选「小说」类型 → 选「科幻」模板 → 命名「灰星 1500 章」→ 点「创建」。

### 2.2 前端流程

```ts
// src/views/Projects/NewProject.vue
async function onCreate() {
  const project = await projectStore.create({
    name: '灰星 1500 章',
    type: 'novel',
    template_id: 'tpl_sci_fi',
  })
  router.push(`/projects/${project.id}`)
}
```

### 2.3 服务间协作

```mermaid
sequenceDiagram
    participant V as Vue
    participant G as api-gateway
    participant P as project-service
    participant C as collab-service
    participant DB as Postgres
    
    V->>G: POST /v1/projects
    G->>P: 转发
    P->>DB: INSERT projects
    P->>C: gRPC AddMember(project_id, owner=u_123, role=owner)
    C->>DB: INSERT project_members
    P-->>G: 201 { id: p_456 }
    G-->>V: 201 { project }
    
    Note over C: 同时发 event 给林启 WebSocket<br/>(room: user:u_123)
```

**注意**：项目 owner 由 project-service 创建，**不通过 collab-service HTTP**，直接 gRPC 调用，避免循环依赖。

---

## 3. 上传资产

### 3.1 场景

林启把「灰星」小说的**第 1 章手写笔记**拍照上传为图片资产。

### 3.2 4 步上传协议

```mermaid
sequenceDiagram
    participant V as Vue
    participant G as gateway
    participant A as asset-service
    participant S3 as 对象存储
    participant DB as Postgres
    
    V->>V: 用户选文件 chapter01.jpg (3.2MB)
    V->>V: 计算 SHA-256
    
    V->>G: POST /v1/assets/uploads/init
    Note over V,G: { filename, size, content_type, checksum, project_id }
    G->>A: 转发
    A->>A: 套餐配额检查
    A->>S3: 生成预签名 PUT URL (TTL 600s)
    A->>DB: INSERT assets (status=pending)
    A-->>G: 200 { upload_url, asset_id: a_001 }
    G-->>V: 200
    
    V->>S3: PUT upload_url (raw bytes)
    S3-->>V: 200 (E-Tag)
    
    V->>G: POST /v1/assets/uploads/complete
    Note over V,G: { asset_id, etag }
    G->>A: 转发
    A->>S3: HEAD 验证 checksum
    A->>DB: UPDATE status=ready
    A->>C: gRPC RecordActivity(verb=uploaded, ...)
    A-->>G: 200 { asset }
    G-->>V: 200
    
    V->>V: 资产库列表追加新卡片
```

### 3.3 进度反馈

前端在 `axios.put(upload_url, file, { onUploadProgress })` 监听进度条。

---

## 4. 邀请协作者

### 4.1 场景

林启邀请好友「苏眀」加入项目做编辑。

### 4.2 前端表单

```ts
// src/views/Project/Members.vue
async function invite(email: string, role: 'editor') {
  try {
    const { data } = await api.post(`/v1/collab/projects/p_456/invitations`, {
      email, role,
      message: '一起把灰星搞成漫剧',
    })
    toast.success(`邀请已发到 ${email}`)
    copyToClipboard(data.invite_url)
  } catch (err) {
    if (err.code === 'already_member') toast.warning('该用户已是协作者')
  }
}
```

### 4.3 多服务协作

```mermaid
sequenceDiagram
    participant V as Vue
    participant G as gateway
    participant C as collab-service
    participant M as 邮件服务
    participant DB as Postgres
    participant WS as WebSocket
    
    V->>G: POST /v1/collab/projects/p_456/invitations
    G->>C: 转发
    C->>C: 套餐配额检查 (Pro 10 人)
    C->>DB: INSERT invitations
    C->>M: 发邀请邮件 (含 invite_url)
    C->>DB: INSERT activities (verb=invited)
    C-->>G: 201 { invitation_id, invite_url }
    G-->>V: 201
    
    Note over WS: 苏眀上线后<br/>WebSocket 推 notification_received
```

### 4.4 苏眀接受邀请

苏眀点邮件链接 → 浏览器打开 `https://manhuaworks.com/invitations/inv_abc?token=xyz` → 调用：

```ts
await api.post(`/v1/collab/invitations/inv_abc/accept`, { token: 'xyz' })
```

```mermaid
sequenceDiagram
    participant S as 苏眀浏览器
    participant C as collab-service
    participant DB
    participant LK as 林启浏览器
    
    S->>C: POST /v1/collab/invitations/inv_abc/accept
    C->>C: 验证 token (HMAC-SHA256)
    C->>DB: UPDATE invitations.accepted_at
    C->>DB: INSERT project_members (role=editor)
    C->>DB: INSERT activities (verb=joined)
    C->>DB: INSERT notifications (给林启)
    C-->>S: 200 { project_id, role, redirect_to }
    
    C->>LK: WS event { kind: member_joined, user: 苏眀 }
```

---

## 5. 协作编辑

### 5.1 场景

林启和苏眀**同时**打开同一张「EP01 海报」做最后润色。

### 5.2 协作会话开启

```ts
// 双方都执行
const { data: session } = await api.post(
  `/v1/assets/v2/a_002/collab-session`,
  { mode: 'edit', client: { app: 'user-portal', version: '1.4.0', tab_id: 't_001' }}
)

// 建立 WebSocket
const ws = new WebSocket(session.websocket_url)
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'hello',
    token: accessToken,
    client: { app: 'user-portal', version: '1.4.0', tab_id: 't_001' }
  }))
}
```

### 5.3 CRDT 双向同步

```mermaid
sequenceDiagram
    participant L as 林启<br/>(tab t_001)
    participant W as WS 节点
    participant S as 苏眀<br/>(tab t_002)
    
    L->>W: WS awareness { cursor: {x:0.3,y:0.5} }
    W->>S: WS awareness { from: u_123, state: {...} }
    
    L->>W: WS crdt_update (改图层1)
    W->>W: Redis pub/sub 广播
    W->>S: WS crdt_update { from: u_123 }
    
    S->>W: WS crdt_update (改图层2)
    W->>L: WS crdt_update { from: u_456 }
    
    Note over L,S: Yjs 自动合并，无冲突
```

### 5.4 锁场景

苏眀需要**独占**修改「标题图层」5 分钟：

```ts
const { data: lock } = await api.post(
  `/v1/assets/v2/a_002/collab-session/acquire-lock`,
  { session_id: 's_xyz', lock_type: 'exclusive', scope: 'layer:title', ttl_sec: 300 }
)

// 5 分钟内林启改标题图层会被拒
// 锁到期自动释放，或主动 release
```

---

## 6. 评论反馈

### 6.1 苏眀加批注

苏眀在第 12 帧画了个红圈 + 写评论：

```ts
await api.post(`/v1/assets/v2/a_002/annotations`, {
  frame: 12,
  shape: 'rect',
  coords: { x: 0.42, y: 0.30, w: 0.15, h: 0.10 },
  color: '#FF6B35',
  comment_body: '@林启 这块标题再大一号',
  mentions: ['u_123'],
})
```

### 6.2 通知 + 活动流

```mermaid
sequenceDiagram
    participant S as 苏眀
    participant A2 as asset-service v2
    participant C as collab-service
    participant DB
    participant L as 林启
    
    S->>A2: POST /annotations
    A2->>C: gRPC CreateComment
    C->>DB: INSERT comments
    C->>DB: INSERT activities
    C->>DB: INSERT notifications (林启)
    A2-->>S: 201 { id, comment_id }
    
    C->>L: WS event { kind: comment_created }
    C->>L: WS notification_received
    L->>L: 浏览器 Toast + 铃铛红点
```

### 6.3 林启回复

```ts
await api.post(`/v1/collab/comments/c_001/replies`, {
  body: '好，我改大一号',
})
```

→ 苏眀也收到通知 + 活动流。

---

## 7. 导出作品

### 7.1 林启点「导出」

```ts
// src/views/Work/Export.vue
const { data } = await api.post(`/v1/works/w_001/export`, {
  format: 'mp4',
  resolution: '1080p',
  watermark: false,
})

// 订阅 SSE
const evtSource = new EventSource(
  `${VITE_API_BASE}/v1/works/w_001/exports/stream?token=${accessToken}`
)
evtSource.addEventListener('done', (e) => {
  const { url } = JSON.parse(e.data)
  window.open(url)
  evtSource.close()
})
```

### 7.2 全链路时序

```mermaid
sequenceDiagram
    participant V as Vue
    participant G as gateway
    participant W as workflow-engine
    participant O as ai-orchestrator
    participant AS as asset-service
    participant S3 as 对象存储
    participant N as collab-service
    
    V->>G: POST /v1/works/w_001/export
    G->>W: 触发工作流 ExportDrama
    W->>O: 调度 AI 渲染任务
    O->>AS: 拉取所有分镜资产
    AS-->>O: 资产签名 URL
    O->>O: 调用视频生成 AI
    O->>S3: 上传渲染结果
    O-->>W: 完成
    W->>G: 更新 export.status=done
    G->>V: SSE event: { status: done, url }
    
    W->>N: 发送通知 (export_completed)
    N->>V: WS notification_received
```

### 7.3 完成后

林启浏览器收到：
- 站内通知（铃铛红点 +5）
- 邮件（如开启了"导出完成"邮件通知）
- 移动推送（如手机登录了 App）

---

## 状态变更时序总图

```mermaid
sequenceDiagram
    participant U as 林启
    participant S as 苏眀
    participant UP as user-portal<br/>(api-gateway)
    participant US as user-service
    participant PS as project-service
    participant AS as asset-service
    participant CS as collab-service
    participant WE as workflow-engine
    
    U->>UP: 1. 登录
    UP->>US: 鉴权
    US-->>UP: JWT
    
    U->>UP: 2. 创建项目
    UP->>PS: 创建
    PS->>CS: gRPC addMember(owner)
    CS-->>PS: ok
    PS-->>UP: p_456
    
    U->>UP: 3. 上传资产 (a_001)
    UP->>AS: init + complete
    AS-->>UP: a_001
    
    U->>UP: 4. 邀请苏眀
    UP->>CS: 创建邀请
    CS-->>UP: inv_abc
    
    S->>UP: 接受邀请
    UP->>CS: accept
    CS-->>UP: editor role
    
    U->>UP: 5a. 打开资产协作
    UP->>AS: 开 collab-session
    AS-->>UP: ws_url
    
    S->>UP: 5b. 打开同一资产
    UP->>AS: 开 collab-session
    AS-->>UP: active_users=[林启]
    
    Note over U,S: CRDT 双向同步（步骤 5c-5d 略）
    
    S->>UP: 6. 加批注
    UP->>AS: POST /annotations
    AS->>CS: gRPC CreateComment
    CS-->>AS: comment_id
    
    U->>UP: 7. 申请导出
    UP->>WE: 触发工作流
    WE-->>UP: SSE done
```

---

## 失败场景 & 兜底

| 步骤 | 失败点 | 兜底策略 |
|:--|:--|:--|
| 登录 | 网络断 | 离线登录 + 本地缓存令牌 |
| 创建项目 | 服务挂 | 重试 3 次 → 失败 Toast + 草稿本地保存 |
| 上传 | 上传中断 | 断点续传（multipart） |
| 邀请 | 邮件失败 | 站内通知 + 链接复制 |
| 协作 | WebSocket 断 | 指数退避重连 + 重新订阅 |
| 评论 | 重复提交 | 幂等键 (`Idempotency-Key`) |
| 导出 | AI 任务超时 | 重试 1 次 → 转人工 |

---

## 性能预算

| 步骤 | 端到端目标 | 实际典型 |
|:--|:--|:--|
| 登录 | < 1s | 350ms |
| 创建项目 | < 500ms | 120ms |
| 上传 3MB | < 3s | 1.8s |
| 邀请 | < 1s | 200ms |
| 开协作会话 | < 300ms | 80ms |
| 评论 | < 500ms | 150ms |
| 导出 60s 漫剧 | < 5min | 3min |

---

## 相关测试

- 端到端：`tests/e2e/novel-to-drama.test.ts`
- 协作时序：`tests/collab-service/realtime.test.ts`
- HTTP 路由：`tests/collab-service/routes.test.ts`
- 前端组件：`tests/user-portal/components.test.ts`
- 前端逻辑：`tests/user-portal/composables.test.ts`
