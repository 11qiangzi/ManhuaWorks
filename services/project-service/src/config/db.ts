/**
 * ManhuaWorks project-service 数据库连接
 *
 * - 单例 pg.Pool
 * -启动时 pingDb()探活
 * -启动时 bootstrapTables() 建扩展表（沿用001_init.sql风格：uuid + timestamptz + snake_case）
 */
import { Pool, PoolConfig } from 'pg';
import { logger } from './logger';

const config: PoolConfig = {
 connectionString: process.env.DATABASE_URL,
 max: Number(process.env.DATABASE_POOL_MAX ??10),
 idleTimeoutMillis:30_000,
 connectionTimeoutMillis:5_000,
};

if (!config.connectionString) {
 throw new Error('DATABASE_URL is required');
}

export const pool = new Pool(config);

pool.on('error', (err) => {
 logger.error({ err }, 'pg pool error');
});

/**探活：返回 true 表示 DB 可达。*/
export async function pingDb(): Promise<boolean> {
 try {
 const r = await pool.query<{ ok: number }>('SELECT 1 AS ok');
 return r.rows[0]?.ok ===1;
 } catch (err) {
 logger.error({ err }, 'db ping failed');
 return false;
 }
}

/**
 *启动时建扩展表（沿用001_init.sql风格）：
 * - project_versions : 自动版本快照
 * - project_members : 项目成员（owner/editor/commenter/viewer）
 * - project_tags : 项目标签
 * - shots : 分镜
 */
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS project_versions (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 version_no INTEGER NOT NULL,
 snapshot JSONB NOT NULL,
 message TEXT,
 created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (project_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON project_versions(created_at DESC);

CREATE TABLE IF NOT EXISTS project_members (
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role VARCHAR(16) NOT NULL,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_active_at TIMESTAMPTZ,
 PRIMARY KEY (project_id, user_id),
 CONSTRAINT chk_project_members_role CHECK (role IN ('owner','editor','commenter','viewer'))
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

CREATE TABLE IF NOT EXISTS project_tags (
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 tag VARCHAR(50) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (project_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag ON project_tags(tag);

CREATE TABLE IF NOT EXISTS shots (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 shot_no INTEGER NOT NULL,
 title VARCHAR(200),
 description TEXT,
 duration_ms INTEGER NOT NULL DEFAULT 0,
 camera VARCHAR(50),
 characters JSONB DEFAULT '[]'::jsonb,
 dialogue TEXT,
 note TEXT,
 status SMALLINT NOT NULL DEFAULT 0,
 sort_index INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT chk_shots_status CHECK (status BETWEEN 0 AND 3),
 UNIQUE (project_id, shot_no)
);
CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id, sort_index);
CREATE INDEX IF NOT EXISTS idx_shots_status ON shots(status);

CREATE TABLE IF NOT EXISTS scenes (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name VARCHAR(200) NOT NULL,
 description TEXT,
 scene_type VARCHAR(50) DEFAULT 'indoor',
 light_color_temp INTEGER DEFAULT 5500,
 light_brightness FLOAT DEFAULT 1.0,
 light_preset VARCHAR(50),
 prompt TEXT,
 thumbnail_url VARCHAR(500),
 tags JSONB DEFAULT '[]'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS characters (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name VARCHAR(200) NOT NULL,
 archetype VARCHAR(50),
 description TEXT,
 tags JSONB DEFAULT '[]'::jsonb,
 prompt TEXT,
 thumbnail_url VARCHAR(500),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id, created_at DESC);

-- P0-1: shot table column migrations (add missing columns from L3 spec)
DO $$ BEGIN
 ALTER TABLE shots ADD COLUMN IF NOT EXISTS camera_angle VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
 ALTER TABLE shots ADD COLUMN IF NOT EXISTS camera_movement VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
 ALTER TABLE shots ADD COLUMN IF NOT EXISTS duration_sec FLOAT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
 ALTER TABLE shots ADD COLUMN IF NOT EXISTS transition VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
 ALTER TABLE shots ADD COLUMN IF NOT EXISTS style_override JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
`;

export async function bootstrapTables(): Promise<void> {
 await pool.query(BOOTSTRAP_SQL);
 logger.info(
 'bootstrap tables ready (project_versions / project_members / project_tags / shots / scenes / characters)'
 );
}

export async function closeDb(): Promise<void> {
 await pool.end();
}
