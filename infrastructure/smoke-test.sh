#!/usr/bin/env bash
# ManhuaWorks — 一键健康检查（smoke test）
# 2026-06-08 谢擎 L2-task-12
#
# 检查项：
#   1) 4 业务后端 /health（user/project/billing/collab）
#   2) API Gateway /health
#   3) Monitor /health
#   4) Prometheus /api/v1/status/config
#   5) Grafana /api/health
#   6) AlertManager /-/healthy
#   7) Postgres TCP 5432（用 docker exec pg_isready）
#   8) Redis TCP 6379（用 docker exec redis-cli ping）
#   9) 4 前端 HTTP HEAD
#
# 用法：
#   ./smoke-test.sh                # 默认检查本机端口
#   ./smoke-test.sh --container    # 用 docker exec 探测容器内端口（更准）
#   ./smoke-test.sh --verbose      # 失败时输出响应体
#   ./smoke-test.sh --retries 5    # 每个端点最多重试 5 次
#   ./smoke-test.sh --timeout 10   # 每次 HTTP 超时 10s

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERBOSE=0
CONTAINER=0
RETRIES=3
TIMEOUT=5
for arg in "$@"; do
  case "$arg" in
    --verbose)    VERBOSE=1 ;;
    --container)  CONTAINER=1 ;;
    --retries)    shift; RETRIES="$1" ;;
    --timeout)    shift; TIMEOUT="$1" ;;
    -h|--help)
      echo "用法: $0 [--container] [--verbose] [--retries N] [--timeout SEC]"
      exit 0
      ;;
    *) echo "[smoke] 未知参数: $arg" >&2; exit 1 ;;
  esac
done

# ============== 端点定义 ==============
# 格式：name|url|expected_status
BACKENDS=(
  "user-service|http://localhost:8088/health|200"
  "project-service|http://localhost:8089/health|200"
  "billing-service|http://localhost:8090/health|200"
  "collab-service|http://localhost:8091/health|200"
  "api-gateway|http://localhost:8080/health|200"
  "monitor|http://localhost:8092/health|200"
)
OBSERVABILITY=(
  "prometheus|http://localhost:9090/-/healthy|200"
  "prometheus-config|http://localhost:9090/api/v1/status/config|200"
  "alertmanager|http://localhost:9093/-/healthy|200"
  "grafana|http://localhost:3010/api/health|200"
)
FRONTENDS=(
  "web|http://localhost:3000/|200"
  "studio|http://localhost:3001/|200"
  "admin-portal|http://localhost:3002/|200"
  "user-portal|http://localhost:3003/|200"
)

# ============== 计数器 ==============
PASS=0
FAIL=0
RESULTS=()

# ============== 探测函数 ==============
check_http() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local attempt=0
  local code="000"
  local body=""

  while (( attempt < RETRIES )); do
    attempt=$((attempt + 1))
    body=$(curl -s -m "$TIMEOUT" -o /tmp/smoke-body.txt -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    code="$body"
    if [[ "$code" == "$expected" ]]; then
      return 0
    fi
    sleep 2
  done

  if (( VERBOSE )); then
    echo "    [body] $(cat /tmp/smoke-body.txt 2>/dev/null | head -c 200)"
  fi
  return 1
}

check_docker_exec() {
  local name="$1"
  local container="$2"
  local cmd="$3"
  if docker exec -i "$container" sh -c "$cmd" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# ============== 业务后端 ==============
echo ""
echo "═══ 业务后端 / API Gateway / Monitor ═══"
for entry in "${BACKENDS[@]}"; do
  IFS='|' read -r name url expected <<< "$entry"
  if check_http "$name" "$url" "$expected"; then
    printf "  ✅ %-22s %s\n" "$name" "$url"
    PASS=$((PASS+1))
  else
    printf "  ❌ %-22s %s (got %s, expected %s)\n" "$name" "$url" "$code" "$expected"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: $name $url")
  fi
done

# ============== 可观测性 ==============
echo ""
echo "═══ 可观测性 (Prometheus / AlertManager / Grafana) ═══"
for entry in "${OBSERVABILITY[@]}"; do
  IFS='|' read -r name url expected <<< "$entry"
  if check_http "$name" "$url" "$expected"; then
    printf "  ✅ %-22s %s\n" "$name" "$url"
    PASS=$((PASS+1))
  else
    printf "  ❌ %-22s %s (got %s, expected %s)\n" "$name" "$url" "$code" "$expected"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: $name $url")
  fi
done

# ============== 数据层（容器内探测）==============
echo ""
echo "═══ 数据层 (Postgres / Redis) ═══"
if (( CONTAINER )); then
  if check_docker_exec "postgres" "mhw-postgres" "pg_isready -U mhw -d manhuaworks"; then
    echo "  ✅ postgres                 pg_isready"
    PASS=$((PASS+1))
  else
    echo "  ❌ postgres                 pg_isready"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: postgres pg_isready")
  fi
  if check_docker_exec "redis" "mhw-redis" "redis-cli ping | grep -q PONG"; then
    echo "  ✅ redis                    redis-cli ping"
    PASS=$((PASS+1))
  else
    echo "  ❌ redis                    redis-cli ping"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: redis ping")
  fi
else
  # 主机端口探测
  if timeout 3 bash -c "</dev/tcp/localhost/5432" 2>/dev/null; then
    echo "  ✅ postgres                 tcp/5432"
    PASS=$((PASS+1))
  else
    echo "  ❌ postgres                 tcp/5432"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: postgres tcp")
  fi
  if timeout 3 bash -c "exec 3<>/dev/tcp/localhost/6379 && echo -e 'PING\r' >&3 && head -c 7 <&3" 2>/dev/null | grep -q PONG; then
    echo "  ✅ redis                    tcp/6379 + PING"
    PASS=$((PASS+1))
  else
    echo "  ❌ redis                    tcp/6379 + PING"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: redis ping")
  fi
fi

# ============== 前端 ==============
echo ""
echo "═══ 前端 (Vue + Vite) ═══"
for entry in "${FRONTENDS[@]}"; do
  IFS='|' read -r name url expected <<< "$entry"
  if check_http "$name" "$url" "$expected"; then
    printf "  ✅ %-22s %s\n" "$name" "$url"
    PASS=$((PASS+1))
  else
    printf "  ❌ %-22s %s (got %s, expected %s)\n" "$name" "$url" "$code" "$expected"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: $name $url")
  fi
done

# ============== 总结 ==============
echo ""
echo "════════════════════════════════════════════"
TOTAL=$((PASS+FAIL))
if (( FAIL == 0 )); then
  echo "  🎉 全部通过: $PASS / $TOTAL"
  exit 0
else
  echo "  ⚠️  通过 $PASS / $TOTAL, 失败 $FAIL"
  for r in "${RESULTS[@]}"; do
    echo "    - $r"
  done
  exit 1
fi
