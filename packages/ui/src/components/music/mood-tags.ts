/**
 * Music Component Library - 16-Tag Emotion Classification
 * 四组情绪分类：A(紧张刺激) B(温柔抒情) C(活力激昂) D(氛围特殊)
 */

export const MOOD_TAGS = [
  // Group A - 紧张刺激
  { id: 'tense', label: '紧张', labelEn: 'Tense', color: '#EF4444', group: 'A', bpmRange: [120, 160] },
  { id: 'battle', label: '战斗', labelEn: 'Battle', color: '#F59E0B', group: 'A', bpmRange: [140, 180] },
  { id: 'suspense', label: '悬疑', labelEn: 'Suspense', color: '#8B5CF6', group: 'A', bpmRange: [60, 90] },
  { id: 'crisis', label: '危急', labelEn: 'Crisis', color: '#DC2626', group: 'A', bpmRange: [160, 200] },
  // Group B - 温柔抒情
  { id: 'lyrical', label: '抒情', labelEn: 'Lyrical', color: '#3B82F6', group: 'B', bpmRange: [60, 80] },
  { id: 'sad', label: '悲伤', labelEn: 'Sad', color: '#6B7280', group: 'B', bpmRange: [40, 70] },
  { id: 'healing', label: '治愈', labelEn: 'Healing', color: '#10B981', group: 'B', bpmRange: [50, 70] },
  { id: 'warm', label: '温馨', labelEn: 'Warm', color: '#F97316', group: 'B', bpmRange: [80, 100] },
  // Group C - 活力激昂
  { id: 'cheerful', label: '欢快', labelEn: 'Cheerful', color: '#10B981', group: 'C', bpmRange: [120, 140] },
  { id: 'passionate', label: '热血', labelEn: 'Passionate', color: '#EF4444', group: 'C', bpmRange: [130, 160] },
  { id: 'scifi', label: '科幻', labelEn: 'Sci-fi', color: '#6366F1', group: 'C', bpmRange: [100, 130] },
  { id: 'epic', label: '史诗', labelEn: 'Epic', color: '#F59E0B', group: 'C', bpmRange: [80, 120] },
  // Group D - 氛围特殊
  { id: 'humorous', label: '诙谐', labelEn: 'Humorous', color: '#EC4899', group: 'D', bpmRange: [100, 140] },
  { id: 'oppressive', label: '压抑', labelEn: 'Oppressive', color: '#374151', group: 'D', bpmRange: [30, 60] },
  { id: 'dreamy', label: '梦幻', labelEn: 'Dreamy', color: '#A855F7', group: 'D', bpmRange: [60, 90] },
  { id: 'ethereal', label: '空灵', labelEn: 'Ethereal', color: '#06B6D4', group: 'D', bpmRange: [40, 70] },
] as const;

export type MoodTagId = typeof MOOD_TAGS[number]['id'];
export type MoodGroup = 'A' | 'B' | 'C' | 'D';

export interface MoodTag {
  id: MoodTagId;
  label: string;
  labelEn: string;
  color: string;
  group: MoodGroup;
  bpmRange: readonly [number, number];
}

/** 按分组获取情绪标签 */
export function getMoodTagsByGroup(group: MoodGroup): MoodTag[] {
  return (MOOD_TAGS as readonly MoodTag[]).filter((tag) => tag.group === group);
}

/** 通过 id 获取情绪标签 */
export function getMoodTagById(id: string): MoodTag | undefined {
  return (MOOD_TAGS as readonly MoodTag[]).find((tag) => tag.id === id);
}

/** 分组标签名称 */
export const MOOD_GROUP_LABELS: Record<MoodGroup, string> = {
  A: '紧张刺激',
  B: '温柔抒情',
  C: '活力激昂',
  D: '氛围特殊',
};
