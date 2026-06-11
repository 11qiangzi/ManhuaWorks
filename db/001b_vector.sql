-- ManhuaWorks 数据库迁移 - 角色向量（需 pgvector 扩展）
-- 2026-06-08 谢擎
-- 待 pgvector 扩展安装后跑：
--   1. 安装 pgvector：到 https://github.com/pgvector/pgvector/releases 下载对应 PG16 版本
--      或 stack builder 安装
--   2. 然后跑：psql -h 127.0.0.1 -U mhw -d manhuaworks -f D:\ManhuaWorks\db\001b_vector.sql

-- 当前扩展未安装的状态下，本 SQL 会失败。属预期失败。
-- 当前 manhuaworks 库 pg_available_extensions 中没有 vector。

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE role_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    embedding vector(384) NOT NULL,
    reference_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_vectors_project ON role_vectors(project_id);
CREATE INDEX idx_role_vectors_embedding ON role_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
