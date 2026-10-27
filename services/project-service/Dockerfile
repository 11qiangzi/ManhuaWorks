# ManhuaWorks project-service — Multi-stage Dockerfile
# 2026-06-08 谢擎 L2-task-12
#
# 多阶段：deps → build → runtime
# - node:20-alpine（轻量，~180MB 镜像）
# - non-root user (node 镜像自带 node 用户 uid 1000)
# - 健康检查：每 30s 探测 /health
#
# 构建：docker build -f services/project-service/Dockerfile -t manhuaworks/project-service:latest .
# 运行：docker run --rm -p 8089:8089 \
#         -e DATABASE_URL=... -e REDIS_URL=... -e JWT_SECRET=... \
#         manhuaworks/project-service:latest

# ==================== Stage 1: deps ====================
FROM node:20-alpine AS deps
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests (for pnpm hoisting resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/project-service/package.json ./services/project-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/project-service...

# ==================== Stage 2: build ====================
FROM deps AS build
WORKDIR /app
COPY services/project-service/tsconfig.json ./services/project-service/
COPY services/project-service/src ./services/project-service/src
COPY services/project-service/tests ./services/project-service/tests
RUN pnpm --filter @manhuaworks/project-service build

# ==================== Stage 3: runtime ====================
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8089

# 仅安装生产依赖（精简镜像）
COPY --from=deps /app/services/project-service/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# 拷贝构建产物
COPY --from=build /app/services/project-service/dist ./dist

# node:20-alpine 镜像自带 node (uid 1000)，无需手动 adduser
USER node

EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8089)+'/health', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/src/index.js"]
