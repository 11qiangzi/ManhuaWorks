/**
 * 千机工坊 统一命名规范
 * 所有面向用户的文案必须引用此文件，禁止硬编码
 *
 * 修改此文件时请同步更新:
 *   - D:\ManhuaWorks\docs\COPYWRITING_GUIDE.md
 *   - D:\ManhuaWorks\apps\web\src\config\branding.ts (subNames 保持对齐)
 */

export const MODULE_NAMES = {
  manga: { name: '动画生成器', short: '动画', icon: '🎬', oldNames: ['漫改工坊', '千机·漫', '漫画生成器'] },
  novel: { name: '故事生成器', short: '故事', icon: '📖', oldNames: ['小说工坊', '千机·书'] },
  promo: { name: '宣传片生成器', short: '宣传片', icon: '🎥', oldNames: ['宣传片工坊', '千机·片'] },
  adShort: { name: '短视频生成器', short: '短视频', icon: '📹', oldNames: ['广告短片工坊', '千机·影'] },
  adImage: { name: '广告图生成器', short: '广告图', icon: '🖼️', oldNames: ['广告图工坊', '千机·图'] },
  music: { name: '配乐生成器', short: '配乐', icon: '🎵', oldNames: ['音乐工坊', '千机·曲'] },
} as const;

export const UNIT_NAMES = {
  quota: '次',          // NOT '集'
  quotaLong: '次生成机会',
  dailyQuota: '今日剩余',
} as const;

export const FEATURE_NAMES = {
  byok: '自备密钥模式',     // NOT 'BYOK'
  byokDesc: '用自己的AI账号，更省钱',
  platformFee: '平台服务费', // NOT '通道费'
} as const;

// Standard system messages
export const MESSAGES = {
  quotaEmpty: (remaining: number, action: string) =>
    `今天的免费次数用完了——你离${action}只差1次，升级后立刻继续`,
  generateFailed: (reason: string) =>
    `AI脑子转冒烟了，${reason}。30秒后再试一次？`,
  emptyState: (module: string) =>
    `还没有${module}作品，来创建你的第一个吧`,
  loading: (module: string) =>
    `正在让AI${module}师开工，预计15秒...`,
  apiKeyInvalid:
    '你的密钥好像过期了，去对应平台后台看看？',
} as const;

/** 模块 key 类型 */
export type ModuleKey = keyof typeof MODULE_NAMES;

/** 获取模块显示名 — 带 fallback */
export function getModuleName(key: string): string {
  return (MODULE_NAMES as Record<string, { name: string }>)?.[key]?.name ?? key;
}

/** 获取模块图标 — 带 fallback */
export function getModuleIcon(key: string): string {
  return (MODULE_NAMES as Record<string, { icon: string }>)?.[key]?.icon ?? '📦';
}

/** 获取模块短名 — 带 fallback */
export function getModuleShort(key: string): string {
  return (MODULE_NAMES as Record<string, { short: string }>)?.[key]?.short ?? key;
}
