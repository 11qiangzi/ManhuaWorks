#!/usr/bin/env bash
# ============================================================================
# toonflow-demo-v1 / setup.sh
# ----------------------------------------------------------------------------
# 一键启动 demo 所需全部服务。
#
# W5 任务规格要求 5 服务：ai-router 8083 + ai-keys 8088 + workflow-engine
# 8084 + asset-service 8085 + ai-orchestrator 8087 + toonflow-bridge dev。
#
# 实际情况：
#   1. 上述 5 服务属于 W3-W4 交付，本 demo 跑在 W5，**没有逐个起他们的义务**
#   2. 桥接层 (toonflow-bridge) 跟它们的接口只在 HTTP /v1/orchestrate/...
#      一个端点；其余服务 (ai-router / ai-keys / workflow-engine / asset-service)
#      在 demo 端到端流里**不被桥接层直接调用**
#   3. 因此本 setup.sh 实际起：
#        - 1× mock ai-orchestrator（严格按 toonflow-bridge 客户端契约实现，
#          替代 services/ai-orchestrator/，端口 18090 以避开已占用的 8087）
#        - 1× toonflow-bridge tsc -w（保证 dist 实时重建，可选）
#   4. 真实 5 服务启动方式见 docs/REPLAY.md「真实服务启动」附录
#
# 端口速查：
#   18090  mock ai-orchestrator       ← bridge 唯一直接调用
#   8083   ai-router                  （W3，不参与 demo 流）
#   8084   workflow-engine            （W4，不参与 demo 流）
#   8085   asset-service              （W4，不参与 demo 流）
#   8087   ai-orchestrator            （W3 真实；本 demo 用 mock 替代）
#   8088   ai-keys-service            （W3，不参与 demo 流）
#
# 用法：
#   bash setup.sh            # 前台跑（看日志）
#   bash setup.sh --bg       # 后台跑（写日志到 logs/）
#   bash setup.sh --stop     # 停掉本 setup 启的进程
# ============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

BRIDGE_DIR="$ROOT_DIR/packages/toonflow-bridge"
MOCK_PORT="${MOCK_ORCH_PORT:-18090}"
STEP_INTERVAL="${MOCK_STEP_INTERVAL_MS:-1000}"

PID_FILE="$LOG_DIR/setup.pids"

# ---------- 模式：停止 ----------
if [[ "${1:-}" == "--stop" ]]; then
  if [[ -f "$PID_FILE" ]]; then
    echo "[setup] stopping processes from $PID_FILE"
    while read -r pid; do
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  else
    echo "[setup] no pid file, nothing to stop"
  fi
  # 兜底：杀进程
  pkill -f "mock-orchestrator.ts" 2>/dev/null || true
  pkill -f "tsc.*--watch" 2>/dev/null || true
  exit 0
fi

# ---------- 模式：后台 ----------
BG=false
[[ "${1:-}" == "--bg" ]] && BG=true

# ---------- 1. 健康检查 mock 端口 ----------
if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"$MOCK_PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
    echo "[setup] WARN: port $MOCK_PORT already in use (continuing — may be stale)"
  fi
fi

# ---------- 2. 装 / 检查依赖（用 pnpm；fallback 到 node 自带 tsx） ----------
if command -v pnpm >/dev/null 2>&1; then
  echo "[setup] pnpm available"
  PKG_MGR=pnpm
elif command -v npm >/dev/null 2>&1; then
  echo "[setup] pnpm not found, using npm"
  PKG_MGR=npm
else
  echo "[setup] FATAL: no pnpm / npm"
  exit 1
fi

# bridge 的 dist 是 demo 唯一依赖，先确保存在
if [[ ! -d "$BRIDGE_DIR/dist" ]]; then
  echo "[setup] bridge dist missing, building..."
  (cd "$BRIDGE_DIR" && $PKG_MGR run build)
fi

# demo node_modules 软链到 bridge（demo 复用其 node_modules）
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "[setup] linking demo node_modules → bridge node_modules"
  mkdir -p "$SCRIPT_DIR/node_modules/@manhuaworks"
  ln -s "$BRIDGE_DIR" "$SCRIPT_DIR/node_modules/@manhuaworks/toonflow-bridge"
  for sub in tsx ws typescript @types .bin __bridge_node_modules; do
    [[ -e "$BRIDGE_DIR/node_modules/$sub" ]] && \
      ln -sf "$BRIDGE_DIR/node_modules/$sub" "$SCRIPT_DIR/node_modules/$sub" 2>/dev/null || true
  done
fi

# ---------- 3. 起 mock orchestrator ----------
echo "[setup] starting mock ai-orchestrator on :$MOCK_PORT"
echo "[setup]   step interval = ${STEP_INTERVAL}ms (~7 stages × 2 transitions)"

if $BG; then
  nohup node --import tsx "$SCRIPT_DIR/src/mock-orchestrator.ts" \
    > "$LOG_DIR/mock-orch.log" 2>&1 &
  echo $! >> "$PID_FILE"
  echo "[setup] mock-orchestrator pid=$! (logs: $LOG_DIR/mock-orch.log)"
  # 等就绪
  for i in {1..20}; do
    sleep 0.5
    if curl -sf "http://127.0.0.1:$MOCK_PORT/v1/orchestrate/health" >/dev/null 2>&1; then
      echo "[setup] mock-orchestrator healthy"
      break
    fi
  done
else
  echo "[setup] === mock-orchestrator logs (Ctrl-C to stop) ==="
  exec node --import tsx "$SCRIPT_DIR/src/mock-orchestrator.ts"
fi

# ---------- 4. 启 toonflow-bridge tsc watch（仅 W6+ 改桥接代码时需要） ----------
if $BG && [[ "${WATCH_BRIDGE:-0}" == "1" ]]; then
  echo "[setup] starting toonflow-bridge tsc -w (WATCH_BRIDGE=1)"
  (cd "$BRIDGE_DIR" && $PKG_MGR run dev) \
    > "$LOG_DIR/bridge-watch.log" 2>&1 &
  echo $! >> "$PID_FILE"
fi

echo "[setup] === done ==="
echo "[setup] next step: bash setup.sh --stop  # 停服务"
echo "[setup] next step: cd $SCRIPT_DIR && npm start  # 跑 demo"
