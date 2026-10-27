/**
 * 跨 App URL 配置 · v3.0
 *
 * v3.0 P1-1: studio(5175) 已迁入 web(3000) 主站
 * 客户后台(5180) 和管理后台(5174) 为独立应用
 * 主站内跳转使用 Vue Router，不再跨端口
 */

const host = () => window.location.hostname

/** 客户后台 (user-portal, port 5180) — 独立应用 */
export const getUserPortalUrl = (path: string) => `//${host()}:5180${path}`

/** 管理后台 (admin-portal, port 5174) — 独立应用 */
export const getAdminPortalUrl = (path: string) => `//${host()}:5174${path}`
