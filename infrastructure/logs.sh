#!/usr/bin/env bash
# ManhuaWorks — 看所有服务日志
# 2026-06-08 谢擎 L2-task-12
#
# 用法：
#   ./logs.sh                      # 跟踪 prod 栈所有日志
#   ./logs.sh --dev                # dev 栈
#   ./logs.sh --tail 200           # 末尾 200 行
#   ./logs.sh --service user-service  # 单一服务
#   ./logs.sh --no-follow          # 不跟踪，输出后退出
#   ./logs.sh --since 10m          # 最近 10 分钟

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROFILE="prod"
SERVICE=""
FOLLOW="-f"
TAIL="100"
SINCE=""
for arg in "$@"; do
  case "$arg" in
    --dev)   PROFILE="dev" ;;
    --prod)  PROFILE="prod" ;;
    --no-follow) FOLLOW="" ;;
    --tail)
      shift
      TAIL="$1"
      ;;
    --service)
      shift
      SERVICE="$1"
      ;;
    --since)
      shift
      SINCE="--since $1"
      ;;
    -h|--help)
      echo "用法: $0 [--dev|--prod] [--tail N] [--service NAME] [--no-follow] [--since DURATION]"
      exit 0
      ;;
    *) echo "[logs] 未知参数: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$PROFILE" == "dev" ]]; then
  COMPOSE_FILE="docker-compose.dev.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

if [[ -n "$SERVICE" ]]; then
  echo "[logs] 跟踪 $SERVICE ($PROFILE)..."
  docker compose -f "$COMPOSE_FILE" logs $FOLLOW --tail="$TAIL" $SINCE "$SERVICE"
else
  echo "[logs] 跟踪 $PROFILE 栈所有服务..."
  docker compose -f "$COMPOSE_FILE" logs $FOLLOW --tail="$TAIL" $SINCE
fi
