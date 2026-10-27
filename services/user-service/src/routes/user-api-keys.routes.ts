/**
 * 派单 17: BYOK user_api_keys 路由
 *
 * 挂载路径: /api/v1/user/byok-keys  (在 routes/index.ts 挂载)
 *
 * 端点 (5 个, 派单 17 字面要求):
 *   GET    /                列用户所有 key (脱敏, 不返回 apiKeyEncrypted)
 *   POST   /                body: { provider, apiKey, baseUrl?, nickname, isDefault? }
 *                          → 加 key (AES-256-GCM 加密存)
 *   PATCH  /:id             body: { nickname?, isDefault? }
 *                          → 改 (不能改 key 本身, 删了重加)
 *   DELETE /:id             删 key (硬删)
 *   POST   /:id/test        用 key 调一次最小请求, 返回 ok / invalid / rate_limited
 *
 * 安全:
 *   - 所有路由需 auth (requireAuth)
 *   - 不返回 apiKeyEncrypted 明文
 *   - 不在日志打 plaintext
 *   - 401 降级: provider 返回 401 时不静默重试, 提示用户重新填
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, BadRequestError, NotFoundError, ConflictError } from '@manhuaworks/shared';
import {
  userApiKeysRepo,
  SUPPORTED_PROVIDERS,
  UserApiKeyNotFoundError,
  UserApiKeyConflictError,
  type UserApiKeyProvider,
} from '../repos/user-api-keys.repo';
import { generateMasterKey } from '../services/crypto';
import { rateLimitByokKey } from '../middleware/rate-limit-byok';

let _masterKey = process.env['BYOK_MASTER_KEY'] ?? generateMasterKey();

export function setUserApiKeysMasterKey(k: string): void {
  _masterKey = k;
}

export function getUserApiKeysMasterKey(): string {
  return _masterKey;
}

/* ------------------------------------------------------------------ */
/*                              Zod 校验                              */
/* ------------------------------------------------------------------ */
const ProviderEnum = z.enum(['deepseek', 'openai', 'replicate', 'qianwen', 'zhipu', 'fal']);

const AddBody = z.object({
  provider: ProviderEnum,
  apiKey: z.string().min(1, 'apiKey required').max(2048),
  baseUrl: z.string().url().max(500).optional(),
  nickname: z.string().min(1, 'nickname required').max(100),
  isDefault: z.boolean().optional(),
});

const PatchBody = z.object({
  nickname: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
}).refine((v) => v.nickname !== undefined || v.isDefault !== undefined, {
  message: '至少传 nickname 或 isDefault 一个字段',
});

/* ------------------------------------------------------------------ */
/*                              路由                                  */
/* ------------------------------------------------------------------ */
export const router = Router();

router.use(requireAuth());

/* GET /  — 列表 (脱敏) */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const list = await userApiKeysRepo.listByUser(user.id);
    res.json({ code: 0, message: 'ok', data: list });
  } catch (err) {
    next(err);
  }
});

/* POST /  — 加 key */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = AddBody.parse(req.body);
    const user = req.user!;
    const created = await userApiKeysRepo.create(
      user.id,
      body.provider as UserApiKeyProvider,
      body.apiKey,
      body.nickname,
      {
        baseUrl: body.baseUrl,
        isDefault: body.isDefault,
        masterKey: _masterKey,
      }
    );
    res.status(201).json({ code: 0, message: 'created', data: created });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new BadRequestError('invalid_body', err.flatten()));
    }
    if (err instanceof UserApiKeyConflictError) {
      return next(new ConflictError(err.message));
    }
    next(err);
  }
});

/* PATCH /:id  — 改 (不能改 key 本身) */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = PatchBody.parse(req.body);
    const user = req.user!;
    // 先查, 确认 owner
    const found = await userApiKeysRepo.findById(req.params.id!);
    if (found.userId !== user.id) {
      return next(new NotFoundError('byok_key_not_found'));
    }
    const updated = await userApiKeysRepo.update(req.params.id!, {
      nickname: body.nickname,
      isDefault: body.isDefault,
    });
    res.json({ code: 0, message: 'updated', data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new BadRequestError('invalid_body', err.flatten()));
    }
    if (err instanceof UserApiKeyNotFoundError) {
      return next(new NotFoundError('byok_key_not_found'));
    }
    next(err);
  }
});

/* DELETE /:id  — 硬删 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    // 先确认 owner (避免用 repo.delete 的 userId 过滤导致 404 歧义)
    const found = await userApiKeysRepo.findById(req.params.id!);
    if (found.userId !== user.id) {
      return next(new NotFoundError('byok_key_not_found'));
    }
    await userApiKeysRepo.delete(req.params.id!, user.id);
    res.json({ code: 0, message: 'deleted', data: { id: req.params.id! } });
  } catch (err) {
    if (err instanceof UserApiKeyNotFoundError) {
      return next(new NotFoundError('byok_key_not_found'));
    }
    next(err);
  }
});

/* POST /:id/test  — 测 key 有效性
 * 限流: 1 小时 60 次/key (派单 17)
 */
router.post(
  '/:id/test',
  rateLimitByokKey({ limit: 60, windowMs: 60 * 60 * 1000 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = req.params.id!;
      const found = await userApiKeysRepo.findById(id);
      if (found.userId !== user.id) {
        return next(new NotFoundError('byok_key_not_found'));
      }
      // 拿明文, 走 provider-specific ping
      const internal = await userApiKeysRepo.findByIdInternal(id);
      const plaintext = userApiKeysRepo.decryptKey(internal, _masterKey);
      const pingResult = await pingProvider(
        internal.provider as UserApiKeyProvider,
        plaintext,
        internal.baseUrl ?? undefined
      );

      // 记结果 (限流中间件已写过 rate_limit_counters)
      await userApiKeysRepo.recordTestResult(id, pingResult.status);

      if (pingResult.status === 'ok') {
        return res.json({
          code: 0,
          message: 'ok',
          data: {
            status: 'ok',
            latencyMs: pingResult.latencyMs,
            provider: internal.provider,
            testedAt: new Date().toISOString(),
          },
        });
      }
      if (pingResult.status === 'rate_limited') {
        return res.status(429).json({
          code: 42901,
          message: 'provider_rate_limited',
          data: {
            status: 'rate_limited',
            provider: internal.provider,
            hint: '服务商限流,稍后再试',
          },
        });
      }
      // invalid (401/403/网络错误)
      return res.status(400).json({
        code: 40001,
        message: 'invalid_key',
        data: {
          status: 'invalid',
          provider: internal.provider,
          hint: 'Key 无效或已过期,请重新填写',
        },
      });
    } catch (err) {
      if (err instanceof UserApiKeyNotFoundError) {
        return next(new NotFoundError('byok_key_not_found'));
      }
      next(err);
    }
  }
);

/* ------------------------------------------------------------------ */
/*                              Provider ping                         */
/* ------------------------------------------------------------------ */
/**
 * 各 provider 的"最小有效请求"
 * - openai:  GET  {base}/v1/models  (Bearer key)
 * - deepseek: GET {base}/models     (Bearer key, base 默认 https://api.deepseek.com)
 * - qianwen:  GET {base}/compatible-mode/v1/models (兼容 OpenAI, Bearer)
 * - zhipu:    GET {base}/v4/models  (Bearer)
 * - replicate: GET {base}/v1/models (Bearer, 默认 https://api.replicate.com)
 * - fal:      GET {base}/models     (Bearer, 默认 https://fal.run)
 *
 * 失败 → 401/403 → invalid
 * 失败 → 429 → rate_limited
 * 其他 → invalid
 */
interface PingResult {
  status: 'ok' | 'invalid' | 'rate_limited';
  latencyMs: number;
  detail?: string;
}

const PROVIDER_DEFAULTS: Record<UserApiKeyProvider, { base: string; path: string }> = {
  openai: { base: 'https://api.openai.com', path: '/v1/models' },
  deepseek: { base: 'https://api.deepseek.com', path: '/models' },
  qianwen: { base: 'https://dashscope.aliyuncs.com', path: '/compatible-mode/v1/models' },
  zhipu: { base: 'https://open.bigmodel.cn', path: '/api/paas/v4/models' },
  replicate: { base: 'https://api.replicate.com', path: '/v1/models' },
  fal: { base: 'https://fal.run', path: '/models' },
};

async function pingProvider(
  provider: UserApiKeyProvider,
  apiKey: string,
  baseUrlOverride?: string
): Promise<PingResult> {
  const cfg = PROVIDER_DEFAULTS[provider];
  const base = baseUrlOverride || cfg.base;
  const url = `${base.replace(/\/$/, '')}${cfg.path}`;
  const start = Date.now();

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10_000); // 10s timeout
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (resp.ok) {
      return { status: 'ok', latencyMs };
    }
    if (resp.status === 429) {
      return { status: 'rate_limited', latencyMs };
    }
    // 401 / 403 / 400 / 404 → 都视为 invalid (key 错, 或 path 错)
    return { status: 'invalid', latencyMs, detail: `HTTP ${resp.status}` };
  } catch (e) {
    const latencyMs = Date.now() - start;
    // 网络错误/超时 → 视为 invalid (key 无法验证)
    return { status: 'invalid', latencyMs, detail: e instanceof Error ? e.message : 'network_error' };
  }
}

// 重新 export providers 方便外部校验
export const BYOK_SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;
