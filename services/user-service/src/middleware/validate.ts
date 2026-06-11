import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '@manhuaworks/shared';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = (req as unknown as Record<Source, unknown>)[source];
    const result = schema.safeParse(data);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      return next(new BadRequestError('validation_failed', details));
    }
    // 写入到带下划线 key 的位置以避免污染 express 字段
    (req as unknown as Record<string, unknown>)[`validated_${source}`] = result.data;
    next();
  };
}

export function getValidated<T = unknown>(req: Request, source: Source = 'body'): T {
  return (req as unknown as Record<string, T>)[`validated_${source}`] as T;
}
