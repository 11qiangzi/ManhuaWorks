/**
 * ManhuaWorks — PM2 Ecosystem 配置
 * 2026-06-09 梁总 L4-C 部署脚本
 *
 * 用途:
 *   - 生产环境: pm2 start ecosystem.config.cjs --env production
 *   - 预发环境: pm2 start ecosystem.config.cjs --env staging
 *   - 开发环境: 推荐用 scripts/dev-start.ps1 (每个进程一个窗口, 看见日志)
 *
 * 包含 5 个 app:
 *   1. user-service      :8088  鉴权 + 用户 + 审计
 *   2. project-service   :8089  项目 CRUD + 成员 + 镜头
 *   3. billing-service   :8090  计费 + 配额
 *   4. collab-service    :8091  协作 + WebSocket
 *   5. ai-orchestrator   :8087  AI 编排 (M1-W4 后接入)
 *
 * 关键概念:
 *   - name: pm2 list 里看到的名字, 唯一
 *   - script: 启动脚本 (相对 cwd), dev 模式用 tsx, 生产用编译后的 dist
 *   - cwd: 工作目录, 决定 .env / node_modules / log 路径
 *   - instances: "max" = CPU 核数, 单进程业务用 1
 *   - exec_mode: "fork" = 每 instance 独立进程; "cluster" = 共享端口的 fork 池
 *   - max_memory_restart: OOM 自愈, 单进程超 512M 自动重启
 *   - env / env_<name>: 进程环境变量, pm2 start --env production 会合并 env_production
 *
 * 常用命令:
 *   pm2 start ecosystem.config.cjs                  # 用默认 env (development)
 *   pm2 start ecosystem.config.cjs --env production # 用 env_production
 *   pm2 reload ecosystem.config.cjs                 # 0 停机热重启 (cluster 模式)
 *   pm2 restart ecosystem.config.cjs                # 直接重启
 *   pm2 stop ecosystem.config.cjs                   # 全部停
 *   pm2 delete ecosystem.config.cjs                 # 从 pm2 列表里删
 *   pm2 logs mhw-user-service --lines 200           # 单个 app 日志
 *   pm2 monit                                       # 实时监控面板
 *   pm2 save && pm2 resurrect                       # 持久化 + 恢复
 *
 * Windows 注意事项:
 *   - pm2-windows-startup 装 windows 服务, 开机自启
 *   - max_memory_restart 在 Windows 上是按 Working Set 算的, 不是 RSS
 *   - 不能用 cluster 模式做 0 停机 (Windows fork 有 bug), 用 fork
 */

module.exports = {
  /**
   * apps: 应用列表, pm2 start 会按顺序拉起
   * 顺序很重要: 依赖数据库的放前面 (虽然这里都是同构的, 但读起来顺)
   */
  apps: [
    // ============================================================
    //  1. user-service :8088
    //  职责: 注册登录 / JWT / 2FA / 用户画像 / 审计
    //  依赖: postgres
    //  端口: 8088 (跟 vite proxy / nginx upstream 对齐)
    // ============================================================
    {
      name: 'mhw-user-service',
      script: 'src/index.ts',
      // dev 用 tsx (直接跑 ts), 生产用 dist/index.js
      // 通过 --interpreter 切换 dev/prod
      // 这里同时配两套, 默认 production, dev 走 npm run dev
      cwd: '../services/user-service',
      interpreter: 'node_modules/.bin/tsx',
      // 关键: watch 模式 = 改代码自动重启 (dev 才需要, 生产会卡)
      watch: false,
      // 实例数: 单进程业务 (有状态: 缓存 + 限流内存) 不开多实例
      instances: 1,
      exec_mode: 'fork',
      // 内存超 512M 自动重启, 防内存泄漏
      max_memory_restart: '512M',
      // 自动重启策略: 崩溃了等 5 秒重启, 最多 10 次
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      // 日志
      log_file: '../../logs/pm2/user-service-combined.log',
      error_file: '../../logs/pm2/user-service-error.log',
      out_file: '../../logs/pm2/user-service-out.log',
      merge_logs: true,
      // 优雅关闭: 收到 SIGINT 先把 in-flight 请求处理完 (最多 10s)
      kill_timeout: 10000,
      listen_timeout: 10000,
      // 环境变量 (默认 development)
      env: {
        NODE_ENV: 'development',
        PORT: 8088,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8088,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8088,
        LOG_LEVEL: 'warn',
      },
    },

    // ============================================================
    //  2. project-service :8089
    //  职责: 项目 CRUD / 版本 / 成员 / 标签 / 镜头
    //  依赖: postgres
    //  端口: 8089
    // ============================================================
    {
      name: 'mhw-project-service',
      script: 'src/index.ts',
      cwd: '../services/project-service',
      interpreter: 'node_modules/.bin/tsx',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      log_file: '../../logs/pm2/project-service-combined.log',
      error_file: '../../logs/pm2/project-service-error.log',
      out_file: '../../logs/pm2/project-service-out.log',
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8089,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8089,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8089,
        LOG_LEVEL: 'warn',
      },
    },

    // ============================================================
    //  3. billing-service :8090
    //  职责: 计费 / 配额 / 订阅
    //  依赖: postgres
    //  端口: 8090
    // ============================================================
    {
      name: 'mhw-billing-service',
      script: 'src/index.ts',
      cwd: '../services/billing-service',
      interpreter: 'node_modules/.bin/tsx',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      log_file: '../../logs/pm2/billing-service-combined.log',
      error_file: '../../logs/pm2/billing-service-error.log',
      out_file: '../../logs/pm2/billing-service-out.log',
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8090,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8090,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8090,
        LOG_LEVEL: 'warn',
      },
    },

    // ============================================================
    //  4. collab-service :8091
    //  职责: 实时协作 + WebSocket + 冲突解决
    //  依赖: postgres + redis (有状态 ws 连接, 不开多实例)
    //  端口: 8091 (WebSocket 在 /ws, nginx rewrite 到这)
    //  内存要给大点, ws 长连接会累积
    // ============================================================
    {
      name: 'mhw-collab-service',
      script: 'src/index.ts',
      cwd: '../services/collab-service',
      interpreter: 'node_modules/.bin/tsx',
      watch: false,
      instances: 1,                  // 有状态, 单实例
      exec_mode: 'fork',
      max_memory_restart: '1G',      // ws 长连接, 内存给 1G
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      log_file: '../../logs/pm2/collab-service-combined.log',
      error_file: '../../logs/pm2/collab-service-error.log',
      out_file: '../../logs/pm2/collab-service-out.log',
      merge_logs: true,
      kill_timeout: 15000,           // 关 ws 慢点
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8091,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8091,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8091,
        LOG_LEVEL: 'warn',
      },
    },

    // ============================================================
    //  5. ai-orchestrator :8087  (M1-W4 后接入, 提前配好)
    //  职责: 6 个 AI 编排管道 (novel-to-drama / episode-batch 等)
    //  依赖: ai-router + workflow-engine
    //  端口: 8087
    //  内存要给大, AI 编排跑长任务
    // ============================================================
    {
      name: 'mhw-ai-orchestrator',
      script: 'src/index.ts',
      cwd: '../services/ai-orchestrator',
      interpreter: 'node_modules/.bin/tsx',
      watch: false,
      instances: 1,                  // 编排任务跑长, 单实例排队
      exec_mode: 'fork',
      max_memory_restart: '1G',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      log_file: '../../logs/pm2/ai-orchestrator-combined.log',
      error_file: '../../logs/pm2/ai-orchestrator-error.log',
      out_file: '../../logs/pm2/ai-orchestrator-out.log',
      merge_logs: true,
      kill_timeout: 30000,           // 跑一半的 AI 任务给 30s 收尾
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8087,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8087,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8087,
        LOG_LEVEL: 'warn',
      },
    },
  ],

  /**
   * deploy: 远程部署策略 (可选, 我们用不上, 留个空架子)
   * 真要远程部署: pm2 deploy production setup / pm2 deploy production
   */
  deploy: {
    production: {
      user: 'mhw',
      host: 'mhw-prod-01.example.com',
      ref: 'origin/main',
      repo: 'git@github.com:manhuaworks/infra.git',
      path: '/srv/manhuaworks',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm build && pm2 reload ecosystem.config.cjs --env production',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
