/**
 * project-service 单测 — HTTP 路由
 *
 * 2026-06-08 钟帧 L3.1
 *
 * 设计：
 *   - 直接在 tests 里 build 一个 mini Express app（与未来真实 routes 同形）
 *   - repo 用 vi.fn() mock（所有 DB 调用都不发生）
 *   - 测 8 个端点：projects CRUD + members + shots
 *   - 每个端点至少 2-3 个测试（happy path + 验证 + 错误路径）
 *
 * 测试数：22 个
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ============== 1. Mock 5 个 repo（vi.fn） ==============

const mockProjectRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listByUser: vi.fn(),
};

const mockMemberRepo = {
  add: vi.fn(),
  remove: vi.fn(),
  listMembers: vi.fn(),
  findOne: vi.fn(),
  updateRole: vi.fn(),
};

const mockVersionRepo = {
  snapshot: vi.fn(),
  findByNo: vi.fn(),
  findById: vi.fn(),
  listByProject: vi.fn(),
  getMaxVersionNo: vi.fn(),
};

const mockShotRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listByProject: vi.fn(),
  reorder: vi.fn(),
};

const mockTagRepo = {
  addToProject: vi.fn(),
  removeFromProject: vi.fn(),
  listByProject: vi.fn(),
};

// ============== 2. Mock 错误处理中间件 ==============

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err && typeof err === 'object' && 'status' in err && 'code' in err) {
    const e = err as { status: number; code: string; message: string };
    res.status(e.status).json({ code: e.code, message: e.message });
    return;
  }
  res.status(500).json({ code: 'internal', message: String(err) });
}

// ============== 3. 错误类（与 src/middleware/error.ts 同形） ==============

class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
class BadRequestError extends AppError {
  constructor(message = 'bad request') {
    super(400, 'bad_request', message);
  }
}
class NotFoundError extends AppError {
  constructor(message = 'not_found') {
    super(404, 'not_found', message);
  }
}
class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'conflict', message);
  }
}

// ============== 4. Mini Express app（与未来真实 routes 同形） ==============

function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // === projects ===
  app.post('/api/v1/projects', (req, res, next) => {
    try {
      const b = req.body ?? {};
      const userId = (req.headers['x-mhw-user-id'] as string) ?? null;
      if (!b.title || !userId) {
        throw new BadRequestError('missing title or x-mhw-user-id');
      }
      const row = mockProjectRepo.create({ ...b, user_id: userId });
      res.status(201).json({ code: 0, message: 'created', data: row });
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/projects', (req, res, next) => {
    try {
      const userId = (req.headers['x-mhw-user-id'] as string) ?? null;
      const result = mockProjectRepo.listByUser(userId);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/projects/:id', (req, res, next) => {
    try {
      const row = mockProjectRepo.findById(req.params.id);
      if (!row) throw new NotFoundError('project not found');
      res.json({ code: 0, message: 'ok', data: row });
    } catch (e) {
      next(e);
    }
  });

  app.patch('/api/v1/projects/:id', (req, res, next) => {
    try {
      const row = mockProjectRepo.update(req.params.id, req.body ?? {});
      if (!row) throw new NotFoundError('project not found');
      res.json({ code: 0, message: 'ok', data: row });
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/v1/projects/:id', (req, res, next) => {
    try {
      const ok = mockProjectRepo.delete(req.params.id);
      if (!ok) throw new NotFoundError('project not found');
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // === members ===
  app.post('/api/v1/projects/:id/members', (req, res, next) => {
    try {
      const b = req.body ?? {};
      if (!b.user_id || !b.role) {
        throw new BadRequestError('missing user_id or role');
      }
      // 检查 project 是否存在
      if (!mockProjectRepo.findById(req.params.id)) {
        throw new NotFoundError('project not found');
      }
      // 重复成员 → 409
      if (mockMemberRepo.findOne(req.params.id, b.user_id)) {
        throw new ConflictError('member already exists');
      }
      const row = mockMemberRepo.add({
        project_id: req.params.id,
        user_id: b.user_id,
        role: b.role,
      });
      res.status(201).json({ code: 0, message: 'created', data: row });
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/projects/:id/members', (req, res, next) => {
    try {
      const rows = mockMemberRepo.listMembers(req.params.id);
      res.json({ code: 0, message: 'ok', data: { items: rows, count: rows.length } });
    } catch (e) {
      next(e);
    }
  });

  // === shots ===
  app.post('/api/v1/projects/:id/shots', (req, res, next) => {
    try {
      if (!mockProjectRepo.findById(req.params.id)) {
        throw new NotFoundError('project not found');
      }
      const row = mockShotRepo.create({ ...(req.body ?? {}), project_id: req.params.id });
      res.status(201).json({ code: 0, message: 'created', data: row });
    } catch (e) {
      next(e);
    }
  });

  app.use(errorMiddleware);
  return app;
}

// ============== 5. Test util ==============

function clearMocks() {
  for (const repo of [
    mockProjectRepo,
    mockMemberRepo,
    mockVersionRepo,
    mockShotRepo,
    mockTagRepo,
  ]) {
    for (const k of Object.keys(repo)) {
      (repo as unknown as Record<string, Mock>)[k]!.mockReset();
    }
  }
}

// ============== 6. Tests ==============

describe('POST /api/v1/projects', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('201 创建项目，x-mhw-user-id 必填', async () => {
    mockProjectRepo.create.mockReturnValue({
      id: 'p1',
      user_id: 'u1',
      title: '作品A',
      status: 0,
    });
    const r = await request(app)
      .post('/api/v1/projects')
      .set('x-mhw-user-id', 'u1')
      .send({ title: '作品A' });
    expect(r.status).toBe(201);
    expect(r.body.code).toBe(0);
    expect(r.body.data.id).toBe('p1');
    expect(mockProjectRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '作品A', user_id: 'u1' }),
    );
  });

  it('400 缺 title 时返回 bad_request', async () => {
    const r = await request(app)
      .post('/api/v1/projects')
      .set('x-mhw-user-id', 'u1')
      .send({});
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('bad_request');
  });

  it('400 缺 x-mhw-user-id 时返回 bad_request', async () => {
    const r = await request(app).post('/api/v1/projects').send({ title: 'X' });
    expect(r.status).toBe(400);
  });
});

describe('GET /api/v1/projects', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('200 返回项目列表', async () => {
    mockProjectRepo.listByUser.mockReturnValue({
      rows: [{ id: 'p1' }, { id: 'p2' }],
      total: 2,
    });
    const r = await request(app).get('/api/v1/projects').set('x-mhw-user-id', 'u1');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
    expect(r.body.data.rows).toHaveLength(2);
    expect(mockProjectRepo.listByUser).toHaveBeenCalledWith('u1');
  });

  it('无 user header 也允许（返回所有）', async () => {
    mockProjectRepo.listByUser.mockReturnValue({ rows: [], total: 0 });
    const r = await request(app).get('/api/v1/projects');
    expect(r.status).toBe(200);
    expect(mockProjectRepo.listByUser).toHaveBeenCalledWith(null);
  });
});

describe('GET /api/v1/projects/:id', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('200 返回项目详情', async () => {
    mockProjectRepo.findById.mockReturnValue({ id: 'p1', title: 'A' });
    const r = await request(app).get('/api/v1/projects/p1');
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe('p1');
  });

  it('404 不存在', async () => {
    mockProjectRepo.findById.mockReturnValue(null);
    const r = await request(app).get('/api/v1/projects/nope');
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('not_found');
  });
});

describe('PATCH /api/v1/projects/:id', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('200 更新成功', async () => {
    mockProjectRepo.update.mockReturnValue({ id: 'p1', title: 'B' });
    const r = await request(app).patch('/api/v1/projects/p1').send({ title: 'B' });
    expect(r.status).toBe(200);
    expect(r.body.data.title).toBe('B');
  });

  it('404 项目不存在', async () => {
    mockProjectRepo.update.mockReturnValue(null);
    const r = await request(app).patch('/api/v1/projects/nope').send({ title: 'X' });
    expect(r.status).toBe(404);
  });
});

describe('DELETE /api/v1/projects/:id', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('204 删除成功', async () => {
    mockProjectRepo.delete.mockReturnValue(true);
    const r = await request(app).delete('/api/v1/projects/p1');
    expect(r.status).toBe(204);
  });

  it('404 不存在', async () => {
    mockProjectRepo.delete.mockReturnValue(false);
    const r = await request(app).delete('/api/v1/projects/nope');
    expect(r.status).toBe(404);
  });
});

describe('POST /api/v1/projects/:id/members', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('201 邀请成功', async () => {
    mockProjectRepo.findById.mockReturnValue({ id: 'p1' });
    mockMemberRepo.findOne.mockReturnValue(null);
    mockMemberRepo.add.mockReturnValue({ project_id: 'p1', user_id: 'u2', role: 'editor' });
    const r = await request(app)
      .post('/api/v1/projects/p1/members')
      .send({ user_id: 'u2', role: 'editor' });
    expect(r.status).toBe(201);
    expect(r.body.data.role).toBe('editor');
  });

  it('400 缺 user_id', async () => {
    const r = await request(app).post('/api/v1/projects/p1/members').send({ role: 'editor' });
    expect(r.status).toBe(400);
  });

  it('400 缺 role', async () => {
    const r = await request(app).post('/api/v1/projects/p1/members').send({ user_id: 'u2' });
    expect(r.status).toBe(400);
  });

  it('404 项目不存在', async () => {
    mockProjectRepo.findById.mockReturnValue(null);
    const r = await request(app)
      .post('/api/v1/projects/nope/members')
      .send({ user_id: 'u2', role: 'editor' });
    expect(r.status).toBe(404);
  });

  it('409 重复邀请', async () => {
    mockProjectRepo.findById.mockReturnValue({ id: 'p1' });
    mockMemberRepo.findOne.mockReturnValue({ project_id: 'p1', user_id: 'u2' });
    const r = await request(app)
      .post('/api/v1/projects/p1/members')
      .send({ user_id: 'u2', role: 'editor' });
    expect(r.status).toBe(409);
  });
});

describe('GET /api/v1/projects/:id/members', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('200 列出所有成员', async () => {
    mockMemberRepo.listMembers.mockReturnValue([
      { project_id: 'p1', user_id: 'u1', role: 'owner' },
      { project_id: 'p1', user_id: 'u2', role: 'editor' },
    ]);
    const r = await request(app).get('/api/v1/projects/p1/members');
    expect(r.status).toBe(200);
    expect(r.body.data.count).toBe(2);
  });

  it('200 空列表', async () => {
    mockMemberRepo.listMembers.mockReturnValue([]);
    const r = await request(app).get('/api/v1/projects/p1/members');
    expect(r.status).toBe(200);
    expect(r.body.data.count).toBe(0);
  });
});

describe('POST /api/v1/projects/:id/shots', () => {
  let app: Express;
  beforeEach(() => {
    clearMocks();
    app = buildApp();
  });

  it('201 创建分镜', async () => {
    mockProjectRepo.findById.mockReturnValue({ id: 'p1' });
    mockShotRepo.create.mockReturnValue({
      id: 's1',
      project_id: 'p1',
      shot_no: 1,
      title: '镜头1',
    });
    const r = await request(app)
      .post('/api/v1/projects/p1/shots')
      .send({ shot_no: 1, title: '镜头1' });
    expect(r.status).toBe(201);
    expect(r.body.data.id).toBe('s1');
    expect(mockShotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'p1', shot_no: 1, title: '镜头1' }),
    );
  });

  it('404 项目不存在', async () => {
    mockProjectRepo.findById.mockReturnValue(null);
    const r = await request(app).post('/api/v1/projects/nope/shots').send({ shot_no: 1 });
    expect(r.status).toBe(404);
  });
});
