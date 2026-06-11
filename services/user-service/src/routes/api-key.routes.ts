/**
 * API Key 路由
 *
 * 路径前缀�?api/v1/user/api-keys（在 routes/index.ts 挂载�? *
 * 端点�? *   POST   /                          �?key（userId �?auth 拿）
 *   GET    /                          �?user 的所�?key（无明文�? *   DELETE /:id                       软删
 *   GET    /:id/reveal                一次性展示明文（前端 UI 用，谨慎使用�? *
 * 内部函数�? *   getDecryptedKey(userId, provider) �?�?ai-orchestrator 等内部服务使�? *
 * 安全约束�? *   - 绝不打印 plaintext 到日�? *   - 绝不返回 encryptedKey / plaintext 给未授权�? *   - 路由层只暴露 ApiKeyPublic 元数�? */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, getUser } from '@manhuaworks/shared';
import { apiKeyRepo, ApiKeyNotFoundError, ApiKeyConflictError, type ApiKeyProvider } from '../repos/api-key.repo';
import { generateMasterKey } from '../services/crypto';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '@manhuaworks/shared';

// masterKey 启动时生成一次（生产环境�?KMS / env 拿）
// 这里不直�?require env，避免拖�?import；如需用真 env，可�?index.ts 注入
let _masterKey = process.env['BYOK_MASTER_KEY'] ?? generateMasterKey();

export function setMasterKey(key: string): void {
  _masterKey = key;
}

export function getMasterKey(): string {
  return _masterKey;
}

/** 内部服务调用入口：取用户对某 provider 的明�?key�?*/
export function getDecryptedKey(userId: string, provider: ApiKeyProvider): string | null {
  const active = apiKeyRepo.findActiveByUserProvider(userId, provider);
  if (!active) return null;
  try {
    const plain = apiKeyRepo.decryptKey(active.id, _masterKey);
    apiKeyRepo.touchLastUsed(active.id);
    return plain;
  } catch {
    return null;
  }
}

const Providers: ApiKeyProvider[] = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'minimax',
];

const AddBody = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'deepseek', 'minimax']),
  apiKey: z.string().min(1).max(2048),
});

export const router = Router();

/* 所有路由都要登�?*/
router.use(requireAuth());

/* POST /  —�?�?key */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = AddBody.parse(req.body);
    const user = req.user!;
    const record = apiKeyRepo.create(user.id, body.provider, body.apiKey, _masterKey);
    res.status(201).json({ code: 0, message: 'created', data: record });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new BadRequestError('invalid_body', err.flatten()));
    }
    if (err instanceof ApiKeyConflictError) {
      return next(new ConflictError(err.message));
    }
    next(err);
  }
});

/* GET /  —�?列表 */
router.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const list = apiKeyRepo.listByUser(user.id);
  res.json({ code: 0, message: 'ok', data: list });
});

/* DELETE /:id  —�?软删 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const found = apiKeyRepo.findById(req.params.id!);
    if (found.userId !== user.id) {
      return next(new NotFoundError('api_key_not_found'));
    }
    const revoked = apiKeyRepo.revoke(req.params.id!);
    res.json({ code: 0, message: 'revoked', data: revoked });
  } catch (err) {
    if (err instanceof ApiKeyNotFoundError) {
      return next(new NotFoundError('api_key_not_found'));
    }
    next(err);
  }
});

/* GET /:id/reveal  —�?一次性展示明�? * ⚠️ 这个端点会把明文返回给前端，请确认前端只在用户明确点�?显示"按钮时调用�? * 业务约束：仅 owner 可见；仅 1 次（用完即焚）�? *
 * 当前实现：每�?reveal 都会返回明文�? * "1 �?语义在更高层（前端）实现：点击后展示并立刻置灰按钮�? * 如果要服务端"1 �?语义，需要在 record 上加一�?revealToken / revealCount 字段�? */
router.get('/:id/reveal', (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const found = apiKeyRepo.findById(req.params.id!);
    if (found.userId !== user.id) {
      return next(new NotFoundError('api_key_not_found'));
    }
    const plain = apiKeyRepo.decryptKey(req.params.id!, _masterKey);
    // ⚠️ 不打日志，不�?errorHandler
    res.json({ code: 0, message: 'ok', data: { apiKey: plain } });
  } catch (err) {
    if (err instanceof ApiKeyNotFoundError) {
      return next(new NotFoundError('api_key_not_found'));
    }
    if (err instanceof Error && /revoked/.test(err.message)) {
      return next(new BadRequestError('api_key_revoked'));
    }
    next(err);
  }
});

// 重新 export providers 方便外部校验
export const SUPPORTED_PROVIDERS = Providers;
