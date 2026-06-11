# ─── Stage 1: 依赖与构建 ────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 用 corepack 启用
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# 先 copy 根 workspace 文件 + 本服务 manifest，最大限度命中缓存
COPY pnpm-workspace.yaml package.json ./
COPY services/api-gateway/package.json ./services/api-gateway/
# 把其它服务的 manifest 也 copy 进来（pnpm workspace 需要；即使空也安全）
COPY apps/*/package.json ./apps/ 2>/dev/null || true
COPY services/*/package.json ./services/ 2>/dev/null || true
COPY packages/*/package.json ./packages/ 2>/dev/null || true

# 装依赖
RUN pnpm install --filter @manhuaworks/api-gateway... --frozen-lockfile=false

# copy 源码并构建
COPY tsconfig.base.json ./ 2>/dev/null || true
COPY services/api-gateway ./services/api-gateway
RUN pnpm --filter @manhuaworks/api-gateway build

# ─── Stage 2: 运行时镜像 ────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && apk add --no-cache tini \
    && addgroup -g 1001 -S app && adduser -S app -u 1001

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# 把 builder 阶段构建好的产物和 node_modules 拷过来
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api-gateway/node_modules ./services/api-gateway/node_modules

# 切到非 root 用户
USER app
WORKDIR /app/services/api-gateway

EXPOSE 8080

# tini 收僵尸进程，--enable-source-maps 让 stack trace 可读
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1
