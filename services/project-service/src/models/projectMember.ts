/**
 * project_members model — 项目协作者。
 *
 *角色：owner / editor / commenter / viewer
 */
export type MemberRole = 'owner'|'editor'|'commenter'|'viewer';

export const MEMBER_ROLES: MemberRole[] = ['owner','editor','commenter','viewer'];

export interface ProjectMemberRow {
 project_id: string;
 user_id: string;
 role: MemberRole;
 joined_at: Date;
 last_active_at: Date | null;
}

export interface ProjectMemberCreateInput {
 project_id: string;
 user_id: string;
 role: MemberRole;
}

export interface ProjectMemberUpdateInput {
 role: MemberRole;
}
