-- ManhuaWorks project-service 扩展表手动建表
-- 钟帧 L2 task 13: 修补 project-service L2 task 6 留下的 schema typo
-- 原始 bootstrap SQL 在 services/project-service/src/config/db.ts 含 SELECT1/DEFAULT0 等 typo
-- 这里用干净的 SQL 重建

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
