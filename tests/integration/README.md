# ManhuaWorks · W5 集成测试指南

> 跨模块集成测试：端到端冒烟 + 性能基线 + 跨服务链路追踪
>
> 作者：钟帧（前端）+ 陈远枢（PM/测试）
> 日期：2026-06-08

---

## 📦 测试范围

| 文件 | 用途 | 链路 |
|------|------|------|
| `novel-to-drama.e2e.test.ts` | 1 集端到端（小说→mp4） | 5 服务 |
| `byok-flow.e2e.test.ts` | BYOK key 流程 | ai-keys + ai-router |
| `collab-realtime.e2e.test.ts` | 协作实时同步 + 冲突 | collab-service |
| `workflow-run.e2e.test.ts` | 12 类节点编排运行 | workflow-engine |
| `perf-bench.test.ts` | 6 pipeline × 3 mode 性能 | 5 服务 |
| `load-test.test.ts` | 50 并发 + 错误率 < 1% | 5 服务 |
| `trace.test.ts` | trace_id 跨 5 服务透传 | 5 服务 |

---

## 🚀 怎么跑

### 1) 启动 5 服务（dev mode）

```bash
# 终端 1-5 分别启动
pnpm --filter @manhuaworks/ai-router dev          # 8083
pnpm --filter @manhuaworks/ai-keys-service dev    # 8088
pnpm --filter @manhuaworks/workflow-engine dev    # 8084
pnpm --filter @manhuaworks/asset-service dev      # 8085
pnpm --filter @manhuaworks/ai-orchestrator dev    # 8087
```

### 2) 跑集成测试

```bash
cd D:\ManhuaWorks\tests
pnpm test tests/integration
```

### 3) 跑指定文件

```bash
pnpm test tests/integration/novel-to-drama.e2e.test.ts
pnpm test tests/integration/perf-bench.test.ts
pnpm test tests/integration/load-test.test.ts
```

---

## 🔧 配置

`fixtures/config.json` 是入口配置：
- **5 服务端口 + 健康检查路径**
- **数据库路径 + 备份策略**
- **测试凭据 + fixture 路径**
- **超时阈值 + 负载配置 + trace header**

要改端口？改 `config.json` 即可，所有 helper 都从这里读。

---

## 🧱 架构

```
tests/integration/
├── setup.ts                # 起 5 服务 + DB + trace
├── teardown.ts             # 停服务 + 清库 + 写报告
├── *.e2e.test.ts           # 7 个 E2E 文件
├── helpers/
│   ├── wait-for-service.ts # 健康检查轮询
│   └── trace-collector.ts  # trace_id + span 收集
├── fixtures/
│   ├── config.json         # 端口/凭据/路径
│   ├── demo-novel-200.txt  # 短 demo
│   └── demo-novel-1000.txt # 长 demo
└── reports/
    └── baseline.json       # 性能基线（6×3）
```

---

## 🤖 接 CI

### GitHub Actions 示例

```yaml
# .github/workflows/integration.yml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @manhuaworks/ai-router dev &
      - run: pnpm --filter @manhuaworks/ai-keys-service dev &
      - run: pnpm --filter @manhuaworks/workflow-engine dev &
      - run: pnpm --filter @manhuaworks/asset-service dev &
      - run: pnpm --filter @manhuaworks/ai-orchestrator dev &
      - run: sleep 30  # 等服务起来
      - run: pnpm test tests/integration
      - uses: actions/upload-artifact@v4
        with:
          name: integration-reports
          path: tests/integration/reports/
```

### 失败重试

CI 默认跑 1 次。本地调试可加 `--retry`：
```bash
pnpm test tests/integration -- --retry 2
```

---

## ❌ 失败排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `service not ready` | dev 服务没起 | 检查 5 个 dev 终端，确认端口未占用 |
| `HTTP 401` | 测试 token 失效 | 看 `config.json` → `credentials.testUser.token` |
| `trace_id mismatch` | 服务没读 `x-trace-id` header | 检查中间件：`request.header.get('x-trace-id')` |
| `load-test` p95 > 5s | 机器太慢 | 把 `targetErrorRate` 调到 0.05 重跑 |
| `E2E timeout` | 30s 内服务没回 | 看 `teardown.ts` 里的 trace 报告，定位慢服务 |
| `ECONNREFUSED 8083` | 端口被占 | `netstat -ano | findstr :8083` 杀进程 |

---

## 📊 报告

- `reports/baseline.json` — 6 pipeline × 3 mode 性能基线
- `reports/trace-summary.json` — 跑完自动生成（trace 数量 + 各服务 span 数 + 耗时分布）
- `reports/traces.json` — 完整 trace dump（debug 用）

---

## 🔁 复用 W4 框架

本目录**没有重写 setup**。复用 W4 的：
- `vitest.config.ts`（alias + setupFiles）
- `mock-providers.ts`（4 个 mock provider）
- `global-setup.ts`（环境变量 + console 静默）
- `user-portal/stubs` + `collab-service/stubs`（组件 + 路由 mock）

如需新增测试：
1. 复制现有 `*.e2e.test.ts` 改一下 fixture
2. 加到 `setup.ts` 的服务列表（如果新加服务）
3. 跑 `pnpm test tests/integration` 验证

---

## 📝 已知限制

- W5 用 **dev mode + mock providers**，非真实 AI provider 调用
- W6 接入真实 provider 后，**`baseline.json` 需要重新校准**
- 跨服务 trace 仅记录**入口**和**内部 fetch**，不深入 DB/Redis
- 负载测试 50 并发是 dev mode 基准，生产环境需要 k6 重测

---

**owner:** 钟帧 + 陈远枢 · **next review:** W6 开始前
