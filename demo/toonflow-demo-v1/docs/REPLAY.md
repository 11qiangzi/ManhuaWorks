# REPLAY — 一键回放说明

> 把 demo 在另一台机器上完整跑一遍，照着这份做就行。

---

## 0. 准备

### 0.1 系统要求

| 工具 | 版本 | 检查命令 |
|---|---|---|
| Node.js | ≥ 20.10 | `node --version` |
| pnpm | ≥ 8.x（推荐；用 npm 也行） | `pnpm --version` |
| ffmpeg | ≥ 6.x | `ffmpeg -version` |
| curl | any | `curl --version` |
| bash | ≥ 4（Git Bash / WSL / macOS 自带） | `bash --version` |

### 0.2 准备产物

```bash
# 路径假定
ROOT=D:\ManhuaWorks          # 或 ~/work/ManhuaWorks
DEMO=$ROOT/demo/toonflow-demo-v1
BRIDGE=$ROOT/packages/toonflow-bridge

# 1) 确保 bridge dist 已构建（demo 直接 import 它的 dist）
cd $BRIDGE
pnpm install         # 至少要装好 typescript + tsx + ws
pnpm run build       # 产出 dist/

# 2) 把 demo 的 node_modules 软链到 bridge 的（demo 不重装依赖）
cd $DEMO
mkdir -p node_modules/@manhuaworks
ln -s $BRIDGE node_modules/@manhuaworks/toonflow-bridge
ln -s $BRIDGE/node_modules/tsx       node_modules/tsx
ln -s $BRIDGE/node_modules/ws        node_modules/ws
ln -s $BRIDGE/node_modules/.bin      node_modules/.bin
```

> ⚠️ demo 没在 pnpm workspace 里（避免和 W3/W4 锁版本冲突），所以用 junction/symlink 复用 bridge 的 node_modules。

### 0.3 （可选）跑一次 bridge 的 unit test，确认 dist 没问题

```bash
cd $BRIDGE
pnpm test
# 期望：bridge.test.ts + mapper.test.ts 全绿
```

---

## 1. 起服务

```bash
cd $DEMO
bash setup.sh --bg
```

期望输出：
```
[setup] pnpm available
[setup] starting mock ai-orchestrator on :18090
[setup] mock-orchestrator pid=NNNN (logs: …/logs/mock-orch.log)
[setup] mock-orchestrator healthy
[setup] === done ===
```

健康检查：
```bash
curl -s http://127.0.0.1:18090/v1/orchestrate/health
# 期望：{"status":"ok","service":"mock-ai-orchestrator","pipelines":["novel-to-drama"]}
```

---

## 2. 跑 demo

```bash
cd $DEMO
export ORCHESTRATOR_URL=http://127.0.0.1:18090
export MOCK_STEP_INTERVAL_MS=1000   # 7 stage × 2 transitions × 1s ≈ 14s + overhead
node --import tsx run.ts
```

期望输出（节选）：

```
[   0.00s] === ToonflowBridge demo v1 ===
[   0.00s] MANHUA_PIPELINE_NAME = novel-to-drama
[   0.00s] orchestrator = http://127.0.0.1:18090
[   0.00s] generating mock 60s mp4 via ffmpeg
[   0.87s] ffmpeg done, mp4 ready
[   0.87s] loaded novel text: 197 bytes, 191 non-ws chars
[   0.95s] screenshot 01-input.png ...
[   1.04s] --- bridge.start() ---
[   1.04s] [bridge] [orch-http] POST http://127.0.0.1:18090/v1/orchestrate/novel-to-drama
[   1.07s] [bridge] [bridge] start jobId=... runId=run_... status=running
[   1.07s] [progress #1] status=running progress=5% node=storyboard
...
[  14.69s] [progress #11] status=composing progress=99% node=compose
[  16.20s] [progress #12] status=done progress=100% node=compose
[  16.20s] === result ===
[  16.20s]   status        = done
[  16.20s]   finalVideoUrl = http://127.0.0.1:18090/output/demo-episode-01.mp4
[  16.20s]   shots.length  = 5
[  16.20s]   costUsd       = 0.420
[  16.20s] sha256 = 52a75e4097780666291f3baa1fd7fe038fd35d1fec61e1c6ea280aabe3da7767
[  16.20s] size   = 70.9 KB
[  16.29s] screenshot 03-done.png [done in 16.2s · $0.42 · 71KB]
[  16.29s] === DONE ===
```

---

## 3. 校验产出

```bash
cd $DEMO
ls -la outputs/
# 期望：
# demo-episode-01.mp4          72581 bytes
# demo-episode-01.mp4.sha256       86 bytes
# metrics.json
# screenshots/
#   01-input.png
#   02-running.png
#   03-done.png

# 校验 mp4
ffmpeg -i outputs/demo-episode-01.mp4 2>&1 | grep Duration
# 期望：Duration: 00:01:00.00

# 校验 sha256
cd outputs
sha256sum -c demo-episode-01.mp4.sha256
# 期望：demo-episode-01.mp4: OK
```

---

## 4. 停服务

```bash
cd $DEMO
bash setup.sh --stop
# 期望：[setup] no pid file, nothing to stop
# 兜底：pkill 掉 mock + tsc -w
```

---

## 预期产出清单

跑通后**必须**出现的文件：

```
D:\ManhuaWorks\demo\toonflow-demo-v1\
├── outputs/
│   ├── demo-episode-01.mp4          ✓ 60.00s 1280x720 H.264
│   ├── demo-episode-01.mp4.sha256   ✓ sha256 校验和
│   ├── metrics.json                 ✓ 完整性能数据
│   └── screenshots/
│       ├── 01-input.png             ✓ 41-43 KB（深空蓝，0/5 进度）
│       ├── 02-running.png           ✓ 36-46 KB（中蓝，3/5 进度）
│       └── 03-done.png              ✓ 22-41 KB（亮蓝，5/5 进度）
├── logs/
│   ├── run.log                      ✓ run.ts 输出
│   ├── run-final.log                ✓ 完整版
│   └── mock-orch.log                ✓ mock 端日志
├── docs/
│   ├── REPLAY.md                    ✓ 本文件
│   ├── METRICS.md                   ✓ 性能数据
│   └── SCREENSHOT-GUIDE.md          ✓ 截屏指南
├── inputs/
│   └── demo-novel.txt               ✓ 200 字小说片段
├── src/
│   └── mock-orchestrator.ts         ✓ 严格按 bridge 契约实现
├── run.ts                           ✓ 入口
├── setup.sh                         ✓ 一键起服务
├── package.json                     ✓ 依赖软链到 bridge
├── tsconfig.json                    ✓ ESM 编译
└── README.md                        ✓ 总览
```

---

## 附录 A：真实服务启动（可选）

如果想跑真实 5 服务链路（替代 mock）：

```bash
# 1. 起 W3 服务（ai-router / ai-keys / ai-orchestrator）
cd $ROOT/services/ai-router       && pnpm dev &
cd $ROOT/services/ai-keys-service && pnpm dev &
cd $ROOT/services/ai-orchestrator && pnpm dev &

# 2. 起 W4 服务（workflow-engine / asset-service）
cd $ROOT/services/workflow-engine && pnpm dev &
cd $ROOT/services/asset-service   && pnpm dev &

# 3. 等 5 服务健康
for p in 8083 8084 8085 8087 8088; do
  curl -sf http://127.0.0.1:$p/health >/dev/null && echo "8083 OK" || echo "$p DOWN"
done

# 4. 跑 demo，指向真 8087
cd $DEMO
export ORCHESTRATOR_URL=http://127.0.0.1:8087
node --import tsx run.ts
```

> ⚠️ 真实 5 服务启动后，cost / latency 会变成真 AI 调用数据（image-gen / tts / video-gen 真打各 provider），不是 mock 的固定 $0.42。

---

## 附录 B：故障排查

| 现象 | 原因 | 修法 |
|---|---|---|
| `mock-orchestrator port 18090 already in use` | 上次没干净停 | `bash setup.sh --stop` 或 `lsof -i:18090` 找进程 kill |
| `ffmpeg: command not found` | 没装 ffmpeg | `choco install ffmpeg`（Windows）/ `brew install ffmpeg`（mac） |
| `Error: Cannot find module '@manhuaworks/toonflow-bridge'` | symlink 没建 | 按 §0.2 重建软链 |
| `connect ECONNREFUSED 127.0.0.1:18090` | mock 没起 | 重跑 `bash setup.sh --bg` |
| `bridge.test.ts 失败` | bridge dist 旧 | `cd $BRIDGE && pnpm run build && pnpm test` |
| `mp4 是 0 字节 / Duration N/A` | ffmpeg 在 5 个 lavfi 输入上被 OS 拒绝 | 检查 ffmpeg 版本（≥ 6.x）+ 系统可打开多文件描述符 |
