/**
 * Demo: 1 集 60s 漫剧，跑 3 个 quality mode
 *
 * 用法：
 *   pnpm tsx examples/run-novel-to-drama.refined.ts
 *
 * 输出：
 *   - cost / latency / cache hits / peak concurrency（每个 mode）
 *   - benchmark 时间表
 *
 * 注意：examples/ 在 src/ 外（package root），用相对路径引用 src/
 */

import { runNovelToDramaOnce } from "../src/pipelines/novel-to-drama.refined.js";

const SAMPLE_TEXT = `夜色笼罩着整座废墟之城，林启独自站在坍塌的天文台废墟上。
他的手心攥着那本泛黄的古书，封面上的符文在月光下隐隐发光。
"八号……你到底藏在哪里？"他低声呢喃。
风卷起沙尘，远处的城市灯火忽明忽暗，仿佛某种古老的力量正在苏醒。
林启深吸一口气，踏出第一步，鞋底碰触碎石的声响在空旷的废墟中回响。
他不知道的是，远在三十万公里外的灰星上，一艘飞船正缓缓下降……
`;

const SAMPLE_TEXT_2 = `${SAMPLE_TEXT}

三个月后，考古队在天文台地下发现了一间密封的金属舱室。
舱室表面布满了从未见过的纹路，温度低到能冻裂钢铁。
林启戴上手套，小心翼翼地打开了舱门，里面是一台球形的银色装置。
装置表面浮动着淡蓝色的光点，像一群活着的萤火虫。
"这是……"林启屏住了呼吸，伸出手去触碰那光点。
`;

async function main(): Promise<void> {
  const modes = ["cost", "speed", "quality"] as const;
  const summary: Array<{
    mode: string;
    success: boolean;
    cost: number;
    imageCount: number;
    videoCount: number;
    audio: boolean;
    cacheHits: number;
    benchmarkMs: number;
    totalMs: number;
  }> = [];

  for (const m of modes) {
    const t0 = Date.now();
    process.stdout.write(`\n=== mode=${m} ===\n`);
    const r = await runNovelToDramaOnce({
      text: SAMPLE_TEXT_2,
      chapterTitle: "废墟之城 · 第一章",
      styleKey: "ink_painting",
      artStyle: "ink_painting",
      durationSeconds: 60,
      qualityMode: m,
    });
    const totalMs = Date.now() - t0;
    const bm = r.benchmark;
    const imgN = r.imageUrls.length;
    const vidN = r.videoUrls.length;
    process.stdout.write(
      `[${m}] success=${r.success} cost=$${r.cost.toFixed(2)} images=${imgN} videos=${vidN} audio=${!!r.audioUrl} cacheHits=${r.cacheHits} total=${totalMs}ms\n`,
    );
    process.stdout.write(`  marks: ${bm.marks.map((x) => `${x.name}=${x.deltaMs}ms`).join(" | ")}\n`);

    summary.push({
      mode: m,
      success: r.success,
      cost: r.cost,
      imageCount: imgN,
      videoCount: vidN,
      audio: !!r.audioUrl,
      cacheHits: r.cacheHits,
      benchmarkMs: bm.totalMs,
      totalMs,
    });
  }

  process.stdout.write(`\n=== summary ===\n`);
  for (const s of summary) {
    process.stdout.write(
      `mode=${s.mode.padEnd(8)} cost=$${s.cost.toFixed(2).padStart(6)}  images=${s.imageCount}  videos=${s.videoCount}  audio=${s.audio ? "yes" : "no "}  cacheHits=${s.cacheHits}  time=${s.totalMs}ms\n`,
    );
  }
}

void main().catch((err) => {
  process.stderr.write(`[demo] failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
