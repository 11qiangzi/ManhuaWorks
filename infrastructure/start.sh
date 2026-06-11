#!/usr/bin/env bash
# ManhuaWorks — 一键起 dev 栈
# 2026-06-08 谢擎 L2-task-12
#
# 用法：
#   ./start.sh                  起 dev compose（postgres/redis/4 后端/4 前端）
#   ./start.sh --rebuild        强制重新 build 镜像
#   ./start.sh --pull           拉取镜像
#   ./start.sh --down           停 dev 栈
#   ./start.sh --logs           看日志
#   ./start.sh --smoke          跑完起后做 smoke test
#
# 端口：详见 docker-compose.dev.yml / README.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.dev.yml"
COMPOSE_CMD="docker compose -f $COMPOSE_FILE"

# ============== 参数解析 ==============
ACTION="up"
EXTRA_ARGS=""
for arg in "$@"; do
  case "$arg" in
    --rebuild)   EXTRA_ARGS="$EXTRA_ARGS --build" ;;
    --pull)      EXTRA_ARGS="$EXTRA_ARGS --pull always" ;;
    --no-deps)   EXTRA_ARGS="$EXTRA_ARGS --no-deps" ;;
    --down)      ACTION="down" ;;
    --stop)      ACTION="stop" ;;
    --restart)   ACTION="restart" ;;
    --logs)      ACTION="logs" ;;
    --ps)        ACTION="ps" ;;
    --smoke)     ACTION="smoke" ;;
    -h|--help)
      echo "用法: $0 [--rebuild|--pull|--no-deps|--down|--stop|--restart|--logs|--ps|--smoke]"
      exit 0
      ;;
    *)
      echo "[start] 未知参数: $arg" >&2
      exit 1
      ;;
  esac
done

# ============== 检查 .env ==============
if [[ ! -f .env ]] && [[ "$ACTION" == "up" || "$ACTION" == "restart" ]]; then
  echo "[start] .env 不存在，复制 .env.example"
  cp -n .env.example .env
  echo "[start] 请编辑 .env 后重跑（生产密钥必须改）"
  # 不强制退出——本地开发可以用默认密钥
fi

# ============== 检查 docker ==============
if ! command -v docker >/dev/null 2>&1; then
  echo "[start] ❌ docker 未安装或不在 PATH" >&2
  exit 1
fi

# ============== 执行 ==============
case "$ACTION" in
  up)
    echo "[start] 🚀 启动 dev 栈..."
    $COMPOSE_CMD up -d $EXTRA_ARGS
    echo "[start] ✅ 已启动。常用命令："
    echo "  ./logs.sh              # 跟踪所有日志"
    echo "  ./smoke-test.sh        # 健康检查"
    echo "  ./start.sh --ps        # 看状态"
    echo "  ./start.sh --down      # 停掉"
    ;;
  down)
    echo "[start] ⬇️  停 dev 栈（保留数据卷）..."
    $COMPOSE_CMD down
    ;;
  stop)
    echo "[start] ⏸  暂停 dev 栈（不删容器）..."
    $COMPOSE_CMD stop
    ;;
  restart)
    echo "[start] 🔄 重启 dev 栈..."
    $COMPOSE_CMD restart
    ;;
  logs)
    $COMPOSE_CMD logs -f --tail=100
    ;;
  ps)
    $COMPOSE_CMD ps
    ;;
  smoke)
    echo "[start] 🚀 启动 dev 栈 + 跑 smoke test..."
    $COMPOSE_CMD up -d $EXTRA_ARGS
    sleep 10
    "$SCRIPT_DIR/smoke-test.sh"
    ;;
  *)
    echo "[start] ❌ 未知 action: $ACTION" >&2
    exit 1
    ;;
esac
