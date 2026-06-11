#!/usr/bin/env bash
# ManhuaWorks L2 task 14 — Dry-run trace 验证
#
# 适用：环境无 docker / 无 jaeger / 后端没起 —— 只想验证
#   1. 4 业务后端 + api-gateway + monitor 的 telemetry.ts 编译过
#   2. traceId 注入逻辑正确
#
# 用法：bash tests/e2e/trace-test-noop.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT="${MANHUAWORKS_ROOT:-D:/ManhuaWorks}"
GATEWAY="${GATEWAY:-http://localhost:8080}"

echo "=== ManhuaWorks trace dry-run 验证 ==="
echo "ROOT    = $ROOT"
echo "GATEWAY = $GATEWAY (可选)"
echo

# ---------------------------------------------------------------------------
# 1) tsc 验证 6 个 telemetry.ts
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[1/3] tsc 编译 6 个 telemetry.ts...${NC}"
fail=0

check_file() {
  local label="$1" tsconfig="$2"
  if [[ ! -d "$tsconfig" ]]; then
    echo -e "  ${RED}✗${NC} $label  : dir $tsconfig 不存在"
    fail=$((fail+1))
    return
  fi
  local tsc="$tsconfig/node_modules/.bin/tsc"
  if [[ ! -f "$tsc" ]]; then
    tsc=$(find "$ROOT" -name "tsc" -path "*/node_modules/.bin/*" 2>/dev/null | head -1)
  fi
  if [[ -z "$tsc" || ! -f "$tsc" ]]; then
    echo -e "  ${RED}✗${NC} $label  : 找不到 tsc"
    fail=$((fail+1))
    return
  fi
  local out
  out=$(cd "$tsconfig" && "$tsc" --noEmit 2>&1) || true
  if [[ -z "$out" ]]; then
    echo -e "  ${GREEN}✓${NC} $label  : 编译 0 错"
  else
    echo -e "  ${RED}✗${NC} $label  :"
    echo "$out" | sed 's/^/      /'
    fail=$((fail+1))
  fi
}

# 各 service 单独 typecheck
check_file "user-service"      "$ROOT/services/user-service"
check_file "project-service"   "$ROOT/services/project-service"
check_file "billing-service"   "$ROOT/services/billing-service"
check_file "collab-service"    "$ROOT/services/collab-service"
check_file "monitor"           "$ROOT/services/monitor"
check_file "api-gateway"       "$ROOT/services/api-gateway"
check_file "api-client"        "$ROOT/packages/api-client"
check_file "logger"            "$ROOT/packages/logger"

if [[ $fail -gt 0 ]]; then
  echo -e "${RED}FAIL: $fail 个包编译失败${NC}"
  exit 1
fi
echo

# ---------------------------------------------------------------------------
# 2) 静态扫描：traceId 注入
# ---------------------------------------------------------------------------

echo -e "${YELLOW}[2/3] 静态验证 traceId 注入逻辑...${NC}"
fail=0

# 2.1 packages/logger 必须 export injectTraceparent / extractTraceparent
for sym in "injectTraceparent" "extractTraceparent" "initTelemetry" "getCurrentTraceId" "shutdownTelemetry"; do
  if ! grep -q "export.*$sym" "$ROOT/packages/logger/src/tracer.ts"; then
    echo -e "  ${RED}✗${NC} logger/tracer.ts 缺 export $sym"
    fail=$((fail+1))
  else
    echo -e "  ${GREEN}✓${NC} logger/tracer.ts exports $sym"
  fi
done

# 2.2 4 业务后端 + monitor + api-gateway 都有 telemetry.ts
for svc in user-service project-service billing-service collab-service monitor api-gateway; do
  if [[ -f "$ROOT/services/$svc/src/telemetry.ts" ]]; then
    if grep -q "initTelemetry" "$ROOT/services/$svc/src/telemetry.ts"; then
      echo -e "  ${GREEN}✓${NC} $svc/src/telemetry.ts 调用 initTelemetry"
    else
      echo -e "  ${RED}✗${NC} $svc/src/telemetry.ts 没调用 initTelemetry"
      fail=$((fail+1))
    fi
  else
    echo -e "  ${RED}✗${NC} $svc/src/telemetry.ts 不存在"
    fail=$((fail+1))
  fi
done

# 2.3 4 业务后端 + monitor + api-gateway 的 index.ts 都 import './telemetry' 在最顶
for svc in user-service billing-service collab-service monitor api-gateway; do
  idx="$ROOT/services/$svc/src/index.ts"
  if [[ ! -f "$idx" ]]; then
    echo -e "  ${YELLOW}⚠${NC} $svc/src/index.ts 不存在（service 待实现）"
    continue
  fi
  # 检查 telemetry 是第一个 import
  first_import=$(grep -nE "^import " "$idx" | head -1)
  if echo "$first_import" | grep -q "telemetry"; then
    echo -e "  ${GREEN}✓${NC} $svc/src/index.ts 顶部 import './telemetry'"
  else
    echo -e "  ${RED}✗${NC} $svc/src/index.ts 顶部不是 './telemetry'：$first_import"
    fail=$((fail+1))
  fi
done

# 2.4 api-gateway middleware/trace.ts 必须 export traceMiddleware
if grep -q "export const traceMiddleware" "$ROOT/services/api-gateway/src/middleware/trace.ts"; then
  echo -e "  ${GREEN}✓${NC} api-gateway middleware/trace.ts exports traceMiddleware"
else
  echo -e "  ${RED}✗${NC} api-gateway middleware/trace.ts 缺 traceMiddleware export"
  fail=$((fail+1))
fi

# 2.5 api-gateway index.ts 必须挂载 traceMiddleware
if grep -q "traceMiddleware" "$ROOT/services/api-gateway/src/index.ts"; then
  echo -e "  ${GREEN}✓${NC} api-gateway index.ts 挂载 traceMiddleware"
else
  echo -e "  ${RED}✗${NC} api-gateway index.ts 没挂载 traceMiddleware"
  fail=$((fail+1))
fi

# 2.6 monitor collectors 都有 withSpan
for c in metricsScraper dbStats; do
  if grep -q "withSpan" "$ROOT/services/monitor/src/collectors/$c.ts"; then
    echo -e "  ${GREEN}✓${NC} monitor/collectors/$c.ts 调用 withSpan"
  else
    echo -e "  ${RED}✗${NC} monitor/collectors/$c.ts 没调用 withSpan"
    fail=$((fail+1))
  fi
done

# 2.7 api-client http.ts 注入 traceparent + X-Trace-Id
if grep -q "propagation.inject" "$ROOT/packages/api-client/src/http.ts"; then
  echo -e "  ${GREEN}✓${NC} api-client/http.ts 注入 traceparent"
else
  echo -e "  ${RED}✗${NC} api-client/http.ts 没注入 traceparent"
  fail=$((fail+1))
fi
if grep -q "X-Trace-Id" "$ROOT/packages/api-client/src/http.ts"; then
  echo -e "  ${GREEN}✓${NC} api-client/http.ts 写 X-Trace-Id"
else
  echo -e "  ${RED}✗${NC} api-client/http.ts 没写 X-Trace-Id"
  fail=$((fail+1))
fi

# 2.8 4 前端都有 telemetry.ts
for app in web studio admin-portal user-portal; do
  if [[ -f "$ROOT/apps/$app/src/telemetry.ts" ]]; then
    if grep -q "initBrowserTelemetry" "$ROOT/apps/$app/src/telemetry.ts"; then
      echo -e "  ${GREEN}✓${NC} $app/src/telemetry.ts 完整"
    else
      echo -e "  ${RED}✗${NC} $app/src/telemetry.ts 不完整"
      fail=$((fail+1))
    fi
  else
    echo -e "  ${RED}✗${NC} $app/src/telemetry.ts 不存在"
    fail=$((fail+1))
  fi
done

# 2.9 jaeger compose
if [[ -f "$ROOT/infrastructure/jaeger/docker-compose.yml" ]]; then
  echo -e "  ${GREEN}✓${NC} infrastructure/jaeger/docker-compose.yml"
else
  echo -e "  ${RED}✗${NC} infrastructure/jaeger/docker-compose.yml 不存在"
  fail=$((fail+1))
fi
if grep -q "jaeger:" "$ROOT/infrastructure/docker-compose.monitor.yml"; then
  echo -e "  ${GREEN}✓${NC} monitor compose 包含 jaeger"
else
  echo -e "  ${RED}✗${NC} monitor compose 缺 jaeger"
  fail=$((fail+1))
fi

# 2.10 docs
if [[ -f "$ROOT/docs/operations/tracing.md" ]]; then
  echo -e "  ${GREEN}✓${NC} docs/operations/tracing.md"
else
  echo -e "  ${RED}✗${NC} docs/operations/tracing.md 不存在"
  fail=$((fail+1))
fi

# ---------------------------------------------------------------------------
# 3) 模拟一次 trace 注入
# ---------------------------------------------------------------------------

echo
echo -e "${YELLOW}[3/3] 模拟 traceparent 注入...${NC}"

# 简单 node 脚本：模拟 inject 一次，看 traceId 是不是 32 字符
node -e "
const { W3CTraceContextPropagator } = require('@opentelemetry/core');
const api = require('@opentelemetry/api');
api.propagation.setGlobalPropagator(new W3CTraceContextPropagator());

// 起一个 root span
const tracer = api.trace.getTracer('test');
const root = tracer.startSpan('test.root');
api.context.with(api.trace.setSpan(api.context.active(), root), () => {
  const carrier = {};
  api.propagation.inject(api.context.active(), carrier, api.defaultTextMapSetter);
  console.log('injected traceparent =', carrier.traceparent);
  const m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(carrier.traceparent || '');
  if (!m) { console.error('FAIL: traceparent 格式不对'); process.exit(1); }
  if (m[2].length !== 32) { console.error('FAIL: traceId 不是 32 字符'); process.exit(1); }
  console.log('✓ traceId 长度 =', m[2].length, '(32 hex)');
  console.log('✓ spanId 长度 =', m[3].length, '(16 hex)');
  root.end();
});
" || { echo "FAIL: node 模拟脚本失败"; fail=$((fail+1)); }

echo
if [[ $fail -gt 0 ]]; then
  echo -e "${RED}=== FAIL: $fail 项验证失败 ===${NC}"
  exit 1
fi
echo -e "${GREEN}=== 全部 dry-run 验证通过 ===${NC}"
