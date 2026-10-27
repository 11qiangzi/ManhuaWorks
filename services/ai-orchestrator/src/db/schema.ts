/**
 * ai-orchestrator · Drizzle Schema
 * generation_tasks 表 — 对齐 migrations/0002_generation_tasks.sql
 *
 * 4 种任务类型: image / video / audio / tts
 * 6 种供应商: seedream / seedance / minimax / volcengine / suno / openai
 * 6 种状态: queued / running / succeeded / failed / expired / cancelled
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============ Enum-like const arrays (matching CHECK constraints) ============

export const taskTypes = ['image', 'video', 'audio', 'tts'] as const;
export type TaskType = (typeof taskTypes)[number];

export const providers = [
  'seedream', 'seedance', 'minimax', 'volcengine', 'suno', 'openai',
] as const;
export type Provider = (typeof providers)[number];

export const taskStatuses = [
  'queued', 'running', 'succeeded', 'failed', 'expired', 'cancelled',
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

// ============ JSON column types ============

export interface CraftPromptJSON {
  context?: string;
  reference?: string;
  action?: string;
  framing?: string;
  timing?: string;
}

export interface ReferenceImageJSON {
  url: string;
  role: string;
}

// ============ Table ============

export const generationTasks = pgTable(
  'generation_tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    projectId: uuid('project_id'),

    // Task definition
    taskType: varchar('task_type', { length: 20 }).notNull().$type<TaskType>(),
    provider: varchar('provider', { length: 30 }).notNull().$type<Provider>(),
    model: varchar('model', { length: 50 }),

    // Request (immutable after creation)
    prompt: text('prompt').notNull(),
    craftPrompt: jsonb('craft_prompt').$type<CraftPromptJSON>(),
    referenceImages: jsonb('reference_images').$type<ReferenceImageJSON[]>(),
    parameters: jsonb('parameters').notNull().default({}).$type<Record<string, unknown>>(),

    // Dedup
    requestHash: varchar('request_hash', { length: 64 }).notNull(),

    // Provider task tracking
    providerTaskId: varchar('provider_task_id', { length: 200 }),
    status: varchar('status', { length: 20 }).notNull().default('queued').$type<TaskStatus>(),
    progress: integer('progress').default(0),
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 50 }),

    // Results (filled on success)
    resultUrl: text('result_url'),
    resultStoredUrl: text('result_stored_url'),
    resultMetadata: jsonb('result_metadata').$type<Record<string, unknown>>(),
    lastFrameUrl: text('last_frame_url'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    // Dedup: same request_hash can only have one active task
    hashDedupIdx: uniqueIndex('idx_gen_tasks_hash')
      .on(t.requestHash)
      .where(sql`status IN ('queued', 'running', 'succeeded')`),
    // User task history (most recent first)
    userHistoryIdx: index('idx_gen_tasks_user')
      .on(t.userId, t.createdAt),
    // Project-scoped queries
    projectIdx: index('idx_gen_tasks_project')
      .on(t.projectId)
      .where(sql`project_id IS NOT NULL`),
    // Active task polling (for background poller)
    statusPollingIdx: index('idx_gen_tasks_status')
      .on(t.status)
      .where(sql`status IN ('queued', 'running')`),
  }),
);

// ============ Inferred types ============

export type GenerationTaskRow = typeof generationTasks.$inferSelect;
export type NewGenerationTaskRow = typeof generationTasks.$inferInsert;
