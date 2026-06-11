/**
 * ManhuaWorks asset-service 数据库 Schema
 *
 * 扩展 user-service 的 7 表，新增 3 表（核心业务表 + 协作）：
 *  8. projects_ext       - 项目空间扩展（user-service 的 projects 是简版，这里补全字段）
 *  9. assets             - 资产（图片/视频/音频/角色/场景/分镜/视频）
 *  10. asset_versions    - 资产版本快照
 *  11. project_members   - 协作成员
 *  12. asset_locks       - 锁脸档案（4 角度头像 + 一致性参考）
 *
 * 说明：user-service 的 projects 表已存在（4 表 CRUD），本服务以 projects_ext 1:1
 *       扩展业务字段（剧情简介、协作设置、默认风格/类型等）。
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  bigint,
  bigserial,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* ------------------------------------------------------------------ */
/*  8. projects_ext — 项目空间扩展                                      */
/* ------------------------------------------------------------------ */
export const projectsExt = pgTable(
  'projects_ext',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    /** 关联 user-service 的 projects.id（外部 uuid） */
    projectId: uuid('project_id').notNull().unique(),
    ownerId: uuid('owner_id').notNull(),
    /** 默认故事类型（来自 STORY_TYPES） */
    storyType: varchar('story_type', { length: 50 }),
    /** 默认艺术风格（来自 ART_STYLES） */
    artStyle: varchar('art_style', { length: 50 }),
    /** 视觉锚点（人设/世界观/色板 JSON） */
    visualAnchors: jsonb('visual_anchors').$type<Record<string, unknown>>().default({}),
    /** 协作设置：是否开放编辑 / 是否需要审批 */
    collabPolicy: jsonb('collab_policy').$type<Record<string, unknown>>().default({}),
    /** 当前锁定的版本号；0 表示未锁 */
    lockedAtVersion: integer('locked_at_version').notNull().default(0),
    lockedBy: uuid('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    /** 季/集信息 */
    seasonNo: integer('season_no').notNull().default(1),
    episodeCount: integer('episode_count').notNull().default(0),
    /** 元信息 */
    tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index('idx_projects_ext_owner').on(t.ownerId),
    storyIdx: index('idx_projects_ext_story_type').on(t.storyType),
    artIdx: index('idx_projects_ext_art_style').on(t.artStyle),
  })
);

/* ------------------------------------------------------------------ */
/*  9. assets — 资产主表                                                */
/* ------------------------------------------------------------------ */
export const assetKindEnum = ['image', 'video', 'audio', 'character', 'scene', 'shot', 'episode'] as const;
export type AssetKind = (typeof assetKindEnum)[number];

export const assets = pgTable(
  'assets',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    ownerId: uuid('owner_id').notNull(),
    /** 归属项目；NULL 表示用户级私人资产 */
    projectId: uuid('project_id'),
    /** 资产类型 */
    kind: varchar('kind', { length: 20 }).notNull().$type<AssetKind>(),
    /** 资产名（用户命名） */
    name: varchar('name', { length: 200 }).notNull(),
    /** 描述 */
    description: text('description'),
    /** 文件 URL / 对象存储 key */
    fileUrl: text('file_url'),
    /** 缩略图 URL */
    thumbUrl: text('thumb_url'),
    /** 资源大小（字节） */
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    /** MIME */
    mimeType: varchar('mime_type', { length: 80 }),
    /** 时长（秒，仅视频/音频） */
    durationSec: integer('duration_sec'),
    /** 宽 × 高 */
    width: integer('width'),
    height: integer('height'),
    /** 关联角色（仅 character 资产） */
    characterId: uuid('character_id'),
    /** 货架级别：user / project / global */
    shelfLevel: varchar('shelf_level', { length: 20 }).notNull().default('user').$type<'user' | 'project' | 'global'>(),
    /** 标签 */
    tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),
    /** 资产元信息（生成参数、prompt、模型等） */
    meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
    /** 当前版本号 */
    currentVersion: integer('current_version').notNull().default(1),
    /** 是否公开 */
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index('idx_assets_owner').on(t.ownerId),
    projectIdx: index('idx_assets_project').on(t.projectId),
    kindIdx: index('idx_assets_kind').on(t.kind),
    shelfIdx: index('idx_assets_shelf_level').on(t.shelfLevel),
    characterIdx: index('idx_assets_character').on(t.characterId),
    nameIdx: index('idx_assets_name').on(t.name),
    createdIdx: index('idx_assets_created').on(t.createdAt),
  })
);

/* ------------------------------------------------------------------ */
/*  10. asset_versions — 资产版本快照                                    */
/* ------------------------------------------------------------------ */
export const assetVersions = pgTable(
  'asset_versions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    /** 该版本对应的文件 URL（快照当时） */
    fileUrl: text('file_url'),
    thumbUrl: text('thumb_url'),
    /** 快照元信息 */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default({}),
    /** 改动说明 */
    changeNote: text('change_note'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assetVersionUq: uniqueIndex('idx_asset_versions_asset_vno').on(t.assetId, t.versionNo),
    assetIdx: index('idx_asset_versions_asset').on(t.assetId),
  })
);

/* ------------------------------------------------------------------ */
/*  11. project_members — 协作成员                                       */
/* ------------------------------------------------------------------ */
export const memberRoleEnum = ['owner', 'editor', 'viewer', 'commenter'] as const;
export type MemberRole = (typeof memberRoleEnum)[number];

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer').$type<MemberRole>(),
    /** 邀请方 */
    invitedBy: uuid('invited_by'),
    invitedAt: timestamp('invited_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** 状态：pending / accepted / revoked */
    status: varchar('status', { length: 20 }).notNull().default('pending').$type<'pending' | 'accepted' | 'revoked'>(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
    userIdx: index('idx_project_members_user').on(t.userId),
    roleIdx: index('idx_project_members_role').on(t.role),
  })
);

/* ------------------------------------------------------------------ */
/*  12. asset_locks — 锁脸档案（4 角度头像）                             */
/* ------------------------------------------------------------------ */
export const lockFaceAngles = ['front', 'left', 'right', 'back'] as const;
export type LockFaceAngle = (typeof lockFaceAngles)[number];

export const assetLocks = pgTable(
  'asset_locks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    /** 关联的 character 资产 id（assets.id，kind='character'） */
    characterId: uuid('character_id').notNull().unique(),
    /** 角色名（冗余便于查询） */
    characterName: varchar('character_name', { length: 100 }).notNull(),
    /** 4 角度头像 URL 映射 */
    faceAngles: jsonb('face_angles')
      .$type<Record<LockFaceAngle, string>>()
      .notNull()
      .default({} as Record<LockFaceAngle, string>),
    /** 视觉锚点（色板/特征/一致性向量） */
    visualAnchors: jsonb('visual_anchors').$type<Record<string, unknown>>().default({}),
    /** 跨场景一致性参考图（IP-Adapter / reference embedding） */
    referenceEmbedding: text('reference_embedding'),
    /** 锁定创建者 */
    createdBy: uuid('created_by').notNull(),
    /** 锁定项目（NULL = 用户私人档案） */
    projectId: uuid('project_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    characterIdx: index('idx_asset_locks_character').on(t.characterId),
    projectIdx: index('idx_asset_locks_project').on(t.projectId),
  })
);

/* ------------------------------------------------------------------ */
/*  类型导出                                                            */
/* ------------------------------------------------------------------ */
export type ProjectsExt = typeof projectsExt.$inferSelect;
export type NewProjectsExt = typeof projectsExt.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type AssetVersion = typeof assetVersions.$inferSelect;
export type NewAssetVersion = typeof assetVersions.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type AssetLock = typeof assetLocks.$inferSelect;
export type NewAssetLock = typeof assetLocks.$inferInsert;
