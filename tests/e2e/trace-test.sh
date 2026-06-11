#!/usr/bin/env bash
# ManhuaWorks L2 task 14 — 端到端 trace 验证
#
# 跑一遍 auth + project + collab 完整流程，把每步的 traceId 收集起来，
# 拉一次 Jaeger API 验证 trace 真的被接收。
#
# 前置条件：
#   - 4 业务后端 + api-gateway + monitor + jaeger 全在跑
#   - OTLP endpoint = http://localhost:4318
#
# 用法：
#   bash tests/e2e/trace-test.sh
#   或带 JAEGER_API 覆盖：JAEGER_API=http://localhost:16686 bash trace-test.sh

set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
JAEGER_API="${JAEGER_API:-http://localhost:16686}"
OTLP="${OTLP:-http://localhost:4318}"
SERVICE="api-gateway"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== ManhuaWorks trace 端到端验证 ==="
echo "GATEWAY     = $GATEWAY"
echo "JAEGER_API  = $JAEGER_API"
echo "OTLP        = $OTLP"
echo

# 1) 健康检查
echo -e "${YELLOW}[1/5]${NC} 健康检查..."
curl -fsS "$GATEWAY/health" >/dev/null || { echo "FAIL: gateway 不可达"; exit 1; }
echo "  ✓ gateway OK"
curl -fsS "$JAEGER_API/" >/dev/null || { echo "FAIL: jaeger UI 不可达"; exit 1; }
echo "  ✓ jaeger UI OK"
echo

# 2) 抓 dev token
echo -e "${YELLOW}[2/5]${NC} 拿 dev token..."
TOKEN=$(curl -fsS -X POST "$GATEWAY/dev/token" \
  -H "Content-Type: application/json" \
  -d '{"sub":"usr_e2e","role":"L3","ttlSec":3600}' \
  | grep -oP '"token":"[^"]+"' | cut -d'"' -f4)
[[ -n "$TOKEN" ]] || { echo "FAIL: 没拿到 token"; exit 1; }
echo "  ✓ token length = ${#TOKEN}"
echo

# 3) 跑流程，每步取 X-Trace-Id
echo -e "${YELLOW}[3/5]${NC} 跑 auth + project + collab 流程..."

declare -a TRACE_IDS
declare -a STEPS

run_step() {
  local label="$1" method="$2" path="$3" body="${4:-}"
  local out_headers
  if [[ -n "$body" ]]; then
    out_headers=$(curl -sS -D - -o /dev/null \
      -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$GATEWAY$path")
  else
    out_headers=$(curl -sS -D - -o /dev/null \
      -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      "$GATEWAY$path")
  fi
  local tid
  tid=$(echo "$out_headers" | grep -i '^x-trace-id:' | head -1 | tr -d '\r' | awk '{print $2}')
  TRACE_IDS+=("$tid")
  STEPS+=("$label")
  if [[ -n "$tid" ]]; then
    echo "  ✓ $label  traceId=$tid"
  else
    echo "  ✗ $label  (no X-Trace-Id in response)"
  fi
}

run_step "auth.me"        "GET"  "/v1/users/me"
run_step "project.list"   "GET"  "/v1/projects"
run_step "project.create" "POST" "/v1/projects" '{"name":"trace-test","description":"e2e"}'
run_step "collab.rooms"   "GET"  "/v1/collab/rooms" 2>/dev/null || true

echo
echo -e "${YELLOW}[4/5]${NC} 汇总 traceId..."
for i in "${!TRACE_IDS[@]}"; do
  echo "  [${STEPS[$i]}]  traceId=${TRACE_IDS[$i]}"
done
echo

# 5) 在 Jaeger 里查 trace
echo -e "${YELLOW}[5/5]${NC} 从 Jaeger 拉 trace..."
sleep 3  # 等 batch span processor flush
for tid in "${TRACE_IDS[@]}"; do
  [[ -z "$tid" ]] && continue
  resp=$(curl -fsS "$JAEGER_API/api/traces/$tid" 2>/dev/null || echo "{}")
  span_count=$(echo "$resp" | grep -oP '"traceID":"[^"]+"' | wc -l || echo 0)
  if [[ "$span_count" -gt 0 ]]; then
    echo -e "  ${GREEN}✓ traceId=$tid : $span_count span(s) in Jaeger${NC}"
  else
    echo "  ✗ traceId=$tid : NOT FOUND in Jaeger"
  fi
done

echo
echo -e "${GREEN}=== 完成 ===${NC}"
echo "浏览器打开 $JAEGER_API 看 trace UI"
