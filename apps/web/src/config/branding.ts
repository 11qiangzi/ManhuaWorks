/**
 * 千机工坊 品牌配置 — 派单 13 (谢擎)
 *
 * 主名 = 千机工坊, 域名 = qianjigongfang.com + qianjigongfang.cn
 * 6 子功能子名 = 千机·漫 / 千机·书 / 千机·曲 / 千机·片 / 千机·图 / 千机·影
 *
 * ⚠️ 注意: subNames 中的 "千机·X" 命名体系已弃用。
 *    面向用户的模块名请统一使用 @/config/naming 中的 MODULE_NAMES。
 *    例如: "动画生成器" (not "千机·漫"), "故事生成器" (not "千机·书")
 *    此文件仅保留品牌级常量（域名、邮件、调性）和向后兼容。
 *
 * 规则:
 *  - 中文名 / 拼音 / 域名 是常量, 不准业务组件直接硬编码
 *  - 前端组件统一从 `import { BRAND } from '@/config/branding'` 拿
 *  - 面向用户的模块名/单位名/功能名 从 `import { MODULE_NAMES, UNIT_NAMES, FEATURE_NAMES } from '@/config/naming'` 拿
 *  - 后端 (user-service) 同时维护同名 SUB_NAME_* env, 保持 1:1 同步
 *
 * 修改时请同步改:
 *  - D:\ManhuaWorks\services\user-service\.env (SUB_NAME_* + BRAND_*)
 *  - D:\ManhuaWorks\services\user-service\.env.example
 *  - D:\ManhuaWorks\docs\BRANDING_qianji.md
 *  - D:\ManhuaWorks\apps\web\src\config\naming.ts (面向用户文案)
 */

export const BRAND = {
  // 主名
  nameCn: '千机工坊',
  namePy: 'qianjigongfang',

  // 域名 (主 + 备)
  domainPrimary: 'qianjigongfang.com',
  domainSecondary: 'qianjigongfang.cn',

  // 邮件主发件 (与后端 EMAIL_FROM / SMTP_USER 对齐)
  emailPrimary: 'noreply@qianjigongfang.com',

  // 6 子功能子名 (梁总拍板, 派单 13)
  subNames: {
    manhua: '千机·漫', // 漫改
    novel: '千机·书',  // 小说
    music: '千机·曲',  // 音乐
    promo: '千机·片',  // 宣传片
    ad: '千机·图',     // 广告图
    video: '千机·影',  // 广告视频
  },

  // 子名英文 (URL slug / API path 用)
  subSlugs: {
    manhua: 'manhua',
    novel: 'novel',
    music: 'music',
    promo: 'promo',
    ad: 'ad',
    video: 'video',
  },

  // 子名拼音 (文件名 / 变量名 / SEO keyword 用)
  subPinyin: {
    manhua: 'qianji-manhua',
    novel: 'qianji-novel',
    music: 'qianji-music',
    promo: 'qianji-promo',
    ad: 'qianji-ad',
    video: 'qianji-video',
  },

  // 调性 (梁总定调, 内容部参考)
  tone: '东方智造 · 一机万象',
  tagline: '一站式 AI 内容工坊 — 漫 / 书 / 曲 / 片 / 图 / 影 六艺并行',

  // logo 占位 (待设计, 当前用首字 "千")
  logoText: '千',
  logoFull: '千机工坊',
} as const;

// 类型保护
export type SubNameKey = keyof typeof BRAND.subNames;

/** 取子名 — 默认 fallback 业务名 */
export function getSubName(key: string, fallback = ''): string {
  return (BRAND.subNames as Record<string, string>)[key] ?? fallback;
}

/** 取子名 slug — 用于 URL / API path */
export function getSubSlug(key: string, fallback = ''): string {
  return (BRAND.subSlugs as Record<string, string>)[key] ?? fallback;
}

/** 取子名拼音 — 用于文件名 / 变量名 */
export function getSubPinyin(key: string, fallback = ''): string {
  return (BRAND.subPinyin as Record<string, string>)[key] ?? fallback;
}