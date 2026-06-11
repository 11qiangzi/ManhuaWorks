/**
 * pgvector 向量存储封装
 *
 * 依赖 node-postgres (pg) + pgvector 扩展。
 * 表结构约定：
 *
 *   CREATE TABLE IF NOT EXISTS vectors (
 *     id          BIGSERIAL PRIMARY KEY,
 *     namespace   TEXT NOT NULL,
 *     ref_id      TEXT NOT NULL,
 *     content     TEXT,
 *     embedding   VECTOR(N) NOT NULL,
 *     metadata    JSONB DEFAULT '{}'::jsonb,
 *     created_at  TIMESTAMPTZ DEFAULT now(),
 *     UNIQUE(namespace, ref_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS vectors_embedding_ivf
 *     ON vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */

import pg from 'pg';
import type { EmbeddingVector } from '../embeddings/base.js';

export interface VectorRecord {
  id?: number;
  namespace: string;
  refId: string;
  content?: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface VectorSearchHit {
  id: number;
  namespace: string;
  refId: string;
  content?: string;
  metadata: Record<string, unknown>;
  /** cosine 相似度（越大越相似，0~1） */
  score: number;
}

export interface VectorStoreConfig {
  connectionString: string;
  /** 默认维度（与 DB 表 VECTOR(N) 对齐） */
  dim: number;
  /** 池子最大连接数 */
  max?: number;
  /** 幂等 schema 迁移（默认 true） */
  autoMigrate?: boolean;
}

export class VectorStore {
  private readonly pool: pg.Pool;
  private readonly dim: number;
  private readonly autoMigrate: boolean;
  private migrated = false;

  constructor(config: VectorStoreConfig) {
    this.pool = new pg.Pool({
      connectionString: config.connectionString,
      max: config.max ?? 10,
    });
    this.dim = config.dim;
    this.autoMigrate = config.autoMigrate ?? true;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /** 一次性建表 + pgvector 扩展 */
  async migrate(): Promise<void> {
    if (this.migrated) return;
    const sql = `
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS vectors (
        id          BIGSERIAL PRIMARY KEY,
        namespace   TEXT NOT NULL,
        ref_id      TEXT NOT NULL,
        content     TEXT,
        embedding   VECTOR(${this.dim}) NOT NULL,
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ DEFAULT now(),
        UNIQUE(namespace, ref_id)
      );
    `;
    await this.pool.query(sql);
    this.migrated = true;
  }

  /** upsert 一条 */
  async upsert(record: VectorRecord): Promise<number> {
    if (record.embedding.length !== this.dim) {
      throw new Error(
        `Vector dim mismatch: got ${record.embedding.length}, expected ${this.dim}`,
      );
    }
    if (this.autoMigrate) await this.migrate();
    const vec = `[${record.embedding.join(',')}]`;
    const sql = `
      INSERT INTO vectors (namespace, ref_id, content, embedding, metadata)
      VALUES ($1, $2, $3, $4::vector, $5::jsonb)
      ON CONFLICT (namespace, ref_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
      RETURNING id;
    `;
    const res = await this.pool.query<{ id: string }>(sql, [
      record.namespace,
      record.refId,
      record.content ?? null,
      vec,
      JSON.stringify(record.metadata ?? {}),
    ]);
    return Number(res.rows[0]!.id);
  }

  async upsertFromEmbedding(
    namespace: string,
    refId: string,
    embedding: EmbeddingVector,
    content?: string,
    metadata?: Record<string, unknown>,
  ): Promise<number> {
    return this.upsert({
      namespace,
      refId,
      content,
      embedding: embedding.values,
      metadata: { ...metadata, provider: embedding.provider, model: embedding.model },
    });
  }

  /** 按 refId 取一条 */
  async get(namespace: string, refId: string): Promise<VectorRecord | null> {
    if (this.autoMigrate) await this.migrate();
    const sql = `
      SELECT id, namespace, ref_id, content, embedding, metadata, created_at
      FROM vectors WHERE namespace = $1 AND ref_id = $2 LIMIT 1;
    `;
    const res = await this.pool.query(sql, [namespace, refId]);
    if (res.rowCount === 0) return null;
    return rowToRecord(res.rows[0]);
  }

  /** 删一条 */
  async remove(namespace: string, refId: string): Promise<boolean> {
    const sql = `DELETE FROM vectors WHERE namespace = $1 AND ref_id = $2;`;
    const res = await this.pool.query(sql, [namespace, refId]);
    return (res.rowCount ?? 0) > 0;
  }

  /** cosine 相似度 topK */
  async search(
    namespace: string,
    query: number[],
    topK = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchHit[]> {
    if (query.length !== this.dim) {
      throw new Error(`Query dim mismatch: got ${query.length}, expected ${this.dim}`);
    }
    if (this.autoMigrate) await this.migrate();
    const vec = `[${query.join(',')}]`;
    const params: unknown[] = [vec, namespace];
    let where = `WHERE namespace = $2`;
    if (filter && Object.keys(filter).length > 0) {
      params.push(JSON.stringify(filter));
      where += ` AND metadata @> $${params.length}::jsonb`;
    }
    params.push(topK);
    const sql = `
      SELECT id, namespace, ref_id, content, metadata,
             1 - (embedding <=> $1::vector) AS score
      FROM vectors
      ${where}
      ORDER BY embedding <=> $1::vector
      LIMIT $${params.length};
    `;
    const res = await this.pool.query(sql, params);
    return res.rows.map((row) => ({
      id: Number(row.id),
      namespace: row.namespace,
      refId: row.ref_id,
      content: row.content ?? undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? {},
      score: Number(row.score),
    }));
  }

  /** 统计某 namespace 下的记录数 */
  async count(namespace: string): Promise<number> {
    if (this.autoMigrate) await this.migrate();
    const res = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM vectors WHERE namespace = $1;`,
      [namespace],
    );
    return Number(res.rows[0]!.count);
  }
}

interface RawRow {
  id: string | number;
  namespace: string;
  ref_id: string;
  content: string | null;
  embedding: string | number[];
  metadata: unknown;
  created_at: Date | string;
}

function rowToRecord(row: RawRow): VectorRecord {
  let emb: number[];
  if (typeof row.embedding === 'string') {
    // pgvector 文本形式："[1,2,3]"
    emb = row.embedding
      .slice(1, -1)
      .split(',')
      .map((s) => Number(s.trim()));
  } else {
    emb = row.embedding;
  }
  const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? {};
  return {
    id: Number(row.id),
    namespace: row.namespace,
    refId: row.ref_id,
    content: row.content ?? undefined,
    embedding: emb,
    metadata: meta,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
