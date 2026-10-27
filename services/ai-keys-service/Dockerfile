# ManhuaWorks ai-keys-service Dockerfile
# 多阶段构建：先编译 TS，再跑轻量运行时镜像

FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 通过 corepack 启用
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/ai-keys-service/package.json ./services/ai-keys-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/ai-keys-service...

COPY services/ai-keys-service/tsconfig.json ./services/ai-keys-service/
COPY services/ai-keys-service/src ./services/ai-keys-service/src
RUN pnpm --filter @manhuaworks/ai-keys-service build

# ─── Runtime ───
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 仅拷贝产物 + 必要依赖
COPY --from=builder /app/services/ai-keys-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/ai-keys-service/dist ./dist

EXPOSE 8083
USER node

CMD ["node", "dist/index.js"]
