/**
 * vitest config — ai-orchestrator
 *
 * 排除 src/e2e/（它是手写 main() runner，源码顶部 import.meta 调用了 main()，
 * 没有 vitest describe/it 包裹；直接跑会报 "No test suite found"）
 *
 * L3.C 任务里新增的 engine.test.ts + pipeline-bridge.test.ts 都在 src/workflow/ 下。
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "src/e2e/**"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: "basic",
  },
});
