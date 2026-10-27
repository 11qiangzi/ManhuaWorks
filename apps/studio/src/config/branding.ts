/**
 * 千机工坊 品牌配置 — admin-portal 专用
 * 与 apps/web/src/config/branding.ts 保持同步
 */

export const BRAND = {
  nameCn: '千机工坊',
  namePy: 'qianjigongfang',
  domainPrimary: 'qianjigongfang.com',
  domainSecondary: 'qianjigongfang.cn',
  emailPrimary: 'noreply@qianjigongfang.com',
  subNames: {
    manhua: '千机·漫',
    novel: '千机·书',
    music: '千机·曲',
    promo: '千机·片',
    ad: '千机·图',
    video: '千机·影',
  },
  subSlugs: {
    manhua: 'manhua',
    novel: 'novel',
    music: 'music',
    promo: 'promo',
    ad: 'ad',
    video: 'video',
  },
  subPinyin: {
    manhua: 'qianji-manhua',
    novel: 'qianji-novel',
    music: 'qianji-music',
    promo: 'qianji-promo',
    ad: 'qianji-ad',
    video: 'qianji-video',
  },
  tone: '东方智造 · 一机万象',
  tagline: '一站式 AI 内容工坊 — 漫 / 书 / 曲 / 片 / 图 / 影 六艺并行',
  logoText: '千',
  logoFull: '千机工坊',
} as const;

export type SubNameKey = keyof typeof BRAND.subNames;

export function getSubName(key: string, fallback = ''): string {
  return (BRAND.subNames as Record<string, string>)[key] ?? fallback;
}

export function getSubSlug(key: string, fallback = ''): string {
  return (BRAND.subSlugs as Record<string, string>)[key] ?? fallback;
}

export function getSubPinyin(key: string, fallback = ''): string {
  return (BRAND.subPinyin as Record<string, string>)[key] ?? fallback;
}
