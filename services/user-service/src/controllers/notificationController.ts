import { Request, Response, NextFunction } from 'express';
import { AuthedRequest, getUser } from '../middleware/auth';

/* ------------------------------------------------------------------ */
/*  Types & in-memory store                                           */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'system' | 'feature' | 'credits' | 'activity' | 'promo';
  read: boolean;
  createdAt: string; // ISO-8601
}

/** userId -> Notification[] */
const store = new Map<string, Notification[]>();

let idSeq = 0;
function nextId(): string {
  return `ntf_${++idSeq}_${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/*  Seed data — 首次访问时为用户生成 3-5 条示例通知                      */
/* ------------------------------------------------------------------ */

function seedFor(userId: string): Notification[] {
  const now = Date.now();
  const items: Notification[] = [
    {
      id: nextId(),
      userId,
      title: '欢迎来到 ManhuaWorks',
      body: '您的账号已创建成功，快来探索平台的强大功能吧！',
      type: 'system',
      read: false,
      createdAt: new Date(now - 3600_000 * 24 * 2).toISOString(),
    },
    {
      id: nextId(),
      userId,
      title: '新功能上线：批量导出',
      body: '现在支持将项目资源一键批量导出为 ZIP 包，前往「项目管理」体验。',
      type: 'feature',
      read: false,
      createdAt: new Date(now - 3600_000 * 24).toISOString(),
    },
    {
      id: nextId(),
      userId,
      title: '积分余额提醒',
      body: '您当前剩余积分 500 点，建议及时充值以保证服务正常使用。',
      type: 'credits',
      read: false,
      createdAt: new Date(now - 3600_000 * 12).toISOString(),
    },
    {
      id: nextId(),
      userId,
      title: '项目周报已生成',
      body: '您参与的项目本周有 12 次提交，点击查看详细报告。',
      type: 'activity',
      read: true,
      createdAt: new Date(now - 3600_000 * 6).toISOString(),
    },
    {
      id: nextId(),
      userId,
      title: '限时优惠：Pro 套餐 8 折',
      body: '即日起至月底，升级 Pro 套餐立享 8 折优惠，不要错过！',
      type: 'promo',
      read: false,
      createdAt: new Date(now - 3600_000 * 2).toISOString(),
    },
  ];
  store.set(userId, items);
  return items;
}

function getOrCreate(userId: string): Notification[] {
  let list = store.get(userId);
  if (!list) {
    list = seedFor(userId);
  }
  return list;
}

/* ------------------------------------------------------------------ */
/*  Handlers                                                          */
/* ------------------------------------------------------------------ */

/**
 * GET /notifications
 *   查询参数: ?unread=true  仅返回未读通知
 */
export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const list = getOrCreate(u.id);

    const unreadOnly = req.query['unread'] === 'true' || req.query['unread'] === '1';
    const result = unreadOnly ? list.filter((n) => !n.read) : list;

    // 按时间倒序
    result.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    const unreadCount = list.filter((n) => !n.read).length;

    res.status(200).json({
      code: 0,
      message: 'ok',
      data: {
        items: result,
        total: result.length,
        unreadCount,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /notifications/:id/read
 *   标记单条通知为已读
 */
export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const list = getOrCreate(u.id);
    const id = req.params['id'];

    const item = list.find((n) => n.id === id);
    if (!item) {
      res.status(404).json({ code: 'not_found', message: 'notification_not_found' });
      return;
    }

    item.read = true;

    res.status(200).json({ code: 0, message: 'ok', data: item });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /notifications/read-all
 *   将当前用户所有通知标记为已读
 */
export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const list = getOrCreate(u.id);

    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }

    res.status(200).json({ code: 0, message: 'ok', data: { marked: count } });
  } catch (e) {
    next(e);
  }
}
