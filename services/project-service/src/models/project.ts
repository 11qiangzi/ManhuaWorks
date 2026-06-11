/**
 * projects model —沿用001_init.sql 的字段命名（snake_case）。
 *
 *状态：0=draft,1=in_progress,2=review,3=done（与001的 chk_projects_status CHECK一致）。
 */
export type ProjectStatus =0|1|2|3;

export interface ProjectRow {
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

export interface ProjectCreateInput {
 user_id: string;
 title: string;
 description?: string | null;
 art_style?: string | null;
 story_type?: string | null;
 cover_url?: string | null;
 status?: ProjectStatus;
}

export interface ProjectUpdateInput {
 title?: string;
 description?: string | null;
 art_style?: string | null;
 story_type?: string | null;
 cover_url?: string | null;
 status?: ProjectStatus;
}
