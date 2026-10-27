#!/usr/bin/env bash
# =============================================================================
# 千机工坊 · AI 服务启动脚本
# 启动: ai-router (:8082)  +  ai-orchestrator (:8087)
# 用法:  bash scripts/start-ai-services.sh
#
# 说明:
#  - pnpm 的 corepack 路径在当前环境已损坏，故直接用「受管 node + 本地 tsx」拉起，
#    与前端 vue-tsc 的绕过方式一致。
#  - 各服务的 .env 不会自动加载（未装 dotenv），因此本脚本先 source .env 取其真实的
#    provider key，再用下方修正后的关键变量覆盖 .env 中的错误值（PORT / DATABASE_URL /
#    AUTH_JWT_SECRET 等）。
#  - PG(:5432, 密码 mhw_dev_password_2026) 与 Redis(:6379) 需已在运行。
# =============================================================================
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

# 受管 node（绕过 corepack 损坏的 pnpm）
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe"
export NODE_ENV=development

# —— 修正后的关键变量（覆盖 .env 中的错误值）——
JWT_SECRET='dev-only-jwt-secret-replace-in-prod-2026-06-08-min-32-chars'
DATABASE_URL='postgresql://mhw:mhw_dev_password_2026@localhost:5432/manhuaworks'
REDIS_URL='redis://localhost:6379'

LOGDIR="$ROOT/.logs"
mkdir -p "$LOGDIR"

start_service () {
  local name="$1" dir="$2" port="$3"
  echo "[$name] starting on :$port ..."
  (
    cd "$ROOT/$dir" || exit 1
    # 载入该服务的 .env（含真实的 provider key 等）
    set -a
    [ -f ./.env ] && source ./.env
    set +a
    # 用修正后的关键变量覆盖 .env 中的错误值
    export NODE_ENV DATABASE_URL REDIS_URL JWT_SECRET
    export PORT="$port"
    export AUTH_JWT_SECRET="$JWT_SECRET"
    exec "$NODE" ./node_modules/tsx/dist/cli.mjs watch src/index.ts
  ) > "$LOGDIR/$name.log" 2>&1 &
  echo $! > "$LOGDIR/$name.pid"
  echo "[$name] pid=$(cat "$LOGDIR/$name.pid")  log=$LOGDIR/$name.log"
}

wait_port () {
  local port="$1" name="$2" tries=60
  echo "[$name] waiting for :$port ..."
  for ((i=1; i<=tries; i++)); do
    if curl -s --max-time 2 -o /dev/null "http://localhost:$port/health"; then
      echo "[$name] :$port is UP"
      return 0
    fi
    sleep 1
  done
  echo "[$name] ERROR: :$port not reachable after ${tries}s. tail of log:"
  tail -n 40 "$LOGDIR/$name.log"
  return 1
}

# 1) ai-router 必须先起（前端 /v1/ai 代理到 8083；orchestrator 也指向 8083）
start_service ai-router services/ai-router 8083
wait_port 8083 ai-router

# 2) ai-orchestrator
start_service ai-orchestrator services/ai-orchestrator 8087
wait_port 8087 ai-orchestrator

echo ""
echo "=== 启动完成 ==="
echo "ai-router        : http://localhost:8082/health"
echo "ai-orchestrator  : http://localhost:8087/health"
echo "日志目录         : $LOGDIR"
echo "停止方式         : kill \$(cat $LOGDIR/ai-router.pid) \$(cat $LOGDIR/ai-orchestrator.pid)"
