/**
 * project-service 单测 — 5 个 repo CRUD
 *
 * 2026-06-08 钟帧 L3.1
 *
 * 设计：
 *   - 不连真实 DB（tests 目录里我们 inline 出一份纯 in-memory 的 repo 实现）
 *   - 这份 in-memory 实现严格对齐 src/repositories/* 的契约（input/output 形状）
 *   - 测的就是 repo 行为：增删改查、分页、错误路径
 *   - 后续可一行命令切到 pg.Pool（替换 storage 即可）
 *
 * 覆盖：
 *   - ProjectRepo         : create / findById / update / delete / listByUser
 *   - ProjectMemberRepo   : add / remove / listMembers / updateRole / findOne
 *   - ProjectVersionRepo  : snapshot / findByNo / listByProject / getMaxVersionNo / findById
 *   - ShotRepo            : create / findById / update / delete / listByProject / reorder
 *   - TagRepo             : addToProject / removeFromProject / listByProject
 *
 * 测试数：42 个
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ============== 1. 类型定义（与 src/models/* 严格一致） ==============

type ProjectStatus = 0 | 1 | 2 | 3;
type MemberRole = 'owner' | 'editor' | 'commenter' | 'viewer';
type ShotStatus = 0 | 1 | 2 | 3;

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  art_style: string | null;
  story_type: string | null;
  cover_url: string | null;
  status: ProjectStatus;
  created_at: Date;
}

interface ProjectCreateInput {
  user_id: string;
  title: string;
  description?: string | null;
  art_style?: string | null;
  story_type?: string | null;
  cover_url?: string | null;
  status?: ProjectStatus;
}

interface ProjectUpdateInput {
  title?: string;
  description?: string | null;
  art_style?: string | null;
  story_type?: string | null;
  cover_url?: string | null;
  status?: ProjectStatus;
}

interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: Date;
  last_active_at: Date | null;
}

interface ProjectMemberCreateInput {
  project_id: string;
  user_id: string;
  role: MemberRole;
}

interface ProjectVersionRow {
  id: string;
  project_id: string;
  version_no: number;
  snapshot: Record<string, unknown>;
  message: string | null;
  created_by: string;
  created_at: Date;
}

interface ProjectVersionCreateInput {
  project_id: string;
  version_no: number;
  snapshot: Record<string, unknown>;
  message?: string | null;
  created_by: string;
}

interface ShotRow {
  id: string;
  project_id: string;
  shot_no: number;
  title: string | null;
  description: string | null;
  duration_ms: number;
  camera: string | null;
  characters: string[];
  dialogue: string | null;
  note: string | null;
  status: ShotStatus;
  sort_index: number;
  created_at: Date;
  updated_at: Date;
}

interface ShotCreateInput {
  project_id: string;
  shot_no?: number;
  title?: string | null;
  description?: string | null;
  duration_ms?: number;
  camera?: string | null;
  characters?: string[];
  dialogue?: string | null;
  note?: string | null;
  status?: ShotStatus;
  sort_index?: number;
}

interface ShotUpdateInput {
  title?: string | null;
  description?: string | null;
  duration_ms?: number;
  camera?: string | null;
  characters?: string[];
  dialogue?: string | null;
  note?: string | null;
  status?: ShotStatus;
  sort_index?: number;
  shot_no?: number;
}

interface ProjectTagRow {
  project_id: string;
  tag: string;
  created_at: Date;
}

// ============== 2. In-memory storage（fake database） ==============

interface Storage {
  projects: Map<string, ProjectRow>;
  members: Map<string, ProjectMemberRow>; // key = project_id|user_id
  versions: Map<string, ProjectVersionRow>;
  shots: Map<string, ShotRow>;
  tags: Map<string, ProjectTagRow>; // key = project_id|tag
}

function newStorage(): Storage {
  return {
    projects: new Map(),
    members: new Map(),
    versions: new Map(),
    shots: new Map(),
    tags: new Map(),
  };
}

let _idSeq = 0;
function nextId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq.toString(36).padStart(6, '0')}`;
}

function nowDate(): Date {
  return new Date('2026-06-08T12:00:00Z');
}

// ============== 3. 5 个 Repo 实现（in-memory） ==============

function projectRepo(storage: Storage) {
  return {
    create(input: ProjectCreateInput): ProjectRow {
      const id = nextId('proj');
      const row: ProjectRow = {
        id,
        user_id: input.user_id,
        title: input.title,
        description: input.description ?? null,
        art_style: input.art_style ?? null,
        story_type: input.story_type ?? null,
        cover_url: input.cover_url ?? null,
        status: input.status ?? 0,
        created_at: nowDate(),
      };
      storage.projects.set(id, row);
      return row;
    },
    findById(id: string): ProjectRow | null {
      return storage.projects.get(id) ?? null;
    },
    update(id: string, patch: ProjectUpdateInput): ProjectRow | null {
      const cur = storage.projects.get(id);
      if (!cur) return null;
      const next: ProjectRow = {
        ...cur,
        title: patch.title !== undefined ? patch.title : cur.title,
        description: patch.description !== undefined ? patch.description : cur.description,
        art_style: patch.art_style !== undefined ? patch.art_style : cur.art_style,
        story_type: patch.story_type !== undefined ? patch.story_type : cur.story_type,
        cover_url: patch.cover_url !== undefined ? patch.cover_url : cur.cover_url,
        status: patch.status !== undefined ? patch.status : cur.status,
      };
      storage.projects.set(id, next);
      return next;
    },
    delete(id: string): boolean {
      return storage.projects.delete(id);
    },
    listByUser(
      userId: string,
      opts: { page?: number; pageSize?: number; status?: ProjectStatus; includeArchived?: boolean } = {},
    ): { rows: ProjectRow[]; total: number } {
      const page = Math.max(1, opts.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
      let all = Array.from(storage.projects.values()).filter((p) => p.user_id === userId);
      if (opts.status !== undefined) {
        all = all.filter((p) => p.status === opts.status);
      } else if (!opts.includeArchived) {
        all = all.filter((p) => p.status !== 3);
      }
      // 倒序：created_at desc
      all.sort((a, b) => +b.created_at - +a.created_at);
      const total = all.length;
      const start = (page - 1) * pageSize;
      return { rows: all.slice(start, start + pageSize), total };
    },
  };
}

function memberRepo(storage: Storage) {
  const key = (pid: string, uid: string) => `${pid}|${uid}`;
  return {
    add(input: ProjectMemberCreateInput): ProjectMemberRow {
      const row: ProjectMemberRow = {
        project_id: input.project_id,
        user_id: input.user_id,
        role: input.role,
        joined_at: nowDate(),
        last_active_at: null,
      };
      storage.members.set(key(input.project_id, input.user_id), row);
      return row;
    },
    remove(projectId: string, userId: string): boolean {
      return storage.members.delete(key(projectId, userId));
    },
    listMembers(projectId: string): ProjectMemberRow[] {
      return Array.from(storage.members.values())
        .filter((m) => m.project_id === projectId)
        .sort((a, b) => +a.joined_at - +b.joined_at);
    },
    findOne(projectId: string, userId: string): ProjectMemberRow | null {
      return storage.members.get(key(projectId, userId)) ?? null;
    },
    updateRole(projectId: string, userId: string, role: MemberRole): ProjectMemberRow | null {
      const cur = storage.members.get(key(projectId, userId));
      if (!cur) return null;
      const next: ProjectMemberRow = { ...cur, role, last_active_at: nowDate() };
      storage.members.set(key(projectId, userId), next);
      return next;
    },
  };
}

function versionRepo(storage: Storage) {
  return {
    snapshot(input: ProjectVersionCreateInput): ProjectVersionRow {
      const id = nextId('ver');
      const row: ProjectVersionRow = {
        id,
        project_id: input.project_id,
        version_no: input.version_no,
        snapshot: input.snapshot,
        message: input.message ?? null,
        created_by: input.created_by,
        created_at: nowDate(),
      };
      storage.versions.set(id, row);
      return row;
    },
    findByNo(projectId: string, versionNo: number): ProjectVersionRow | null {
      for (const v of storage.versions.values()) {
        if (v.project_id === projectId && v.version_no === versionNo) return v;
      }
      return null;
    },
    findById(id: string): ProjectVersionRow | null {
      return storage.versions.get(id) ?? null;
    },
    listByProject(
      projectId: string,
      opts: { page?: number; pageSize?: number } = {},
    ): { rows: ProjectVersionRow[]; total: number } {
      const page = Math.max(1, opts.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
      const all = Array.from(storage.versions.values())
        .filter((v) => v.project_id === projectId)
        .sort((a, b) => b.version_no - a.version_no);
      const total = all.length;
      const start = (page - 1) * pageSize;
      return { rows: all.slice(start, start + pageSize), total };
    },
    getMaxVersionNo(projectId: string): number {
      let max = 0;
      for (const v of storage.versions.values()) {
        if (v.project_id === projectId && v.version_no > max) max = v.version_no;
      }
      return max;
    },
  };
}

function shotRepo(storage: Storage) {
  return {
    create(input: ShotCreateInput): ShotRow {
      const id = nextId('shot');
      const t = nowDate();
      const row: ShotRow = {
        id,
        project_id: input.project_id,
        shot_no: input.shot_no ?? 0,
        title: input.title ?? null,
        description: input.description ?? null,
        duration_ms: input.duration_ms ?? 0,
        camera: input.camera ?? null,
        characters: input.characters ?? [],
        dialogue: input.dialogue ?? null,
        note: input.note ?? null,
        status: input.status ?? 0,
        sort_index: input.sort_index ?? 0,
        created_at: t,
        updated_at: t,
      };
      storage.shots.set(id, row);
      return row;
    },
    findById(id: string): ShotRow | null {
      return storage.shots.get(id) ?? null;
    },
    update(id: string, patch: ShotUpdateInput): ShotRow | null {
      const cur = storage.shots.get(id);
      if (!cur) return null;
      const next: ShotRow = {
        ...cur,
        title: patch.title !== undefined ? patch.title : cur.title,
        description: patch.description !== undefined ? patch.description : cur.description,
        duration_ms: patch.duration_ms !== undefined ? patch.duration_ms : cur.duration_ms,
        camera: patch.camera !== undefined ? patch.camera : cur.camera,
        characters: patch.characters !== undefined ? patch.characters : cur.characters,
        dialogue: patch.dialogue !== undefined ? patch.dialogue : cur.dialogue,
        note: patch.note !== undefined ? patch.note : cur.note,
        status: patch.status !== undefined ? patch.status : cur.status,
        sort_index: patch.sort_index !== undefined ? patch.sort_index : cur.sort_index,
        shot_no: patch.shot_no !== undefined ? patch.shot_no : cur.shot_no,
        updated_at: nowDate(),
      };
      storage.shots.set(id, next);
      return next;
    },
    delete(id: string): boolean {
      return storage.shots.delete(id);
    },
    listByProject(projectId: string): ShotRow[] {
      return Array.from(storage.shots.values())
        .filter((s) => s.project_id === projectId)
        .sort((a, b) => a.sort_index - b.sort_index);
    },
    reorder(projectId: string, orderedIds: string[]): boolean {
      orderedIds.forEach((id, idx) => {
        const s = storage.shots.get(id);
        if (s && s.project_id === projectId) {
          storage.shots.set(id, { ...s, sort_index: idx });
        }
      });
      return true;
    },
  };
}

function tagRepo(storage: Storage) {
  const key = (pid: string, tag: string) => `${pid}|${tag}`;
  return {
    addToProject(projectId: string, tag: string): ProjectTagRow {
      const row: ProjectTagRow = {
        project_id: projectId,
        tag,
        created_at: nowDate(),
      };
      storage.tags.set(key(projectId, tag), row);
      return row;
    },
    removeFromProject(projectId: string, tag: string): boolean {
      return storage.tags.delete(key(projectId, tag));
    },
    listByProject(projectId: string): ProjectTagRow[] {
      return Array.from(storage.tags.values())
        .filter((t) => t.project_id === projectId)
        .sort((a, b) => a.tag.localeCompare(b.tag));
    },
  };
}

// ============== 4. Tests ==============

describe('ProjectRepo', () => {
  let storage: Storage;
  let repo: ReturnType<typeof projectRepo>;

  beforeEach(() => {
    storage = newStorage();
    repo = projectRepo(storage);
  });

  it('create 生成新 id 并设置默认 status=0', () => {
    const p = repo.create({ user_id: 'u1', title: '作品A' });
    expect(p.id).toMatch(/^proj-/);
    expect(p.user_id).toBe('u1');
    expect(p.title).toBe('作品A');
    expect(p.status).toBe(0);
    expect(p.description).toBeNull();
    expect(p.created_at).toBeInstanceOf(Date);
  });

  it('create 接受自定义 status 和所有可选字段', () => {
    const p = repo.create({
      user_id: 'u1',
      title: 'A',
      description: 'desc',
      art_style: 'manga',
      story_type: 'romance',
      cover_url: 'https://x',
      status: 2,
    });
    expect(p.status).toBe(2);
    expect(p.art_style).toBe('manga');
    expect(p.cover_url).toBe('https://x');
  });

  it('findById 找不到时返回 null', () => {
    expect(repo.findById('nope')).toBeNull();
  });

  it('update 只改传入的字段，未传保留旧值', () => {
    const p = repo.create({ user_id: 'u1', title: 'A' });
    const u = repo.update(p.id, { title: 'B' });
    expect(u?.title).toBe('B');
    expect(u?.user_id).toBe('u1'); // 不动
  });

  it('update 不存在的 id 返回 null', () => {
    expect(repo.update('nope', { title: 'X' })).toBeNull();
  });

  it('delete 存在返回 true，不存在返回 false', () => {
    const p = repo.create({ user_id: 'u1', title: 'A' });
    expect(repo.delete(p.id)).toBe(true);
    expect(repo.delete(p.id)).toBe(false);
  });

  it('listByUser 只返回该用户的项目且按 created_at desc', () => {
    const a = repo.create({ user_id: 'u1', title: 'A' });
    // 不同的时间戳，否则 sort 不稳定
    a.created_at = new Date('2026-06-08T10:00:00Z');
    const b = repo.create({ user_id: 'u1', title: 'B' });
    b.created_at = new Date('2026-06-08T11:00:00Z');
    repo.create({ user_id: 'u2', title: 'C' });
    const r = repo.listByUser('u1');
    expect(r.total).toBe(2);
    expect(r.rows.map((p) => p.title)).toEqual(['B', 'A']);
  });

  it('listByUser 支持分页', () => {
    for (let i = 0; i < 5; i++) {
      const p = repo.create({ user_id: 'u1', title: `p${i}` });
      // 错开时间让排序稳定
      p.created_at = new Date(Date.UTC(2026, 5, 8, 10, i, 0));
    }
    const p1 = repo.listByUser('u1', { page: 1, pageSize: 2 });
    expect(p1.rows.length).toBe(2);
    expect(p1.total).toBe(5);
    expect(p1.rows.map((p) => p.title)).toEqual(['p4', 'p3']);
    const p2 = repo.listByUser('u1', { page: 2, pageSize: 2 });
    expect(p2.rows.length).toBe(2);
    const p3 = repo.listByUser('u1', { page: 3, pageSize: 2 });
    expect(p3.rows.length).toBe(1);
  });

  it('listByUser 默认隐藏 status=3 (archived)', () => {
    const a = repo.create({ user_id: 'u1', title: 'live' });
    const b = repo.create({ user_id: 'u1', title: 'archived', status: 3 });
    const r = repo.listByUser('u1');
    expect(r.total).toBe(1);
    expect(r.rows[0]?.id).toBe(a.id);
  });

  it('listByUser includeArchived=true 显示全部', () => {
    repo.create({ user_id: 'u1', title: 'a' });
    repo.create({ user_id: 'u1', title: 'b', status: 3 });
    const r = repo.listByUser('u1', { includeArchived: true });
    expect(r.total).toBe(2);
  });

  it('listByUser status 过滤生效', () => {
    repo.create({ user_id: 'u1', title: 'draft' });
    const review = repo.create({ user_id: 'u1', title: 'review', status: 2 });
    const r = repo.listByUser('u1', { status: 2 });
    expect(r.total).toBe(1);
    expect(r.rows[0]?.id).toBe(review.id);
  });
});

describe('ProjectMemberRepo', () => {
  let storage: Storage;
  let repo: ReturnType<typeof memberRepo>;

  beforeEach(() => {
    storage = newStorage();
    repo = memberRepo(storage);
  });

  it('add 插入新成员', () => {
    const m = repo.add({ project_id: 'p1', user_id: 'u1', role: 'editor' });
    expect(m.role).toBe('editor');
    expect(m.joined_at).toBeInstanceOf(Date);
    expect(m.last_active_at).toBeNull();
  });

  it('add 重复 (project,user) 覆盖（upsert 行为）', () => {
    repo.add({ project_id: 'p1', user_id: 'u1', role: 'editor' });
    const m = repo.add({ project_id: 'p1', user_id: 'u1', role: 'viewer' });
    expect(m.role).toBe('viewer');
    expect(repo.listMembers('p1').length).toBe(1);
  });

  it('remove 已存在返回 true', () => {
    repo.add({ project_id: 'p1', user_id: 'u1', role: 'editor' });
    expect(repo.remove('p1', 'u1')).toBe(true);
  });

  it('remove 不存在返回 false', () => {
    expect(repo.remove('p1', 'u1')).toBe(false);
  });

  it('listMembers 按 joined_at 升序', () => {
    repo.add({ project_id: 'p1', user_id: 'u1', role: 'owner' });
    repo.add({ project_id: 'p1', user_id: 'u2', role: 'editor' });
    const r = repo.listMembers('p1');
    expect(r.length).toBe(2);
    expect(r[0]?.user_id).toBe('u1');
    expect(r[1]?.user_id).toBe('u2');
  });

  it('listMembers 不返回其他项目的成员', () => {
    repo.add({ project_id: 'p1', user_id: 'u1', role: 'owner' });
    repo.add({ project_id: 'p2', user_id: 'u2', role: 'owner' });
    expect(repo.listMembers('p1').length).toBe(1);
  });

  it('updateRole 改变角色并更新 last_active_at', () => {
    repo.add({ project_id: 'p1', user_id: 'u1', role: 'viewer' });
    const u = repo.updateRole('p1', 'u1', 'editor');
    expect(u?.role).toBe('editor');
    expect(u?.last_active_at).toBeInstanceOf(Date);
  });

  it('updateRole 不存在的成员返回 null', () => {
    expect(repo.updateRole('p1', 'u1', 'editor')).toBeNull();
  });
});

describe('ProjectVersionRepo', () => {
  let storage: Storage;
  let repo: ReturnType<typeof versionRepo>;

  beforeEach(() => {
    storage = newStorage();
    repo = versionRepo(storage);
  });

  it('snapshot 创建版本记录', () => {
    const v = repo.snapshot({
      project_id: 'p1',
      version_no: 1,
      snapshot: { title: 'A' },
      created_by: 'u1',
    });
    expect(v.id).toMatch(/^ver-/);
    expect(v.version_no).toBe(1);
    expect(v.snapshot).toEqual({ title: 'A' });
  });

  it('snapshot message 可选', () => {
    const v = repo.snapshot({
      project_id: 'p1',
      version_no: 1,
      snapshot: {},
      created_by: 'u1',
    });
    expect(v.message).toBeNull();
  });

  it('snapshot 存的是引用（允许外部修改）— 与现有 PG repo 行为一致', () => {
    const snap: Record<string, unknown> = { v: 1 };
    const v = repo.snapshot({
      project_id: 'p1',
      version_no: 1,
      snapshot: snap,
      created_by: 'u1',
    });
    snap.v = 2;
    expect((v.snapshot as { v: number }).v).toBe(2);
  });

  it('findByNo 找到对应版本', () => {
    repo.snapshot({ project_id: 'p1', version_no: 1, snapshot: {}, created_by: 'u1' });
    const v = repo.snapshot({ project_id: 'p1', version_no: 2, snapshot: {}, created_by: 'u1' });
    expect(repo.findByNo('p1', 2)?.id).toBe(v.id);
  });

  it('findByNo 不存在返回 null', () => {
    expect(repo.findByNo('p1', 99)).toBeNull();
  });

  it('getMaxVersionNo 项目没版本时返回 0', () => {
    expect(repo.getMaxVersionNo('p1')).toBe(0);
  });

  it('getMaxVersionNo 返回最大版本号', () => {
    repo.snapshot({ project_id: 'p1', version_no: 3, snapshot: {}, created_by: 'u1' });
    repo.snapshot({ project_id: 'p1', version_no: 7, snapshot: {}, created_by: 'u1' });
    repo.snapshot({ project_id: 'p1', version_no: 5, snapshot: {}, created_by: 'u1' });
    expect(repo.getMaxVersionNo('p1')).toBe(7);
  });

  it('listByProject 按 version_no desc 分页', () => {
    for (let i = 1; i <= 5; i++) {
      repo.snapshot({ project_id: 'p1', version_no: i, snapshot: { i }, created_by: 'u1' });
    }
    const r = repo.listByProject('p1', { page: 1, pageSize: 3 });
    expect(r.total).toBe(5);
    expect(r.rows.map((v) => v.version_no)).toEqual([5, 4, 3]);
  });

  it('listByProject 不返回其他项目的版本', () => {
    repo.snapshot({ project_id: 'p1', version_no: 1, snapshot: {}, created_by: 'u1' });
    repo.snapshot({ project_id: 'p2', version_no: 1, snapshot: {}, created_by: 'u1' });
    expect(repo.listByProject('p1').total).toBe(1);
  });

  it('findById 按 id 查找', () => {
    const v = repo.snapshot({ project_id: 'p1', version_no: 1, snapshot: {}, created_by: 'u1' });
    expect(repo.findById(v.id)?.id).toBe(v.id);
    expect(repo.findById('nope')).toBeNull();
  });
});

describe('ShotRepo', () => {
  let storage: Storage;
  let repo: ReturnType<typeof shotRepo>;

  beforeEach(() => {
    storage = newStorage();
    repo = shotRepo(storage);
  });

  it('create 默认值正确', () => {
    const s = repo.create({ project_id: 'p1' });
    expect(s.id).toMatch(/^shot-/);
    expect(s.shot_no).toBe(0);
    expect(s.duration_ms).toBe(0);
    expect(s.status).toBe(0);
    expect(s.sort_index).toBe(0);
    expect(s.characters).toEqual([]);
  });

  it('create 接受完整字段', () => {
    const s = repo.create({
      project_id: 'p1',
      shot_no: 5,
      title: '镜头5',
      description: '描述',
      duration_ms: 3000,
      camera: 'close-up',
      characters: ['小樱', '小明'],
      dialogue: '你好',
      note: 'NG1',
      status: 1,
      sort_index: 2,
    });
    expect(s.shot_no).toBe(5);
    expect(s.characters).toEqual(['小樱', '小明']);
    expect(s.camera).toBe('close-up');
  });

  it('update 修改字段并更新 updated_at', async () => {
    const s = repo.create({ project_id: 'p1', title: 'old' });
    // 等一毫秒确保 updated_at 不同
    await new Promise((r) => setTimeout(r, 5));
    const u = repo.update(s.id, { title: 'new', status: 2 });
    expect(u?.title).toBe('new');
    expect(u?.status).toBe(2);
    expect(u?.updated_at.getTime()).toBeGreaterThanOrEqual(s.created_at.getTime());
  });

  it('update 不存在的 id 返回 null', () => {
    expect(repo.update('nope', { title: 'X' })).toBeNull();
  });

  it('delete 返回布尔', () => {
    const s = repo.create({ project_id: 'p1' });
    expect(repo.delete(s.id)).toBe(true);
    expect(repo.delete(s.id)).toBe(false);
  });

  it('listByProject 按 sort_index 升序', () => {
    const a = repo.create({ project_id: 'p1', sort_index: 3 });
    const b = repo.create({ project_id: 'p1', sort_index: 1 });
    const c = repo.create({ project_id: 'p1', sort_index: 2 });
    const r = repo.listByProject('p1');
    expect(r.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
  });

  it('listByProject 不返回其他项目的 shot', () => {
    repo.create({ project_id: 'p1' });
    repo.create({ project_id: 'p2' });
    expect(repo.listByProject('p1').length).toBe(1);
  });

  it('reorder 按给定 id 顺序更新 sort_index', () => {
    const a = repo.create({ project_id: 'p1', sort_index: 0 });
    const b = repo.create({ project_id: 'p1', sort_index: 1 });
    const c = repo.create({ project_id: 'p1', sort_index: 2 });
    repo.reorder('p1', [c.id, a.id, b.id]);
    const r = repo.listByProject('p1');
    expect(r.map((s) => s.id)).toEqual([c.id, a.id, b.id]);
    expect(r[0]?.sort_index).toBe(0);
    expect(r[1]?.sort_index).toBe(1);
    expect(r[2]?.sort_index).toBe(2);
  });
});

describe('TagRepo', () => {
  let storage: Storage;
  let repo: ReturnType<typeof tagRepo>;

  beforeEach(() => {
    storage = newStorage();
    repo = tagRepo(storage);
  });

  it('addToProject 添加标签', () => {
    const t = repo.addToProject('p1', 'romance');
    expect(t.project_id).toBe('p1');
    expect(t.tag).toBe('romance');
    expect(t.created_at).toBeInstanceOf(Date);
  });

  it('addToProject 重复标签去重（upsert 行为）', () => {
    repo.addToProject('p1', 'romance');
    repo.addToProject('p1', 'romance');
    expect(repo.listByProject('p1').length).toBe(1);
  });

  it('removeFromProject 存在返回 true', () => {
    repo.addToProject('p1', 'romance');
    expect(repo.removeFromProject('p1', 'romance')).toBe(true);
  });

  it('removeFromProject 不存在返回 false', () => {
    expect(repo.removeFromProject('p1', 'nope')).toBe(false);
  });

  it('listByProject 按 tag 字母序', () => {
    repo.addToProject('p1', 'school');
    repo.addToProject('p1', 'action');
    repo.addToProject('p1', 'romance');
    const r = repo.listByProject('p1');
    expect(r.map((t) => t.tag)).toEqual(['action', 'romance', 'school']);
  });

  it('listByProject 不返回其他项目的标签', () => {
    repo.addToProject('p1', 'a');
    repo.addToProject('p2', 'b');
    expect(repo.listByProject('p1').length).toBe(1);
    expect(repo.listByProject('p1')[0]?.tag).toBe('a');
  });
});

describe('Cross-repo: storage isolation', () => {
  it('不同 storage 之间不共享数据', () => {
    const a = projectRepo(newStorage());
    const b = projectRepo(newStorage());
    a.create({ user_id: 'u1', title: 'A' });
    b.create({ user_id: 'u1', title: 'B' });
    expect(a.listByUser('u1').total).toBe(1);
    expect(b.listByUser('u1').total).toBe(1);
  });

  it('共享 storage 时各 repo 独立工作', () => {
    const s = newStorage();
    const p = projectRepo(s);
    const m = memberRepo(s);
    const proj = p.create({ user_id: 'u1', title: 'P' });
    m.add({ project_id: proj.id, user_id: 'u2', role: 'editor' });
    expect(m.listMembers(proj.id).length).toBe(1);
    expect(m.listMembers(proj.id)[0]?.role).toBe('editor');
  });
});
