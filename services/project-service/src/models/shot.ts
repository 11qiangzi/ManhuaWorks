/**
 * shots model — 分镜。
 *
 * - shot_no :业务编号（项目内唯一）
 * - sort_index :排序字段（拖拽重排时更新）
 * - status :0=draft,1=ready,2=generating,3=done
 */
export type ShotStatus =0|1|2|3;

export interface ShotRow {
 id: string;
 project_id: string;
 shot_no: number;
 title: string | null;
 description: string | null;
 duration_ms: number;
 camera: string | null;
 characters: string[];
 dialogue: string | null;
 note: string | null;
 status: ShotStatus;
 sort_index: number;
 created_at: Date;
 updated_at: Date;
}

export interface ShotCreateInput {
 project_id: string;
 shot_no?: number;
 title?: string | null;
 description?: string | null;
 duration_ms?: number;
 camera?: string | null;
 characters?: string[];
 dialogue?: string | null;
 note?: string | null;
 status?: ShotStatus;
 sort_index?: number;
}

export interface ShotUpdateInput {
 title?: string | null;
 description?: string | null;
 duration_ms?: number;
 camera?: string | null;
 characters?: string[];
 dialogue?: string | null;
 note?: string | null;
 status?: ShotStatus;
 sort_index?: number;
 shot_no?: number;
}

export interface ShotReorderInput {
 /**有序的 shot id列表，按新顺序排好 */
 ids: string[];
}
