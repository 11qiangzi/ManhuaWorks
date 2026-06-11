/**
 * ManhuaWorks Demo Server (W1 交付)
 * --------------------------------
 * 职责：把 Toonflow 1.1.7 的 build（data/serve/app.js）作为子进程拉起，
 *      在 :10588 暴露 Toonflow 的 Web UI。
 *
 * 设计要点：
 *  1. 不修改 D:\Toonflow 原版任何文件
 *  2. 副本在 ./toonflow-app/，由独立 npm 装好依赖
 *  3. Toonflow 用相对路径读 data/，所以 cwd 必须锁在 toonflow-app/
 *  4. 端口/OSSURL/工作目录全部从环境变量可覆盖
 *  5. 父进程只做进程托管和健康检查，不碰 Toonflow 业务逻辑
 *  6. 关闭父进程时优雅地杀掉 Toonflow 子进程
 */

import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import * as http from "node:http";

const PORT = parseInt(process.env.PORT ?? "10588", 10);
const OSSURL = process.env.OSSURL ?? `http://localhost:${PORT}/`;
const TOONFLOW_DIR = resolve(__dirname, "..", "toonflow-app");
const TOONFLOW_ENTRY = join(TOONFLOW_DIR, "data", "serve", "app.js");
const IS_VERIFY = process.argv.includes("--verify");

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[demo-server ${ts}] ${msg}`);
}

function die(msg: string): never {
  console.error(`[demo-server] FATAL: ${msg}`);
  process.exit(1);
}

// ---- 预检 ----
if (!existsSync(TOONFLOW_DIR)) {
  die(`toonflow-app/ 不存在: ${TOONFLOW_DIR}`);
}
if (!existsSync(TOONFLOW_ENTRY)) {
  die(`Toonflow 入口不存在: ${TOONFLOW_ENTRY}（build 没装？）`);
}

log(`配置:`);
log(`  PORT     = ${PORT}`);
log(`  OSSURL   = ${OSSURL}`);
log(`  CWD      = ${TOONFLOW_DIR}`);
log(`  ENTRY    = ${TOONFLOW_ENTRY}`);

// ---- 启动 Toonflow ----
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "prod",
  PORT: String(PORT),
  OSSURL,
  // Toonflow 内部用 express-ws + socket.io，强制走 IPv4
  NODE_OPTIONS: "--max-old-space-size=2048",
};

let child: ChildProcess | null = null;
let shuttingDown = false;

function startToonflow(): void {
  log(`启动 Toonflow 子进程 (node ${TOONFLOW_ENTRY})...`);
  child = spawn(process.execPath, [TOONFLOW_ENTRY], {
    cwd: TOONFLOW_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (!child.pid) {
    die("spawn() 没拿到 pid");
  }
  log(`  pid = ${child.pid}`);

  child.stdout?.on("data", (d: Buffer) => {
    process.stdout.write(`[toonflow] ${d.toString()}`);
  });
  child.stderr?.on("data", (d: Buffer) => {
    process.stderr.write(`[toonflow:err] ${d.toString()}`);
  });
  child.on("exit", (code, signal) => {
    log(`Toonflow 退出 code=${code} signal=${signal}`);
    if (!shuttingDown) {
      log("异常退出，3s 后自动重启...");
      setTimeout(startToonflow, 3000);
    } else {
      process.exit(0);
    }
  });

  // 启动后 2s 做一次端口健康检查
  setTimeout(() => healthCheck().then((ok) => {
    if (ok) {
      log(`✅ 健康检查通过，访问 ${OSSURL}`);
    } else {
      log("⚠️  2s 端口未响应，可能 Toonflow 内部初始化还没完（再等等）");
    }
  }), 2000);
}

function healthCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ---- 优雅退出 ----
function shutdown(signal: string): void {
  shuttingDown = true;
  log(`收到 ${signal}，开始关闭子进程...`);
  if (child && child.pid) {
    try {
      // Windows 下 SIGTERM 等同于 kill；用 taskkill /T 杀整棵进程树更稳
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch (e) {
      log(`  杀子进程失败: ${(e as Error).message}`);
    }
  }
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (e) => {
  console.error("[demo-server] 未捕获异常:", e);
});

// ---- 启动 ----
startToonflow();

if (IS_VERIFY) {
  // verify 模式：等 5s 后探活，成功就打印验证报告并退出
  setTimeout(async () => {
    const ok = await healthCheck();
    if (ok) {
      console.log("\n=== VERIFY OK ===");
      console.log(`Port ${PORT} responsive.`);
      console.log(`Open ${OSSURL} in browser.`);
      process.exit(0);
    } else {
      console.error("\n=== VERIFY FAIL ===");
      console.error(`Port ${PORT} NOT responsive after 5s.`);
      process.exit(1);
    }
  }, 5000);
}
