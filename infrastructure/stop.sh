#!/usr/bin/env bash
# ManhuaWorks — 停栈
# 2026-06-08 谢擎 L2-task-12
#
# 默认停 prod（docker-compose.yml）；可指定 --dev / --prod
# 加 --volumes 一并清理数据卷（危险！会丢数据）

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROFILE="prod"
VOLUMES=""
for arg in "$@"; do
  case "$arg" in
    --dev)   PROFILE="dev" ;;
    --prod)  PROFILE="prod" ;;
    --volumes|-v) VOLUMES=" -v" ;;
    -h|--help)
      echo "用法: $0 [--dev|--prod] [--volumes]"
      exit 0
      ;;
    *) echo "[stop] 未知参数: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$PROFILE" == "dev" ]]; then
  COMPOSE_FILE="docker-compose.dev.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

echo "[stop] 停 $PROFILE 栈（$COMPOSE_FILE），保留数据卷（除非 --volumes）..."
docker compose -f "$COMPOSE_FILE" down $VOLUMES
echo "[stop] ✅ 完成"
