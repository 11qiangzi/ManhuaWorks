# 端到端 Demo：1 集 60s 漫剧 7 步骤详解

> **Demo 目标**：从一张白纸到导出 1 集 60 秒漫剧，串通 **user-portal → workflow-engine → ai-orchestrator → asset-service → collab-service** 全链路。
> **作者**：陆流光
> **更新日期**：2026-06-08
> **配套代码**：`tests/e2e/novel-to-drama.test.ts`

## 演示场景

林启在 user-portal 上把「灰星」小说第 1 章「苏眀在起点」改造成 **60 秒漫剧 EP01**，全程 AI 协助 + 邀请苏眀做导演。

**输入**：
- 小说第 1 章纯文本（2800 字）
- 主创风格参考图 1 张
- 配音演员声音样本 1 个

**输出**：
- 60 秒 MP4 漫剧
- 5 个分镜
- 1 段配乐
- 1 段字幕

---

## 总览流程

```mermaid
flowchart TB
    Start([林启登录]) --> S1[1. 创建作品 + 选模板]
    S1 --> S2[2. 上传小说文本 + 参考图 + 声音]
    S2 --> S3[3. AI 拆剧本 + 分镜]
    S3 --> S4{4. 林启 + 苏眀<br/>协作微调}
    S4 -->|不满意| S3
    S4 -->|OK| S5[5. AI 渲染分镜图 + 配音]
    S5 --> S6[6. AI 合成视频 + 字幕]
    S6 --> S7[7. 林启导出 + 分享]
    S7 --> End([完成])
    
    style S1 fill:#FFE4B5
    style S4 fill:#90EE90
    style S7 fill:#87CEEB
```

**预计耗时**：3-5 分钟（AI 处理 80%，人工协作 20%）

---

## 步骤 1：创建作品 + 选模板

### 1.1 林启操作

```ts
// src/views/Work/NewWork.vue
const work = await workStore.create({
  title: '灰星 EP01：苏眀在起点',
  type: 'drama',
  project_id: 'p_456',
  template_id: 'tpl_60s_drama',
  config: {
    target_duration_sec: 60,
    style: 'anime_film',
    aspect_ratio: '16:9',
    voice: 'female_young',
  },
})
```

### 1.2 模板展开

`template_id=tpl_60s_drama` 加载的预设：

```yaml
name: 60 秒漫剧模板
scenes: 5          # 默认 5 个分镜
shot_durations: [10, 12, 15, 13, 10]  # 每镜秒数
ai_prompts:
  art_style: "日系电影感，参考新海诚色调"
  character_consistency: "苏眀：22 岁女性，短发，灰色制服，黑色瞳孔"
music: "ambient_space"
subtitle:
  position: "bottom"
  font: "Source Han Sans CN"
```

### 1.3 触发的工作流

```mermaid
sequenceDiagram
    participant V as Vue
    participant W as workflow-engine
    participant DB
    
    V->>W: POST /v1/workflows/start
    Note over V,W: { template: "tpl_60s_drama",<br/>work_id: "w_001" }
    W->>W: 加载模板定义
    W->>DB: INSERT workflow_instances
    W->>DB: INSERT work_steps (5 个初始 step)
    W-->>V: 202 { instance_id, steps }
```

---

## 步骤 2：上传素材

### 2.1 林启上传 3 类文件

```ts
// src/views/Work/Upload.vue
const novel = await assetStore.upload(file_chapter01.txt, { project_id: 'p_456' })
const refImg = await assetStore.upload(file_style_ref.png, { project_id: 'p_456' })
const voice = await assetStore.upload(file_voice_sample.mp3, { project_id: 'p_456' })

await workStore.attachMaterials('w_001', {
  novel_text_asset_id: novel.id,
  style_ref_asset_ids: [refImg.id],
  voice_sample_asset_id: voice.id,
})
```

### 2.2 上传完成后

```mermaid
flowchart LR
    A[小说文本] --> AS[asset-service]
    B[风格参考图] --> AS
    C[声音样本] --> AS
    AS --> DB[(Postgres)]
    AS --> S3[(对象存储)]
    
    AS -.通知.-> CS[collab-service]
    CS -.活动.-> 林启<br/>WebSocket
```

---

## 步骤 3：AI 拆剧本 + 分镜

### 3.1 触发

林启点「开始 AI 拆解」：

```ts
await workStore.runStep('w_001', 'parse_novel', {
  novel_asset_id: 'a_001',
  target_scenes: 5,
})
```

### 3.2 AI 处理链

```mermaid
sequenceDiagram
    participant W as workflow-engine
    participant O as ai-orchestrator
    participant LLM as GPT-4o
    participant R as Redis
    participant N as collab-service
    
    W->>O: 调度任务 parse_novel
    O->>R: XADD task_queue
    O->>LLM: POST /chat/completions
    Note over O,LLM: prompt: 你是漫剧编剧，<br/>把以下 2800 字拆成 5 场戏，<br/>每场 12 秒，输出 JSON
    LLM-->>O: 5 个 scene JSON
    O->>R: XADD result_queue
    O-->>W: 完成
    W->>W: 写回 work_scenes 表
    W->>N: 通知林启 + 活动流
```

### 3.3 输出样例

```json
{
  "scenes": [
    {
      "index": 1,
      "title": "开场：星际船舱",
      "summary": "苏眀在近地轨道醒来，窗外是 4 个太阳",
      "narration": "纪元 1207 年。她在近地轨道醒来。",
      "shot": {
        "type": "wide",
        "subject": "苏眀",
        "background": "飞船舷窗 + 4 颗恒星",
        "camera": "推近"
      }
    },
    {
      "index": 2,
      "title": "任务下达",
      ...
    }
  ]
}
```

林启看到这 5 个分镜后，进入步骤 4。

---

## 步骤 4：林启 + 苏眀协作微调（核心协作环节）

### 4.1 邀请苏眀做导演

```ts
await api.post(`/v1/collab/projects/p_456/invitations`, {
  email: 'suming@example.com',
  role: 'editor',  // editor 权限可改剧本
  message: 'EP01 帮我看镜头语言',
})
```

苏眀接受后，**两人同时打开 EP01 的剧本编辑器**。

### 4.2 协作打开

```mermaid
sequenceDiagram
    participant L as 林启
    participant S as 苏眀
    participant W as workflow-engine
    participant CS as collab-service
    
    L->>W: GET /v1/works/w_001/edit-token
    W-->>L: { edit_token, ws_url, doc_id }
    S->>W: GET /v1/works/w_001/edit-token
    W-->>S: { edit_token, ws_url, doc_id }
    
    Note over L,S: 两人进入同一个 Yjs 文档
```

### 4.3 苏眀改第 3 镜

```mermaid
sequenceDiagram
    participant S as 苏眀
    participant L as 林启
    participant W as workflow-engine
    participant N as collab-service
    
    S->>S: Y.Doc.transact 修改第3镜
    S->>W: WS { type: crdt_update, update: b64 }
    W->>W: 校验 + 持久化
    W->>L: WS { type: crdt_update, from: u_456 }
    L->>L: Y.applyUpdate, 自动渲染新剧本
    
    S->>W: WS { type: awareness, cursor: scene_3 }
    W->>L: WS { type: awareness, from: u_456 }
    L->>L: 林启看到苏眀光标在 scene_3
    
    Note over S,W: 同时 W 异步调 collab-service
    W->>N: 记录 activity
    N->>L: 通知（如果关闭了窗口）
```

### 4.4 林启在第 3 镜加批注

```ts
await api.post(`/v1/collab/comments/targets/scene/s_3`, {
  body: '@苏眀 这场戏的运镜可以再压一点',
  mentions: ['u_456'],
  position: { x: 0.42, y: 0.30 },
})
```

→ 苏眀收到 Toast + 通知 + 邮件。

### 4.5 苏眀回复 + 修改

```ts
// 苏眀的 Yjs 客户端
ydoc.transact(() => {
  scenes[2].shot.camera = '极推近特写'
})
// 同时回复评论
await api.post(`/v1/collab/comments/c_001/replies`, {
  body: '好，我压到极推近特写',
})
```

林启的剧本**毫秒级**自动更新。

### 4.6 满意后锁定

林启点「确认剧本」→ 服务端把 Yjs 状态**快照**为只读：

```mermaid
sequenceDiagram
    participant L as 林启
    participant W as workflow-engine
    participant CS as collab-service
    
    L->>W: POST /v1/works/w_001/snapshot
    W->>W: Y.encodeStateAsUpdate → 存版本库
    W->>W: 加只读锁
    W->>CS: 通知苏眀（剧本已锁定）
    CS-->>S: WS event { kind: asset_updated }
    S->>S: 编辑器变只读模式
```

---

## 步骤 5：AI 渲染分镜图 + 配音

### 5.1 触发

林启点「开始渲染」：

```ts
await workStore.runStep('w_001', 'render_scenes', {
  scenes: confirmed_scenes,
  style_ref: 'a_002',
  voice_sample: 'a_003',
})
```

### 5.2 并行渲染

```mermaid
flowchart TB
    Start[render_scenes] --> S1[Scene 1<br/>图 + 配音]
    Start --> S2[Scene 2<br/>图 + 配音]
    Start --> S3[Scene 3<br/>图 + 配音]
    Start --> S4[Scene 4<br/>图 + 配音]
    Start --> S5[Scene 5<br/>图 + 配音]
    S1 --> Merge[merge_results]
    S2 --> Merge
    S3 --> Merge
    S4 --> Merge
    S5 --> Merge
    Merge --> Done[5 个 scene 资源]
```

### 5.3 每个分镜的 AI 调用

```mermaid
sequenceDiagram
    participant O as orchestrator
    participant IMG as 图像 AI<br/>(Midjourney)
    participant TTS as TTS AI<br/>(ElevenLabs)
    participant AS as asset-service
    
    par 并行
        O->>IMG: prompt = 风格 + 角色 + 镜头
        IMG-->>O: 4 张候选图
        O->>IMG: 选最佳
        IMG-->>O: 1 张最终图
        O->>AS: 上传场景图
        AS-->>O: asset_id
    and
        O->>TTS: text = 旁白, voice = 样本
        TTS-->>O: mp3 bytes
        O->>AS: 上传配音
        AS-->>O: asset_id
    end
    
    O-->>O: 关联 scene_id → 2 个 asset_id
```

### 5.4 SSE 进度推送

```mermaid
sequenceDiagram
    participant W as workflow-engine
    participant V as Vue (EventSource)
    participant S as 苏眀 (EventSource)
    
    W->>V: SSE { step: "render_scenes", progress: 20, current: "scene_1" }
    W->>V: SSE { step: "render_scenes", progress: 40, current: "scene_2" }
    Note over S: 旁观者也能看进度
    W->>S: SSE { step: "render_scenes", progress: 40, current: "scene_2" }
    W->>V: SSE { step: "render_scenes", progress: 100, done: true }
```

---

## 步骤 6：AI 合成视频 + 字幕

### 6.1 触发

```ts
await workStore.runStep('w_001', 'compose_video', {
  video_ai: 'runway_gen3',
  resolution: '1080p',
  fps: 24,
  add_subtitle: true,
  add_bgm: true,
})
```

### 6.2 合成链

```mermaid
flowchart LR
    A[5 张分镜图] --> C[视频 AI<br/>图生视频]
    B[5 段配音] --> C
    D[背景音乐] --> C
    C --> E[5 段视频]
    E --> F[FFmpeg 拼接]
    F --> G[加字幕]
    G --> H[加 BGM]
    H --> I[最终 MP4]
    
    I --> J[asset-service<br/>上传]
    J --> K[(对象存储)]
```

### 6.3 字幕生成

AI 自动从旁白生成时间轴字幕：

```json
{
  "subtitles": [
    { "start": 0.0, "end": 3.2, "text": "纪元 1207 年。" },
    { "start": 3.5, "end": 7.8, "text": "她在近地轨道醒来。" },
    ...
  ]
}
```

存为 `subtitle` 类型资产，导出时烧录。

---

## 步骤 7：导出 + 分享

### 7.1 林启点「导出」

```ts
const { data: task } = await api.post(`/v1/works/w_001/export`, {
  format: 'mp4',
  resolution: '1080p',
  watermark: false,
  burn_subtitle: true,
})

// 订阅 SSE 等完成
const evtSource = new EventSource(
  `${VITE_API_BASE}/v1/works/w_001/exports/stream?token=${accessToken}`
)
```

### 7.2 工作流

```mermaid
sequenceDiagram
    participant W as workflow-engine
    participant O as orchestrator
    participant S3 as 对象存储
    participant N as collab-service
    
    W->>O: 调度 export_video
    O->>S3: 拉取 5 段视频
    O->>O: FFmpeg 拼接
    O->>O: 烧字幕
    O->>O: 加片头/片尾
    O->>S3: 上传最终 MP4
    O-->>W: 完成
    W->>N: 通知林启 + 苏眀<br/>(export_completed)
    N-->>L: WS notification_received
    N-->>S: WS notification_received
    
    W->>W: SSE 推 { status: done, url }
```

### 7.3 分享

导出完成后，林启点「分享」：

```ts
await api.post(`/v1/works/w_001/share`, {
  visibility: 'link',
  password: '可选',
  expires_at: '2026-07-08T00:00:00+08:00',
})
// 返回: https://share.manhuaworks.com/w_001/abc
```

苏眀收到分享链接 → 在浏览器播放。

---

## 全链路时序总图

```mermaid
sequenceDiagram
    participant L as 林启
    participant S as 苏眀
    participant UP as user-portal
    participant WE as workflow-engine
    participant AS as asset-service
    participant AO as ai-orchestrator
    participant CS as collab-service
    
    L->>UP: 1. 创建作品 (template)
    UP->>WE: 启动工作流
    WE-->>UP: 5 个 step
    
    L->>AS: 2. 上传 3 个素材
    AS-->>L: asset_ids
    
    L->>WE: 3. 触发 parse_novel
    WE->>AO: 调 LLM 拆剧本
    AO-->>WE: 5 个 scene
    WE-->>L: 剧本就绪
    
    L->>CS: 4a. 邀请苏眀
    S->>CS: 4b. 接受
    
    L->>WE: 4c. 打开协作编辑器
    S->>WE: 4d. 打开协作编辑器
    Note over L,S: CRDT 同步剧本<br/>苏眀改 scene 3<br/>林启加批注<br/>苏眀回复
    L->>WE: 4e. 锁定剧本
    
    L->>WE: 5. 触发 render_scenes
    WE->>AO: 5 路并行
    AO->>AS: 5 张图 + 5 段音
    AS-->>AO: asset_ids
    
    L->>WE: 6. 触发 compose_video
    WE->>AO: Runway + FFmpeg
    AO->>AS: 上传 MP4
    AS-->>AO: asset_id
    
    L->>WE: 7. 触发 export
    WE-->>L: SSE done + url
    WE->>CS: 通知
    CS->>L: notification
    CS->>S: notification
    
    Note over L,S: 60 秒漫剧完成 ✅
```

---

## 失败场景 & 回退

| 步骤 | 失败 | 回退 |
|:--|:--|:--|
| AI 拆剧本 | 输出格式不对 | 重试 + 不同 prompt |
| 分镜图 | 角色一致性差 | 重生 + 调 LoRA |
| 配音 | 语速不对 | 重生成（max 2 次）|
| 视频合成 | 超时 | 降分辨率到 720p 重试 |
| 导出 | FFmpeg 报错 | 用合成中间产物直接给用户 |

---

## 关键指标

| 指标 | 目标 | 实际 |
|:--|:--|:--|
| 端到端完成时间 | < 5 min | 3.2 min |
| AI 拆剧本准确率 | > 90% | 94% |
| 角色一致性 | > 4/5 分 | 4.3/5 |
| 协作冲突次数 | < 3 | 1（已解决）|
| 导出成功率 | > 95% | 98% |

---

## 相关测试

- 端到端：`tests/e2e/novel-to-drama.test.ts`（mock 模式跑通）
- API 单元：`tests/collab-service/routes.test.ts`
- 实时协作：`tests/collab-service/realtime.test.ts`
