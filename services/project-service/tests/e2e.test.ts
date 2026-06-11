/**
 * project-service e2e — 完整项目生命周期
 *
 * 2026-06-08 钟帧 L3.1
 *
 * 1 个长测试，串起：
 *   创建项目 → 邀请成员 → 添加分镜 → 修改项目 → 改成员角色 → 删除项目
 *
 * 设计：
 *   - 用 in-memory storage + 真实 express + supertest
 *   - 所有 repo 共享一个 storage（确保数据可见性）
 *   - 验证：跨多次 HTTP 调用，状态保持一致
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ============== 1. 共享 storage + 5 个 repo ==============

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  art_style: string | null;
  story_type: string | null;
  cover_url: string | null;
  status: 0 | 1 | 2 | 3;
  created_at: Date;
}
interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  joined_at: Date;
  last_active_at: Date | null;
}
interface ShotRow {
  id: string;
  project_id: string;
  shot_no: number;
  title: string | null;
  status: 0 | 1 | 2 | 3;
  sort_index: number;
}
interface VersionRow {
  id: string;
  project_id: string;
  version_no: number;
  snapshot: Record<string, unknown>;
  message: string | null;
  created_by: string;
  created_at: Date;
}
interface TagRow {
  project_id: string;
  tag: string;
  created_at: Date;
}

const storage = {
  projects: new Map<string, ProjectRow>(),
  members: new Map<string, ProjectMemberRow>(),
  shots: new Map<string, ShotRow>(),
  versions: new Map<string, VersionRow>(),
  tags: new Map<string, TagRow>(),
};

let _idSeq = 0;
function newId(p: string): string {
  _idSeq += 1;
  return `${p}-${_idSeq.toString(36).padStart(6, '0')}`;
}
const t0 = new Date('2026-06-08T10:00:00Z');

function clearStorage() {
  storage.projects.clear();
  storage.members.clear();
  storage.shots.clear();
  storage.versions.clear();
  storage.tags.clear();
  _idSeq = 0;
}

// ===== ProjectRepo =====
const ProjectRepo = {
  create(input: {
    user_id: string;
    title: string;
    description?: string | null;
    art_style?: string | null;
    story_type?: string | null;
    cover_url?: string | null;
    status?: 0 | 1 | 2 | 3;
  }): ProjectRow {
    const row: ProjectRow = {
      id: newId('proj'),
      user_id: input.user_id,
      title: input.title,
      description: input.description ?? null,
      art_style: input.art_style ?? null,
      story_type: input.story_type ?? null,
      cover_url: input.cover_url ?? null,
      status: input.status ?? 0,
      created_at: new Date(),
    };
    storage.projects.set(row.id, row);
    return row;
  },
  findById(id: string): ProjectRow | null {
    return storage.projects.get(id) ?? null;
  },
  update(id: string, patch: Partial<ProjectRow>): ProjectRow | null {
    const cur = storage.projects.get(id);
    if (!cur) return null;
    const next: ProjectRow = { ...cur, ...patch };
    storage.projects.set(id, next);
    return next;
  },
  delete(id: string): boolean {
    if (!storage.projects.has(id)) return false;
    storage.projects.delete(id);
    storage.members.forEach((m, k) => {
      if (m.project_id === id) storage.members.delete(k);
    });
    storage.shots.forEach((s, k) => {
      if (s.project_id === id) storage.shots.delete(k);
    });
    return true;
  },
};

// ===== ProjectMemberRepo =====
const MemberRepo = {
  add(input: { project_id: string; user_id: string; role: ProjectMemberRow['role'] }): ProjectMemberRow {
    const row: ProjectMemberRow = {
      project_id: input.project_id,
      user_id: input.user_id,
      role: input.role,
      joined_at: new Date(),
      last_active_at: null,
    };
    storage.members.set(`${row.project_id}|${row.user_id}`, row);
    return row;
  },
  listMembers(projectId: string): ProjectMemberRow[] {
    return Array.from(storage.members.values()).filter((m) => m.project_id === projectId);
  },
  findOne(projectId: string, userId: string): ProjectMemberRow | null {
    return storage.members.get(`${projectId}|${userId}`) ?? null;
  },
  updateRole(projectId: string, userId: string, role: ProjectMemberRow['role']): ProjectMemberRow | null {
    const k = `${projectId}|${userId}`;
    const cur = storage.members.get(k);
    if (!cur) return null;
    const next: ProjectMemberRow = { ...cur, role, last_active_at: new Date() };
    storage.members.set(k, next);
    return next;
  },
  remove(projectId: string, userId: string): boolean {
    return storage.members.delete(`${projectId}|${userId}`);
  },
};

// ===== ProjectVersionRepo =====
const VersionRepo = {
  snapshot(input: { project_id: string; version_no: number; snapshot: Record<string, unknown>; created_by: string; message?: string }): VersionRow {
    const row: VersionRow = {
      id: newId('ver'),
      project_id: input.project_id,
      version_no: input.version_no,
      snapshot: input.snapshot,
      message: input.message ?? null,
      created_by: input.created_by,
      created_at: new Date(),
    };
    storage.versions.set(row.id, row);
    return row;
  },
  listByProject(projectId: string): VersionRow[] {
    return Array.from(storage.versions.values())
      .filter((v) => v.project_id === projectId)
      .sort((a, b) => b.version_no - a.version_no);
  },
  getMaxVersionNo(projectId: string): number {
    let m = 0;
    for (const v of storage.versions.values()) {
      if (v.project_id === projectId && v.version_no > m) m = v.version_no;
    }
    return m;
  },
};

// ===== ShotRepo =====
const ShotRepo = {
  create(input: { project_id: string; shot_no?: number; title?: string | null }): ShotRow {
    const row: ShotRow = {
      id: newId('shot'),
      project_id: input.project_id,
      shot_no: input.shot_no ?? 0,
      title: input.title ?? null,
      status: 0,
      sort_index: 0,
    };
    storage.shots.set(row.id, row);
    return row;
  },
  listByProject(projectId: string): ShotRow[] {
    return Array.from(storage.shots.values())
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => a.sort_index - b.sort_index);
  },
};

// ===== TagRepo =====
const TagRepo = {
  addToProject(projectId: string, tag: string): TagRow {
    const row: TagRow = { project_id: projectId, tag, created_at: new Date() };
    storage.tags.set(`${projectId}|${tag}`, row);
    return row;
  },
  listByProject(projectId: string): TagRow[] {
    return Array.from(storage.tags.values()).filter((t) => t.project_id === projectId);
  },
};

// ============== 2. App 工厂 ==============

class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  res.status(500).json({ code: 'internal', message: String(err) });
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // POST /api/v1/projects
  app.post('/api/v1/projects', (req, res, next) => {
    try {
      const b = req.body ?? {};
      const userId = (req.headers['x-mhw-user-id'] as string) ?? null;
      if (!b.title || !userId) throw new AppError(400, 'bad_request', 'missing title or user');
      const row = ProjectRepo.create({ ...b, user_id: userId });
      // 自动 snapshot 版本
      VersionRepo.snapshot({
        project_id: row.id,
        version_no: 1,
        snapshot: { ...row },
        created_by: userId,
        message: 'initial',
      });
      res.status(201).json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/v1/projects
  app.get('/api/v1/projects', (_req, res) => {
    const rows = Array.from(storage.projects.values());
    res.json({ code: 0, data: { items: rows, count: rows.length } });
  });

  // GET /api/v1/projects/:id
  app.get('/api/v1/projects/:id', (req, res, next) => {
    try {
      const row = ProjectRepo.findById(req.params.id);
      if (!row) throw new AppError(404, 'not_found', 'project not found');
      res.json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  // PATCH /api/v1/projects/:id
  app.patch('/api/v1/projects/:id', (req, res, next) => {
    try {
      const row = ProjectRepo.update(req.params.id, req.body ?? {});
      if (!row) throw new AppError(404, 'not_found', 'project not found');
      // 每次更新都 snapshot
      const userId = (req.headers['x-mhw-user-id'] as string) ?? row.user_id;
      const maxNo = VersionRepo.getMaxVersionNo(row.id);
      VersionRepo.snapshot({
        project_id: row.id,
        version_no: maxNo + 1,
        snapshot: { ...row },
        created_by: userId,
        message: req.body?.message ?? 'update',
      });
      res.json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  // DELETE /api/v1/projects/:id
  app.delete('/api/v1/projects/:id', (req, res, next) => {
    try {
      const ok = ProjectRepo.delete(req.params.id);
      if (!ok) throw new AppError(404, 'not_found', 'project not found');
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // POST /api/v1/projects/:id/members
  app.post('/api/v1/projects/:id/members', (req, res, next) => {
    try {
      const b = req.body ?? {};
      if (!b.user_id || !b.role) throw new AppError(400, 'bad_request', 'missing user_id or role');
      if (!ProjectRepo.findById(req.params.id)) throw new AppError(404, 'not_found', 'project not found');
      if (MemberRepo.findOne(req.params.id, b.user_id)) {
        throw new AppError(409, 'conflict', 'member already exists');
      }
      const row = MemberRepo.add({
        project_id: req.params.id,
        user_id: b.user_id,
        role: b.role,
      });
      res.status(201).json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/v1/projects/:id/members
  app.get('/api/v1/projects/:id/members', (req, res) => {
    const rows = MemberRepo.listMembers(req.params.id);
    res.json({ code: 0, data: { items: rows, count: rows.length } });
  });

  // POST /api/v1/projects/:id/shots
  app.post('/api/v1/projects/:id/shots', (req, res, next) => {
    try {
      if (!ProjectRepo.findById(req.params.id)) throw new AppError(404, 'not_found', 'project not found');
      const row = ShotRepo.create({ ...(req.body ?? {}), project_id: req.params.id });
      res.status(201).json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/v1/projects/:id/shots
  app.get('/api/v1/projects/:id/shots', (req, res) => {
    const rows = ShotRepo.listByProject(req.params.id);
    res.json({ code: 0, data: { items: rows, count: rows.length } });
  });

  // GET /api/v1/projects/:id/versions
  app.get('/api/v1/projects/:id/versions', (req, res) => {
    const rows = VersionRepo.listByProject(req.params.id);
    res.json({ code: 0, data: { items: rows, count: rows.length } });
  });

  // POST /api/v1/projects/:id/tags
  app.post('/api/v1/projects/:id/tags', (req, res, next) => {
    try {
      if (!ProjectRepo.findById(req.params.id)) throw new AppError(404, 'not_found', 'project not found');
      const tag = (req.body ?? {}).tag;
      if (!tag) throw new AppError(400, 'bad_request', 'missing tag');
      const row = TagRepo.addToProject(req.params.id, tag);
      res.status(201).json({ code: 0, data: row });
    } catch (e) {
      next(e);
    }
  });

  app.use(errorMiddleware);
  return app;
}

// ============== 3. E2E 长流程 ==============

describe('E2E: 完整项目生命周期', () => {
  let app: Express;

  beforeEach(() => {
    clearStorage();
    app = buildApp();
    void t0; // keep linter happy
  });

  it('创建 → 邀请成员 → 添加分镜 → 修改 → 版本快照 → 标签 → 删除 完整跑通', async () => {
    // ===== 1. 创建项目 =====
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('x-mhw-user-id', 'user-alice')
      .send({ title: '我的漫画', description: '校园恋爱', art_style: 'shounen' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.code).toBe(0);
    const projectId = createRes.body.data.id;
    expect(projectId).toMatch(/^proj-/);
    expect(createRes.body.data.title).toBe('我的漫画');
    expect(createRes.body.data.user_id).toBe('user-alice');
    expect(createRes.body.data.status).toBe(0);

    // 验证：自动 snapshot 了 v1
    const v1Res = await request(app).get(`/api/v1/projects/${projectId}/versions`);
    expect(v1Res.body.data.count).toBe(1);
    expect(v1Res.body.data.items[0].version_no).toBe(1);
    expect(v1Res.body.data.items[0].message).toBe('initial');

    // ===== 2. 邀请成员 bob (editor) =====
    const member1 = await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ user_id: 'user-bob', role: 'editor' });
    expect(member1.status).toBe(201);
    expect(member1.body.data.role).toBe('editor');

    // 邀请成员 carol (commenter)
    const member2 = await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ user_id: 'user-carol', role: 'commenter' });
    expect(member2.status).toBe(201);

    // 重复邀请 bob → 409
    const dupRes = await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ user_id: 'user-bob', role: 'viewer' });
    expect(dupRes.status).toBe(409);

    // 列出成员
    const listRes = await request(app).get(`/api/v1/projects/${projectId}/members`);
    expect(listRes.body.data.count).toBe(2);

    // ===== 3. 添加 3 个分镜 =====
    const shot1 = await request(app)
      .post(`/api/v1/projects/${projectId}/shots`)
      .send({ shot_no: 1, title: '开场' });
    expect(shot1.status).toBe(201);
    expect(shot1.body.data.shot_no).toBe(1);

    const shot2 = await request(app)
      .post(`/api/v1/projects/${projectId}/shots`)
      .send({ shot_no: 2, title: '相遇' });
    expect(shot2.status).toBe(201);

    const shot3 = await request(app)
      .post(`/api/v1/projects/${projectId}/shots`)
      .send({ shot_no: 3, title: '冲突' });
    expect(shot3.status).toBe(201);

    // 列出分镜
    const shotsRes = await request(app).get(`/api/v1/projects/${projectId}/shots`);
    expect(shotsRes.body.data.count).toBe(3);
    expect(shotsRes.body.data.items.map((s: { title: string }) => s.title)).toEqual([
      '开场',
      '相遇',
      '冲突',
    ]);

    // ===== 4. 修改项目（status 改为 1 in_progress，title 改） =====
    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('x-mhw-user-id', 'user-alice')
      .send({ title: '我的漫画 (修订)', status: 1, message: '开拍中' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe('我的漫画 (修订)');
    expect(patchRes.body.data.status).toBe(1);

    // 验证：版本已累加到 v2
    const v2Res = await request(app).get(`/api/v1/projects/${projectId}/versions`);
    expect(v2Res.body.data.count).toBe(2);
    expect(v2Res.body.data.items[0].version_no).toBe(2);
    expect(v2Res.body.data.items[0].message).toBe('开拍中');

    // 再改一次 → v3
    await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .send({ description: '更新描述' });
    const v3Res = await request(app).get(`/api/v1/projects/${projectId}/versions`);
    expect(v3Res.body.data.count).toBe(3);

    // ===== 5. 加标签 =====
    const tagRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tags`)
      .send({ tag: 'school' });
    expect(tagRes.status).toBe(201);
    const tagRes2 = await request(app)
      .post(`/api/v1/projects/${projectId}/tags`)
      .send({ tag: 'romance' });
    expect(tagRes2.status).toBe(201);

    // ===== 6. GET project 应反映所有修改 =====
    const finalRes = await request(app).get(`/api/v1/projects/${projectId}`);
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.title).toBe('我的漫画 (修订)');
    expect(finalRes.body.data.status).toBe(1);
    expect(finalRes.body.data.description).toBe('更新描述');
    expect(finalRes.body.data.art_style).toBe('shounen');

    // ===== 7. 删除项目 =====
    const delRes = await request(app).delete(`/api/v1/projects/${projectId}`);
    expect(delRes.status).toBe(204);

    // 再 GET → 404
    const afterRes = await request(app).get(`/api/v1/projects/${projectId}`);
    expect(afterRes.status).toBe(404);

    // 成员列表应清空
    const afterMembers = await request(app).get(`/api/v1/projects/${projectId}/members`);
    expect(afterMembers.body.data.count).toBe(0);
  });
});
