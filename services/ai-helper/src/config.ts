/**
 * ai-helper 配置
 * 所有可调参数都集中在这里，避免散落在代码各处。
 *
 * 设计思路：
 *  - ai-helper 是"轻量 LLM 编排服务"，自己不持有模型。
 *  - 文本生成统一通过 ai-router 走（与 workflow-engine 共用模型通道）。
 *  - 多 prompt 工程集中放在 src/prompts/，config 这里只放运行时参数。
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
  port: num(process.env.HELPER_PORT, 8086),

  /** 运行环境 */
  env: str(process.env.NODE_ENV, 'development'),

  /** ai-router 地址（统一 LLM 入口） */
  aiRouter: {
    url: str(process.env.AI_ROUTER_URL, 'http://localhost:8082'),
    timeoutMs: num(process.env.AI_ROUTER_TIMEOUT_MS, 120_000),
    /** 文本生成默认模型 id，由 ai-router 解析 */
    defaultModel: str(process.env.AI_HELPER_DEFAULT_MODEL, 'gpt-4o-mini'),
    /** temperature：创作类建议 0.7~0.9，检测/翻译类建议 0.1~0.3 */
    temperature: num(process.env.AI_HELPER_TEMPERATURE, 0.7),
  },

  /** 鉴权（与 workflow-engine 保持一致的三种模式） */
  auth: {
    mode: str(process.env.AUTH_MODE, 'api-key') as 'api-key' | 'jwt' | 'none',
    apiKey: str(process.env.AUTH_API_KEY, 'dev-ai-helper-key'),
    jwtSecret: str(process.env.AUTH_JWT_SECRET, 'dev-jwt-secret-change-me'),
  },

  /** 单次请求最大输入字符数（防止 prompt 注入 + 限流） */
  limits: {
    maxInputChars: num(process.env.AI_HELPER_MAX_INPUT_CHARS, 200_000),
    maxEpisodesForContinue: num(process.env.AI_HELPER_MAX_EPISODES, 10),
  },

  /** 特性开关 */
  features: {
    /** 是否在响应中返回 prompt 调试信息（仅 dev 模式默认开启） */
    returnPromptDebug: str(process.env.AI_HELPER_DEBUG, 'auto'),
    /** 续写时是否启用"前情提要"压缩（基于规则而非 LLM） */
    compressContext: true,
  },
} as const;

export type AppConfig = typeof config;
