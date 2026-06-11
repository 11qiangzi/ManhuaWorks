/**
 * workflow-engine 配置
 * 所有可调参数都集中在这里，避免散落在代码各处。
 */

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const str = (v: string | undefined, fallback: string): string => {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : fallback;
};

export const config = {
  /** HTTP 端口 */
  port: num(process.env.WORKFLOW_PORT, 8084),

  /** 运行环境 */
  env: str(process.env.NODE_ENV, 'development'),

  /** Redis 连接（BullMQ 任务队列 + checkpoint 落点） */
  redis: {
    url: str(process.env.REDIS_URL, 'redis://localhost:6379'),
    /** BullMQ 队列前缀 */
    queuePrefix: str(process.env.QUEUE_PREFIX, 'mw:wf:'),
    /** checkpoint 键前缀 */
    checkpointPrefix: str(process.env.CHECKPOINT_PREFIX, 'mw:wf:cp:'),
  },

  /** ai-router 地址（图像/视频/TTS 都走它） */
  aiRouter: {
    url: str(process.env.AI_ROUTER_URL, 'http://localhost:8082'),
    timeoutMs: num(process.env.AI_ROUTER_TIMEOUT_MS, 120_000),
  },

  /** 鉴权 */
  auth: {
    mode: str(process.env.AUTH_MODE, 'api-key') as 'api-key' | 'jwt' | 'none',
    apiKey: str(process.env.AUTH_API_KEY, 'dev-workflow-engine-key'),
    jwtSecret: str(process.env.AUTH_JWT_SECRET, 'dev-jwt-secret-change-me'),
  },

  /** DAG 调度 */
  orchestrator: {
    /** 单工作流最大并行节点数 */
    maxParallel: num(process.env.MAX_PARALLEL, 4),
    /** 单节点最长执行（兜底超时） */
    nodeTimeoutMs: num(process.env.NODE_TIMEOUT_MS, 600_000),
    /** 队列 Worker 并发 */
    workerConcurrency: num(process.env.WORKER_CONCURRENCY, 4),
    /** 队列最大堆积 */
    maxQueueSize: num(process.env.MAX_QUEUE_SIZE, 1000),
  },

  /** 重试 */
  retry: {
    maxAttempts: num(process.env.RETRY_MAX_ATTEMPTS, 3),
    /** 指数退避基数 ms：attempt N → baseMs * 4^(N-1) */
    baseMs: num(process.env.RETRY_BASE_MS, 1000),
  },

  /** 断点续跑 */
  checkpoint: {
    /** 保留秒数 */
    ttlSec: num(process.env.CHECKPOINT_TTL, 86_400),
  },

  /** FFmpeg 路径（Dockerfile 已装；本地开发需自带） */
  ffmpeg: {
    binary: str(process.env.FFMPEG_PATH, 'ffmpeg'),
    /** 临时工作目录 */
    workDir: str(process.env.WORK_DIR, '/tmp/mw-workflow'),
  },
} as const;

export type AppConfig = typeof config;
