#!/usr/bin/env bash
# ManhuaWorks — 起全栈 15 服务（生产模式）
# 2026-06-08 谢擎 L2-task-12
#
# 用法：
#   ./start-prod.sh              # 起全栈
#   ./start-prod.sh --rebuild    # 重新 build 业务镜像
#   ./start-prod.sh --pull       # 拉取基础镜像（postgres/redis/prom/grafana）
#   ./start-prod.sh --down       # 停全栈
#   ./start-prod.sh --smoke      # 起完跑 smoke
#
# 区别 dev 栈：
#   - 跳过 dev mount（不挂源）
#   - 包含 monitor / prometheus / alertmanager / grafana
#   - 容器 restart: unless-stopped
#   - 数据卷持久化
#   - 日志限制 20m × 5

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.yml"
COMPOSE_CMD="docker compose -f $COMPOSE_FILE"

ACTION="up"
EXTRA_ARGS=""
for arg in "$@"; do
  case "$arg" in
    --rebuild)  EXTRA_ARGS="$EXTRA_ARGS --build" ;;
    --pull)     EXTRA_ARGS="$EXTRA_ARGS --pull always" ;;
    --no-deps)  EXTRA_ARGS="$EXTRA_ARGS --no-deps" ;;
    --down)     ACTION="down" ;;
    --stop)     ACTION="stop" ;;
    --logs)     ACTION="logs" ;;
    --ps)       ACTION="ps" ;;
    --smoke)    ACTION="smoke" ;;
    -h|--help)
      echo "用法: $0 [--rebuild|--pull|--no-deps|--down|--stop|--logs|--ps|--smoke]"
      exit 0
      ;;
    *) echo "[start-prod] 未知参数: $arg" >&2; exit 1 ;;
  esac
done

# .env 必须存在
if [[ ! -f .env ]] && [[ "$ACTION" == "up" || "$ACTION" == "smoke" ]]; then
  echo "[start-prod] ❌ .env 不存在"
  echo "[start-prod] 请先: cp .env.example .env && \$EDITOR .env"
  echo "[start-prod] 注意：生产环境必须改 POSTGRES_PASSWORD / JWT_SECRET / GRAFANA_PASSWORD"
  exit 1
fi

# 防止 dev_only 密码溜进生产
if [[ -f .env ]]; then
  if grep -q "change_me_postgres_password_32chars\|change_me_jwt_secret_at_least_32\|change_me_grafana_admin_16chars" .env; then
    echo "[start-prod] ❌ 检测到 .env 包含占位密码（change_me_*），生产环境必须改！"
    exit 1
  fi
fi

case "$ACTION" in
  up)
    echo "[start-prod] 🚀 启动全栈 15 服务..."
    $COMPOSE_CMD up -d $EXTRA_ARGS
    echo "[start-prod] ✅ 启动指令已发出。等待服务就绪..."
    sleep 15
    echo "[start-prod] 服务状态："
    $COMPOSE_CMD ps
    echo ""
    echo "[start-prod] 关键 URL："
    echo "  Web:        http://localhost:3000"
    echo "  Studio:     http://localhost:3001"
    echo "  Admin:      http://localhost:3002"
    echo "  User:       http://localhost:3003"
    echo "  API GW:     http://localhost:8080"
    echo "  Grafana:    http://localhost:3010  (admin / \$GRAFANA_PASSWORD)"
    echo "  Prometheus: http://localhost:9090"
    echo "  AlertMgr:   http://localhost:9093"
    echo ""
    echo "[start-prod] 验证: ./smoke-test.sh"
    ;;
  smoke)
    $COMPOSE_CMD up -d $EXTRA_ARGS
    sleep 20
    "$SCRIPT_DIR/smoke-test.sh"
    ;;
  down)
    echo "[start-prod] ⬇️  停全栈（保留数据卷）..."
    $COMPOSE_CMD down
    ;;
  stop)
    $COMPOSE_CMD stop
    ;;
  logs)
    $COMPOSE_CMD logs -f --tail=100
    ;;
  ps)
    $COMPOSE_CMD ps
    ;;
  *) echo "[start-prod] 未知 action: $ACTION" >&2; exit 1 ;;
esac
