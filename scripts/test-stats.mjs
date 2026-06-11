#!/usr/bin/env node
/**
 * test-stats.mjs — ManhuaWorks 累计测试统计脚本
 * =========================================================================
 * 用途：
 *   1. 静态扫描全仓库所有 vitest 测试文件，统计 it/test 用例数
 *   2. 按顶层目录 + service/app + tests 分类 4 维度聚合
 *   3. 读 .learnings/test-baseline.json（若存在）算 delta
 *   4. 可选地真实跑 `npx vitest run --reporter=json` 校准（默认关闭，遵守 30 分钟任务规则）
 *   5. 写 D:\ManhuaWorks\docs\verification\test-stats.json
 *
 * 用法：
 *   node D:\ManhuaWorks\scripts\test-stats.mjs                 # 静态扫描
 *   node D:\ManhuaWorks\scripts\test-stats.mjs --services=user,ai-orchestrator  # 只扫指定
 *   node D:\ManhuaWorks\scripts\test-stats.mjs --baseline      # 对比基线
 *   node D:\ManhuaWorks\scripts\test-stats.mjs --run           # 真跑 vitest（耗时，慢）
 *   node D:\ManhuaWorks\scripts\test-stats.mjs --help
 *
 * 退出码：
 *   0 = 成功（即使累计数为 0）
 *   2 = 参数错误
 * =========================================================================
 */

import { promises as fs } from "node:fs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = "D:/ManhuaWorks"; // 硬编码，遵循"禁止 web_fetch/查外部"约束
const OUT_JSON = "D:/ManhuaWorks/docs/verification/test-stats.json";
const BASELINE = "D:/ManhuaWorks/.learnings/test-baseline.json";

/* ============== 参数解析 ============== */
function parseArgs(argv) {
  const args = {
    services: null, // string[] | null
    baseline: false,
    run: false,
    help: false,
    json: false,
  };
  for (const a of argv.slice(2)) {
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--baseline") args.baseline = true;
    else if (a === "--run") args.run = true;
    else if (a === "--json") args.json = true;
    else if (a.startsWith("--services=")) {
      args.services = a
        .slice("--services=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      console.error(`[test-stats] unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

/* ============== 文件发现 ============== */
const SKIP_DIRS = /node_modules|\.git|dist|coverage|\.turbo|\.next|out\b/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/;

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.test(p) || SKIP_DIRS.test(e.name)) continue;
      yield* walk(p);
    } else if (e.isFile() && TEST_FILE.test(e.name)) {
      yield p;
    }
  }
}

async function listTestFiles(root, servicesFilter) {
  const all = [];
  for await (const f of walk(root)) {
    all.push(f);
  }
  if (!servicesFilter) return all.sort();
  return all
    .filter((f) => servicesFilter.some((s) => f.includes(`${path.sep}${s}${path.sep}`) || f.includes(`/${s}/`)))
    .sort();
}

/* ============== vitest 配置发现（独立 walk 实例，避免 generator 复用）============== */
async function findVitestConfigs(root) {
  const out = [];
  async function* walkCfg(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.test(p) || SKIP_DIRS.test(e.name)) continue;
        yield* walkCfg(p);
      } else if (e.isFile() && /vitest\.config\.(ts|js|mjs|cjs)$/.test(e.name)) {
        yield p;
      }
    }
  }
  for await (const f of walkCfg(root)) out.push(f);
  return out.sort();
}

/* ============== 静态测试计数 ============== */
// 匹配 it(/test( 含 .skip/.only/.concurrent/.todo；不匹配 describe
const TEST_CALL = /(?<![.\w$])(it|test)(?:\.(?:skip|only|concurrent|todo))?\s*\(/g;

function countTestsInFile(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    return { tests: 0, err: e.message };
  }
  // 去掉注释行（// ... 和 /* ... */）减少误判（粗略）
  // 这里不去除，避免误删反引号字符串里的 it/test
  const matches = text.match(TEST_CALL);
  return { tests: matches ? matches.length : 0 };
}

/* ============== 分组 ============== */
function groupByTopDir(files) {
  const m = {};
  for (const f of files) {
    const rel = f.replace(/^[A-Z]:[\\/]ManhuaWorks[\\/]/, "").replace(/\\/g, "/");
    const top = rel.split("/")[0] || "?";
    m[top] = (m[top] || 0) + countTestsInFile(f).tests;
  }
  return m;
}

function groupByService(files) {
  const m = {};
  for (const f of files) {
    const rel = f.replace(/^[A-Z]:[\\/]ManhuaWorks[\\/]/, "").replace(/\\/g, "/");
    const parts = rel.split("/");
    const key = parts.slice(0, 2).join("/");
    m[key] = m[key] || { files: 0, tests: 0 };
    const c = countTestsInFile(f);
    m[key].files += 1;
    m[key].tests += c.tests;
  }
  return m;
}

function groupByType(files) {
  // 单元/集成/E2E/冒烟 简单按路径关键字
  const m = { unit: 0, integration: 0, e2e: 0, smoke: 0, resilience: 0 };
  for (const f of files) {
    const lower = f.toLowerCase().replace(/\\/g, "/");
    const c = countTestsInFile(f).tests;
    if (/\/tests\/e2e\//.test(lower)) m.e2e += c;
    else if (/\/tests\/integration\//.test(lower)) m.integration += c;
    else if (/smoke/.test(lower)) m.smoke += c;
    else if (/resilience/.test(lower)) m.resilience += c;
    else m.unit += c;
  }
  return m;
}

/* ============== 可选：真跑 vitest ============== */
async function runVitestInWorkspace(configPath) {
  // 静默跑，捕获 stdout，最后一行通常有 "Tests  N passed"
  const { spawn } = await import("node:child_process");
  const cwd = path.dirname(configPath);
  return new Promise((resolve) => {
    const child = spawn("npx", ["vitest", "run", "--reporter=basic", "--silent"], {
      cwd,
      shell: true,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    const t = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.on("close", (code) => {
      clearTimeout(t);
      // 抓 "Test Files  N passed" 或 "Tests  N passed"
      const testsMatch = out.match(/Tests\s+(\d+)\s+passed/i);
      const filesMatch = out.match(/Test Files\s+(\d+)\s+passed/i);
      resolve({
        config: configPath,
        exitCode: code,
        tests: testsMatch ? Number(testsMatch[1]) : null,
        files: filesMatch ? Number(filesMatch[1]) : null,
        durationMs: null,
        outTail: out.split(/\r?\n/).slice(-3).join("\n"),
      });
    });
  });
}

/* ============== 基线对比 ============== */
function loadBaseline() {
  if (!existsSync(BASELINE)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    return null;
  }
}

function diffToBaseline(current, baseline) {
  if (!baseline) return null;
  return {
    tests: current.totals.tests - (baseline.totals?.tests || 0),
    files: current.totals.files - (baseline.totals?.files || 0),
  };
}

/* ============== 主流程 ============== */
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`test-stats.mjs — ManhuaWorks 累计测试统计

用法：
  node test-stats.mjs                       静态扫描（默认）
  node test-stats.mjs --services=user,...   只扫指定 service/app
  node test-stats.mjs --baseline            对比 .learnings/test-baseline.json
  node test-stats.mjs --run                 真实跑 vitest 校准（慢）
  node test-stats.mjs --json                输出 JSON 到 stdout
  node test-stats.mjs --help                帮助
`);
    return;
  }

  const t0 = Date.now();
  if (!existsSync(REPO_ROOT)) {
    console.error(`[test-stats] REPO_ROOT not found: ${REPO_ROOT}`);
    process.exit(2);
  }

  console.log(`[test-stats] root: ${REPO_ROOT}`);
  if (args.services) {
    console.log(`[test-stats] filter services: ${args.services.join(", ")}`);
  }

  // 1. 列测试文件
  const files = await listTestFiles(REPO_ROOT, args.services);
  console.log(`[test-stats] test files found: ${files.length}`);

  // 2. 静态扫描
  let totalTests = 0;
  const perFile = [];
  for (const f of files) {
    const { tests, err } = countTestsInFile(f);
    totalTests += tests;
    perFile.push({ file: f.replace(REPO_ROOT, "").replace(/^[\\/]/, ""), tests, err });
  }

  // 3. 分组
  const byService = groupByService(files);
  const byTop = groupByTopDir(files);
  const byType = groupByType(files);

  // 4. vitest 配置
  const vitestConfigs = await findVitestConfigs(REPO_ROOT);
  console.log(`[test-stats] vitest configs: ${vitestConfigs.length}`);

  // 5. 可选：真跑
  let liveRuns = null;
  if (args.run) {
    console.log(`[test-stats] running vitest in each workspace (may take minutes)...`);
    liveRuns = [];
    for (const cfg of vitestConfigs) {
      const r = await runVitestInWorkspace(cfg);
      liveRuns.push(r);
      console.log(`  ${path.dirname(cfg).replace(REPO_ROOT, "")} : tests=${r.tests ?? "?"} files=${r.files ?? "?"} exit=${r.exitCode}`);
    }
  }

  // 6. 累计
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    filter: { services: args.services },
    totals: {
      files: files.length,
      tests: totalTests,
      vitestConfigs: vitestConfigs.length,
    },
    byTopDir: byTop,
    byService: byService,
    byType: byType,
    perFile: perFile,
    liveRuns: liveRuns,
    elapsedMs: Date.now() - t0,
  };

  // 7. 基线
  const baseline = loadBaseline();
  const baselineDiff = diffToBaseline(report, baseline);
  report.baseline = baseline;
  report.baselineDiff = baselineDiff;

  // 8. 写文件
  try {
    await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
    writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");
    console.log(`[test-stats] wrote ${OUT_JSON}`);
  } catch (e) {
    console.error(`[test-stats] failed to write ${OUT_JSON}: ${e.message}`);
  }

  // 9. 输出
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("");
  console.log("================ ManhuaWorks 累计测试统计 ================");
  console.log(`测试文件: ${report.totals.files}`);
  console.log(`测试用例: ${report.totals.tests}`);
  console.log(`vitest 配置: ${report.totals.vitestConfigs}`);
  console.log(`耗时: ${report.elapsedMs}ms`);
  console.log("");
  console.log("—— 按顶层目录 ——");
  for (const [k, v] of Object.entries(byTop).sort()) {
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(5)} tests`);
  }
  console.log("");
  console.log("—— 按 service/app ——");
  for (const [k, v] of Object.entries(byService).sort()) {
    console.log(`  ${k.padEnd(40)} files=${String(v.files).padStart(3)} tests=${String(v.tests).padStart(4)}`);
  }
  console.log("");
  console.log("—— 按测试类型 ——");
  for (const [k, v] of Object.entries(byType)) {
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(5)} tests`);
  }
  if (baselineDiff) {
    console.log("");
    console.log(`—— 基线对比 ——`);
    console.log(`  delta tests: ${baselineDiff.tests >= 0 ? "+" : ""}${baselineDiff.tests}`);
    console.log(`  delta files: ${baselineDiff.files >= 0 ? "+" : ""}${baselineDiff.files}`);
  } else if (args.baseline) {
    console.log("");
    console.log(`—— 基线 ——`);
    console.log(`  (no baseline at ${BASELINE}; skip diff)`);
  }
  console.log("============================================================");
}

main().catch((e) => {
  console.error(`[test-stats] fatal: ${e.stack || e.message}`);
  process.exit(1);
});
