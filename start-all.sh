#!/usr/bin/env bash
# ============================================================
# ManhuaWorks 开发环境一键启动脚本
# 用法: 在 Git Bash 中运行  bash start-all.sh
# 说明: 拉起 Redis + 全部微服务 + 前端 Vite（dev 模式直跑源码）
#       所有服务用 nohup 守护；脚本保持前台存活以维持子进程
# 注意: ai-router 必须用 node --env-file 显式加载 .env（tsx dev 不读 PORT，会回退 8082 与 vite 代理 8083 不符）
# ============================================================
set -u
ROOT="/d/ManhuaWorks"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"
# 统一使用 managed node 22（与已知可用环境一致）
export PATH="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2:$PATH"
REDIS="C:/Users/Administrator/AppData/Local/Microsoft/WinGet/Links/redis-server.exe"

ts()    { date +%H:%M:%S; }
log()   { echo "[$(ts)] $*"; }
port_up() { netstat -ano 2>/dev/null | grep -q ":$1"; }

start_svc() {
  local dir="$1" port="${2:-}"
  if [ -n "$port" ] && port_up "$port"; then
    log "SKIP  $dir (:${port} 已被占用)"
    return 0
  fi
  log "START $dir ${port:+':${port}'}"
  ( cd "$ROOT/services/$dir" && nohup npm run dev > "$LOGDIR/$dir.log" 2>&1 & )
}

log "===== ManhuaWorks 开发环境启动 ====="

# 1) Redis（多个服务依赖）
if ! port_up 6379; then
  log "START Redis (6379)"
  nohup "$REDIS" --daemonize yes > "$LOGDIR/redis.log" 2>&1 &
else
  log "SKIP  Redis (6379 已监听)"
fi

# 2) 核心微服务（前端 Vite 代理直接调用）
start_svc user-service      8088
# ai-router 必须显式加载 .env（tsx dev 模式不读 PORT，会回退 8082 与 vite 代理 8083 不符）
if ! port_up 8083; then
  log "START ai-router (8083, node --env-file)"
  ( cd "$ROOT/services/ai-router" && nohup node --env-file=.env dist/index.js > "$LOGDIR/ai-router.log" 2>&1 & )
else
  log "SKIP  ai-router (8083 已监听)"
fi
start_svc ai-orchestrator  8087
start_svc project-service   8089
start_svc billing-service   8090
start_svc collab-service    8091

# 3) 辅助微服务（端口已确认、无冲突）
start_svc ai-helper        8086
start_svc asset-service     8085
start_svc workflow-engine   8084
# api-gateway / monitor 真实端口由代码决定（探测易误），不指定端口直接起
start_svc api-gateway
start_svc monitor
# 注: ai-keys-service 默认端口疑似与 ai-router(8083) 冲突，暂跳过，需先确认端口再起

# 4) 前端 Vite
if ! port_up 3000; then
  log "START 前端 Vite (3000)"
  ( cd "$ROOT/apps/web" && nohup npm run dev > "$LOGDIR/web.log" 2>&1 & )
else
  log "SKIP  前端 Vite (3000 已监听)"
fi

# 5) 等待并验证
PORTS="3000 6379 8083 8084 8085 8086 8087 8088 8089 8090 8091"
TOTAL=$(echo $PORTS | wc -w)
log "===== 等待服务就绪 (最多 70s) ====="
for i in $(seq 1 70); do
  sleep 1
  up=0
  for p in $PORTS; do port_up "$p" && up=$((up+1)); done
  if [ "$up" -ge "$TOTAL" ]; then log "全部 $up/$TOTAL 端口就绪"; break; fi
done
up=0; for p in $PORTS; do port_up "$p" && up=$((up+1)); done
log "当前就绪 $up/$TOTAL"

log "===== 启动后端口状态 ====="
netstat -ano 2>/dev/null | grep -E ':3000|:6379|:808[0-9]|:809[0-9]' | grep LISTEN | sort
log "===== 各服务日志目录: $LOGDIR ====="

# 6) 保持本任务存活（nohup 子进程随本后台任务存活，便于用户测试期间持续运行）
while :; do sleep 300; done
