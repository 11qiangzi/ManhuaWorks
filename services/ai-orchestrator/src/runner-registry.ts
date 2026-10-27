/**
 * 全局 PipelineRunner 注册表
 *
 * 解决 L5-C 遗留问题：index.ts 和 orchestrator-server.ts 各维护一个
 * new Map<string, PipelineRunner>()，互不共享。
 * 一个 run 从旧 API 发起就无法被新 API 取消。
 *
 * 统一出口：所有 pipeline 端点和 Job 接口共用此注册表，
 * 确保 cancel/resume 跨 API 版本生效。
 */
import { PipelineRunner, type PipelineDefinition } from "./pipeline-runner.js";

const runners = new Map<string, PipelineRunner>();

/**
 * 按 pipeline 定义获取（或创建）Runner 实例
 * 同一 pipeline 名永远返回同一个实例，保证 cancel/resume 一致性
 */
export function getRunner(p: PipelineDefinition): PipelineRunner {
  let r = runners.get(p.name);
  if (!r) {
    r = new PipelineRunner(p);
    runners.set(p.name, r);
  }
  return r;
}

/**
 * 按 pipeline 名查找 runner（用于外部取消）
 */
export function findRunner(name: string): PipelineRunner | undefined {
  return runners.get(name);
}

/**
 * 获取当前所有活跃的 runner 信息（调试/健康检查用）
 */
export function listRunnerNames(): string[] {
  return Array.from(runners.keys());
}

/**
 * 清空注册表（仅测试用）
 */
export function clearRunners(): void {
  runners.clear();
}
