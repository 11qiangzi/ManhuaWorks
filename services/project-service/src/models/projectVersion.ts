/**
 * project_versions model — 自动版本快照。
 *
 * snapshot 是项目当时的完整 JSON状态（用于 diff 和还原）。
 */
export interface ProjectVersionRow {
 id: string;
 project_id: string;
 version_no: number;
 snapshot: Record<string, unknown>;
 message: string | null;
 created_by: string;
 created_at: Date;
}

export interface ProjectVersionCreateInput {
 project_id: string;
 version_no: number;
 snapshot: Record<string, unknown>;
 message?: string | null;
 created_by: string;
}
