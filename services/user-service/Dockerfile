# ManhuaWorks user-service Dockerfile (multi-stage)
# 2026-06-08 钟帧

FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/user-service/package.json ./services/user-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/user-service...

COPY services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/src ./services/user-service/src
COPY services/user-service/tests ./services/user-service/tests
RUN pnpm --filter @manhuaworks/user-service build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 安装 bcrypt 等需要原生编译的运行时依赖
RUN apk add --no-cache python3 make g++ \
  || true

COPY --from=builder /app/services/user-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/user-service/dist ./dist

EXPOSE 8088
USER node

CMD ["node", "dist/src/index.js"]
