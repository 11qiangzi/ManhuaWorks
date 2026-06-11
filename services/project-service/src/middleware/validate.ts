/**
 * zod 请求体验证中间件。
 *
 * 使用：
 * router.post('/', validate(z.object({ title: z.string() })), handler)
 */
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequestError } from './error';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
 return (req: Request, _res: Response, next: NextFunction): void => {
 const data = (req as unknown as Record<Source, unknown>)[source];
 const parsed = schema.safeParse(data);
 if (!parsed.success) {
 next(new BadRequestError('invalid params', parsed.error.flatten()));
 return;
 }
 // 回写校验后的数据（类型安全）
 (req as unknown as Record<Source, T>)[source] = parsed.data;
 next();
 };
}
