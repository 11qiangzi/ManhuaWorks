/**
 * project_tags model — 项目标签（多对多，PK = (project_id, tag)）。
 */
export interface ProjectTagRow {
 project_id: string;
 tag: string;
 created_at: Date;
}

export interface ProjectTagInput {
 project_id: string;
 tag: string;
}
