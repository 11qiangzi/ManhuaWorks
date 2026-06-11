# SCREENSHOT-GUIDE — 截屏指南

> demo 用 3 张 PNG 截图复现「ToonflowBridge 跑 1 集」的 3 个关键时刻。
> 实际 demo 里这三张图由 `run.ts` 的 `takeScreenshot()` 自动生成，**不需要**手动开浏览器。

---

## 3 个截屏时刻

| 截图 | 时刻 | 视觉含义 | 文件 |
|---|---|---|---|
| **01-input** | demo 启动后，bridge.start() 之前 | 小说文本已读入，pipeline 还没启动 | `outputs/screenshots/01-input.png` |
| **02-running** | bridge 在 poll 阶段，进度 50% 左右 | WS 进度在推，5 步走完 3 步 | `outputs/screenshots/02-running.png` |
| **03-done** | bridge.waitForResult() 拿到 success | 60s mp4 已落盘，pipeline 全绿 | `outputs/screenshots/03-done.png` |

---

## 视觉编码

为了**无浏览器、无字体依赖**地表达这 3 个时刻，run.ts 用 ffmpeg `gradients` + `drawbox` 生成 3 张视觉差异明显的 PNG：

| 截图 | 背景渐变 | 底部进度条 | 含义 |
|---|---|---|---|
| 01-input | `0x0a1f44 → 0x1a3a6e`（深空蓝 → 暗夜） | 0/5 段亮（5 段都灰） | 输入已加载，待启动 |
| 02-running | `0x1a3a6e → 0x2a5c9e`（暗夜 → 中蓝） | 3/5 段亮（极光蓝） | 推进中（mock ~50%） |
| 03-done | `0x2a5c9e → 0x7ac0ee`（中蓝 → 极光蓝） | 5/5 段亮（极光蓝） | 跑完，mp4 落盘 |

> 颜色越亮 = 状态越靠后。3 张图肉眼可一眼分辨。

---

## 怎么用 Playwright 截「真浏览器」版

如果 W6 之后 demo 要展示真实 Toonflow Web UI 截图（不是这种 ffmpeg 伪截图），可以这样：

```bash
# 1. 装 playwright
cd D:\ManhuaWorks\demo\toonflow-demo-v1
npm install -D playwright
npx playwright install chromium

# 2. 写截屏脚本（伪代码）
cat > take-real-shots.ts <<'EOF'
import { chromium } from "playwright";

const URL = process.env.TOONFLOW_UI_URL ?? "http://127.0.0.1:10588";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto(URL);
await page.waitForSelector("text=启明号");
await page.screenshot({ path: "outputs/screenshots/01-input.png" });

// 触发 run
await page.click("button:has-text('生成')");
await page.waitForSelector("text=进度 50%", { timeout: 60_000 });
await page.screenshot({ path: "outputs/screenshots/02-running.png" });

// 等完成
await page.waitForSelector("text=完成", { timeout: 600_000 });
await page.screenshot({ path: "outputs/screenshots/03-done.png" });

await browser.close();
EOF

# 3. 起 toonflow web (W1 demo server)
cd D:\ManhuaWorks\apps\demo
node --import tsx src/server.ts &
sleep 5

# 4. 截
cd D:\ManhuaWorks\demo\toonflow-demo-v1
npx tsx take-real-shots.ts
```

> 上述需要 `apps/demo/` (W1 Toonflow Web UI) + `apps/demo/toonflow-app/`（Toonflow 1.1.7 build）就绪。W5 demo 阶段不强制。

---

## 为什么用 ffmpeg 伪截图（不用真浏览器）？

| 项 | ffmpeg 伪截图 | Playwright 真截图 |
|---|---|---|
| 依赖 | 只需 ffmpeg（已装） | playwright + chromium（~150MB 下载） |
| 跑通时间 | < 1s/张 | 5-15 min/集（等真 pipeline） |
| 视觉差异 | 强（色 + 进度条一眼分） | 中（依赖 UI 状态同步） |
| 失败模式 | 几乎不会失败 | pipeline 失败 → 截到错误页 |
| 适用阶段 | W5 demo 验证 | W6+ 用户体验 demo |

> W5 任务核心是「桥接层能跑通」，不是「UI 漂亮」。真 UI 截图放 W6。

---

## 校验截图正确

```bash
# 1. 文件存在
ls -la outputs/screenshots/
# 01-input.png    25961  (or similar)
# 02-running.png  32248
# 03-done.png     22041

# 2. 是合法 PNG
file outputs/screenshots/*.png
# 期望：PNG image data, 1280 x 720, 8-bit/color RGB, non-interlaced

# 3. 三张大小不同（说明视觉有差异）
# 期望 01/02/03 字节数各不相同

# 4. 颜色随序号「变亮」
# 01: 深蓝；02: 中蓝；03: 亮蓝
```

---

## 时刻对应到 `run.ts` 代码

| 截图 | `run.ts` 触发点 | 状态参数 |
|---|---|---|
| 01-input | `loadNovelText()` 后 | `input loaded (196 chars)` |
| 02-running | `onProgress` 第 1 次返回 + 第 4 次 | `WS progress: starting pipeline` / `running 20%` |
| 03-done | `waitForResult()` 返回后 | `done in 16.2s · $0.42 · 71KB` |

`takeScreenshot()` 函数：

```ts
// run.ts:118-167
async function takeScreenshot(name: string, statusLine: string): Promise<void> {
  const outPng = join(SHOTS_DIR, name);
  const spec = {
    "01-input.png":   { bg1: "0x0a1f44", bg2: "0x1a3a6e", activeBars: 0 },
    "02-running.png": { bg1: "0x1a3a6e", bg2: "0x2a5c9e", activeBars: 3 },
    "03-done.png":    { bg1: "0x2a5c9e", bg2: "0x7ac0ee", activeBars: 5 },
  };
  // ... drawbox 拼接 5 段进度条 + drawbox 横线表示 UI 元信息
  // ... ffmpeg gradients + drawbox 滤镜
  // 失败兜底：纯渐变 PNG
}
```
