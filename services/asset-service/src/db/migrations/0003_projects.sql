-- ============================================================
-- ManhuaWorks asset-service Migration 0003
-- 项目空间 + 资产管理 5 张表
-- ============================================================
-- 注意：本迁移只负责 asset-service 自身的表
-- user-service 的 users / projects 等表由 001_init.sql 负责
-- ============================================================

-- 依赖：uuid 扩展（001_init.sql 应已创建）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 8. projects_ext — 项目空间扩展
-- ============================================================
CREATE TABLE IF NOT EXISTS projects_ext (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL UNIQUE,                       -- 关联 user-service.projects.id
    owner_id            UUID NOT NULL,                              -- user-service.users.id
    story_type          VARCHAR(50),                                -- sweet_romance_novel / xianxia_fantasy ...
    art_style           VARCHAR(50),                                -- 2d_90s_japanese_anime / 3d_anime_render ...
    visual_anchors      JSONB NOT NULL DEFAULT '{}'::jsonb,
    collab_policy       JSONB NOT NULL DEFAULT '{}'::jsonb,
    locked_at_version   INTEGER NOT NULL DEFAULT 0,                -- 0 = 未锁
    locked_by           UUID,
    locked_at           TIMESTAMPTZ,
    season_no           INTEGER NOT NULL DEFAULT 1,
    episode_count       INTEGER NOT NULL DEFAULT 0,
    tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_ext_owner      ON projects_ext (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_ext_story_type ON projects_ext (story_type);
CREATE INDEX IF NOT EXISTS idx_projects_ext_art_style  ON projects_ext (art_style);

-- ============================================================
-- 9. assets — 资产主表
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id        UUID NOT NULL,
    project_id      UUID,                                          -- NULL = 用户私人资产
    kind            VARCHAR(20) NOT NULL,                          -- image/video/audio/character/scene/shot/episode
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    file_url        TEXT,
    thumb_url       TEXT,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    mime_type       VARCHAR(80),
    duration_sec    INTEGER,
    width           INTEGER,
    height          INTEGER,
    character_id    UUID,                                          -- 仅 character 资产
    shelf_level     VARCHAR(20) NOT NULL DEFAULT 'user',           -- user/project/global
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_version INTEGER NOT NULL DEFAULT 1,
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_assets_kind
        CHECK (kind IN ('image','video','audio','character','scene','shot','episode')),
    CONSTRAINT chk_assets_shelf
        CHECK (shelf_level IN ('user','project','global'))
);

CREATE INDEX IF NOT EXISTS idx_assets_owner      ON assets (owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_project    ON assets (project_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind       ON assets (kind);
CREATE INDEX IF NOT EXISTS idx_assets_shelf_level ON assets (shelf_level);
CREATE INDEX IF NOT EXISTS idx_assets_character  ON assets (character_id);
CREATE INDEX IF NOT EXISTS idx_assets_name       ON assets (name);
CREATE INDEX IF NOT EXISTS idx_assets_created    ON assets (created_at DESC);

-- ============================================================
-- 10. asset_versions — 资产版本快照
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_versions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id     UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    version_no   INTEGER NOT NULL,
    file_url     TEXT,
    thumb_url    TEXT,
    snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_note  TEXT,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_versions_asset_vno UNIQUE (asset_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_asset_versions_asset ON asset_versions (asset_id, version_no DESC);

-- ============================================================
-- 11. project_members — 协作成员
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
    project_id   UUID NOT NULL,
    user_id      UUID NOT NULL,
    role         VARCHAR(20) NOT NULL DEFAULT 'viewer',     -- owner/editor/viewer/commenter
    invited_by   UUID,
    invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at  TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending/accepted/revoked
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT chk_pm_role
        CHECK (role IN ('owner','editor','viewer','commenter')),
    CONSTRAINT chk_pm_status
        CHECK (status IN ('pending','accepted','revoked'))
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members (role);

-- ============================================================
-- 12. asset_locks — 锁脸档案（4 角度头像 + 跨场景一致性）
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_locks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id        UUID NOT NULL UNIQUE,             -- 关联 assets.id (kind='character')
    character_name      VARCHAR(100) NOT NULL,
    face_angles         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {front,left,right,back} → url
    visual_anchors      JSONB NOT NULL DEFAULT '{}'::jsonb,
    reference_embedding TEXT,
    created_by          UUID NOT NULL,
    project_id          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_locks_character ON asset_locks (character_id);
CREATE INDEX IF NOT EXISTS idx_asset_locks_project   ON asset_locks (project_id);

-- ============================================================
-- 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_ext_updated_at ON projects_ext;
CREATE TRIGGER trg_projects_ext_updated_at
    BEFORE UPDATE ON projects_ext
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_asset_locks_updated_at ON asset_locks;
CREATE TRIGGER trg_asset_locks_updated_at
    BEFORE UPDATE ON asset_locks
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================
-- 完成
-- ============================================================
-- 执行方式：
--   psql $DATABASE_URL -f services/asset-service/src/db/migrations/0003_projects.sql
-- ============================================================
