/**
 * Playwright 配置 — ManhuaWorks E2E
 * ManhuaWorks · L2 task 8
 *
 * 目标 4 前端 + 4 后端真实连接：
 *  - web  : http://localhost:3000  (或 :8080 nginx)
 *  - studio: http://localhost:3000 (与 web 同进程，路径 /studio/)
 *  - admin: http://localhost:5174
 *  - user-portal: http://localhost:5180
 *  - nginx gateway: http://localhost:80
 *
 * 后端：
 *  - user-service    :8088
 *  - project-service :8089
 *  - billing-service :8090
 *  - collab-service  :8091 (+ /ws)
 */
import { defineConfig, devices } from '@playwright/test'

const BASE_WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000'
const BASE_STUDIO = process.env.E2E_STUDIO_URL ?? 'http://localhost:3000'
const BASE_ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174'
const BASE_USER = process.env.E2E_USER_URL ?? 'http://localhost:5180'
const BASE_NGINX = process.env.E2E_NGINX_URL ?? 'http://localhost'

export default defineConfig({
  testDir: '.',
  testMatch: /.*-flow\.test\.ts$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: BASE_NGINX,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})

// ============================================================
// 运行时环境变量（默认指向本机 dev 服务）
//  使用环境变量覆盖：
//    API_USERS / API_PROJECTS / API_BILLING / API_COLLAB
//    E2E_WEB_URL / E2E_STUDIO_URL / E2E_ADMIN_URL / E2E_USER_URL / E2E_NGINX_URL
// ============================================================
