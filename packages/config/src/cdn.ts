/**
 * CDN 缓存配置（P0 整改 — 程构 2026-06-10）
 *
 * 用途：
 *  - Vite build 时 `base` 指向 CDN 域名
 *  - 生产环境静态资源从 CDN 加载
 *  - 开发环境保持 `/` 不变
 *
 * 环境变量：
 *  - VITE_CDN_BASE  — CDN 基础 URL（如 https://cdn.manhuaworks.com/）
 *  - NODE_ENV        — development / production
 */

export function getCdnBase(): string {
  // 生产环境优先读取 CDN 环境变量
  if (process.env.NODE_ENV === 'production') {
    return process.env.VITE_CDN_BASE || '/';
  }
  // 开发环境走本地
  return '/';
}

/**
 * CDN 缓存策略建议（部署侧配置，非前端代码）
 *
 * Nginx / CDN 边缘节点配置参考：
 * ```
 * # HTML — 不缓存（保证用户总能拿到最新版本）
 * location ~* \.html$ {
 *   add_header Cache-Control "no-cache, must-revalidate";
 * }
 *
 * # JS/CSS — 长期缓存（文件名含 hash，内容不变 URL 不变）
 * location ~* \.(js|css)$ {
 *   add_header Cache-Control "public, max-age=31536000, immutable";
 * }
 *
 * # 图片/字体 — 中期缓存
 * location ~* \.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
 *   add_header Cache-Control "public, max-age=604800";
 * }
 * ```
 */
export const CDN_CACHE_RULES = {
  html: 'no-cache, must-revalidate',
  assets: 'public, max-age=31536000, immutable',
  images: 'public, max-age=604800',
} as const;
