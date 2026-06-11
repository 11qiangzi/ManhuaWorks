# ManhuaWorks Demo - Toonflow 1.1.7

> W1 交付物 · 漫改部 / 钟帧  
> 目标：在 `D:\ManhuaWorks\apps\demo\` 跑通 Toonflow 1.1.7 本地演示，访问 `http://localhost:10588/`。

---

## 0. 这是什么

把开源项目 [Toonflow 1.1.7](https://github.com/HBAI-Ltd/Toonflow-app) (D:\Toonflow) 的 build 产物搬到 ManhuaWorks 仓库内，做成可一键启动的 demo app，用于 W1 评审展示"小说粘贴 → 漫剧生成"全流程。

**核心约束**：

- ❌ **不修改** `D:\Toonflow\` 原版任何文件
- ✅ demo 完整自包含在 `D:\ManhuaWorks\apps\demo\`
- ✅ 一键启动：双击 `start.bat`
- ✅ 默认端口 10588（与 Toonflow 原版一致）

---

## 1. 目录结构

```
D:\ManhuaWorks\apps\demo\
├── package.json              # demo 自身 (只装 tsx)
├── README.md                 # 本文件
├── start.bat                 # ⭐ 一键启动入口
├── setup-deps.bat            # 依赖补装 (better-sqlite3 binary 等)
├── verify.md                 # 验证报告
├── src\
│   └── server.ts             # 父进程: 拉起 Toonflow + 端口健康检查
├── toonflow-app\             # Toonflow 1.1.7 完整副本 (从 D:\Toonflow\Toonflow-app 复制)
│   ├── data\serve\app.js     # ⭐ Toonflow 编译入口 (sucrase bundle)
│   ├── data\db2.sqlite       # 启动时自动初始化
│   └── node_modules\         # 独立补装, 不影响原版
├── demo-input\
│   └── 第一章.txt            # demo 输入: ~1000 字短小说片段
├── demo-output\              # demo 输出: 留空, 跑通流程后存放生成的漫剧文件
└── logs\                     # 启动日志
```

---

## 2. 部署步骤

### 一次性准备 (首次部署)

如果 `toonflow-app\node_modules\better-sqlite3\build\Release\better_sqlite3.node` 已存在，**跳过此步**。

```powershell
# 在 D:\ManhuaWorks\apps\demo\ 下
.\setup-deps.bat
```

这个脚本会做三件事：
1. `npm install` demo 自身的 `tsx`（跑 `.ts` 用）
2. 进 `toonflow-app/` 用 `npm install --legacy-peer-deps --ignore-scripts` 装 Toonflow 依赖
3. 从 GitHub release 拉 `better-sqlite3-v12.10.0-node-v127-win32-x64.tar.gz` 预编译，解压到正确位置

> ⚠️ 为什么不用 `npm rebuild better-sqlite3`? 本机没装 Visual Studio, node-gyp 编译会失败。预编译二进制 (NAPI v127 = Node 22) 是最稳的路。

### 启动

```powershell
# 双击
D:\ManhuaWorks\apps\demo\start.bat

# 或命令行
cd D:\ManhuaWorks\apps\demo
.\start.bat
```

预期日志（乱码是 PowerShell 终端编码问题，不影响运行）：

```
[demo-server ...] 配置:
[demo-server ...]   PORT     = 10588
[demo-server ...]   OSSURL   = http://localhost:10588/
[demo-server ...]   CWD      = ...\toonflow-app
[demo-server ...]   ENTRY    = ...\toonflow-app\data\serve\app.js
[demo-server ...] 启动 Toonflow 子进程 ...
[toonflow] 数据库目录: ...\toonflow-app\data\db2.sqlite
[toonflow] 文件目录: ...\toonflow-app\data\oss
[toonflow] [服务启动成功]: http://localhost:10588
[demo-server ...] ✅ 健康检查通过，访问 http://localhost:10588/
```

---

## 3. 访问方式

启动成功后，浏览器打开 **http://localhost:10588/** 即可看到 Toonflow 首页。

| 入口 | URL |
|------|-----|
| 首页 | http://localhost:10588/ |
| API | http://localhost:10588/api/... |
| WebSocket | ws://localhost:10588/api/socket/... |

> Toonflow 自带前端 (`toonflow-app\data\web\`)，由 Express 静态托管。

---

## 4. 跑通 "小说粘贴 → 漫剧生成 1 集 60s"

详细的逐步操作和验证记录见 [`verify.md`](./verify.md)。

快速版：

1. 浏览器打开 `http://localhost:10588/`
2. 系统设置里配好一个 LLM API Key（首次必须；没有可临时跳过某些 AI 步骤，看 UI 演示也够）
3. 首页 → 「新建项目」 → 粘贴 `demo-input\第一章.txt` 的内容
4. 选集数 1 / 单集时长 60s → 点「一键生成」
5. 等待 3-10 分钟（取决于 LLM 响应），可在「作品列表」看到生成的漫剧
6. 漫剧文件（分镜图 + 配音 + 视频片段）会落到 `toonflow-app\data\oss\projects\...` 下

> 完整流程需要至少 1 个可用的图像/视频/语音模型 API（OpenAI / DeepSeek / 阿里通义 / 自建 ComfyUI 等）。
> **W1 demo 重点是"流程跑通"**（UI 流转 + 数据库 + 文件落盘），不要求画面精美。

---

## 5. 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| `Cannot find module '@huggingface/transformers'` | 依赖没装 | 跑 `setup-deps.bat` |
| `NODE_MODULE_VERSION 123 ≠ 127` | prebuilt ABI 不匹配 | 确认下载的是 `node-v127-...` 版本 |
| 端口 10588 被占 | 上次没正常退出 | `start.bat` 会自动 kill 占用进程 |
| 启动后 2s 看不到 "服务启动成功" | 内部初始化慢 | 再等 5-10s，Toonflow 启动需要时间 |
| 乱码日志 | 终端 GBK 编码 | 不影响运行；要美化可 `chcp 65001` |

---

## 6. 卸载 / 清理

整个 demo 都在 `D:\ManhuaWorks\apps\demo\`，要清理直接删目录即可，**不动** `D:\Toonflow\` 原版。

要重启 Toonflow 数据库（清空所有项目）：

```powershell
Remove-Item D:\ManhuaWorks\apps\demo\toonflow-app\data\db2.sqlite
# 下次启动会自动重建
```

---

## 7. 责任人

- **W1 负责人**：钟帧（漫改部）
- **评审入口**：`./verify.md`
- **回滚方式**：删 `D:\ManhuaWorks\apps\demo\`
