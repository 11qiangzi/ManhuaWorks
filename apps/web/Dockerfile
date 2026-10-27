# ManhuaWorks web (apps/web) — Multi-stage Dockerfile
# 2026-06-08 谢擎 L2-task-12
#
# 多阶段：deps → build → runtime
# - builder:  node:20-alpine (pnpm install + vite build)
# - runtime:  node:20-alpine (npx vite preview)
# - 工作目录: /app，监听 :3000
#
# 镜像内前端 SPA 静态资源 → vite preview 起在 0.0.0.0:3000。
# Build context 必须是 monorepo 根（这样能 COPY apps/web/*）。
#
# 构建：docker build -f apps/web/Dockerfile -t manhuaworks/web:latest .
# 运行：docker run --rm -p 3000:3000 manhuaworks/web:latest

# ==================== Stage 1: deps ====================
FROM node:20-alpine AS deps
WORKDIR /repo
# web 依赖 @manhuaworks/api-client + @manhuaworks/ui（workspace 包）
# 因此 build context 必须是 monorepo 根。
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/api-client/package.json ./packages/api-client/ 2>/dev/null || true
COPY packages/ui/package.json ./packages/ui/ 2>/dev/null || true
COPY packages/ui-components/package.json ./packages/ui-components/ 2>/dev/null || true
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN pnpm install --frozen-lockfile --filter @manhuaworks/web...

# ==================== Stage 2: build ====================
FROM deps AS build
WORKDIR /repo
COPY apps/web ./apps/web
COPY packages/api-client ./packages/api-client 2>/dev/null || true
COPY packages/ui ./packages/ui 2>/dev/null || true
COPY packages/ui-components ./packages/ui-components 2>/dev/null || true
RUN pnpm --filter @manhuaworks/web build

# ==================== Stage 3: runtime ====================
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# 把 dist 与 vite 二进制搬过来
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules

# node:20-alpine 自带 node 用户（uid 1000）
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

# 用 vite preview 起静态服务（带 SPA fallback）
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
