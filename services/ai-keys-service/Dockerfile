# ManhuaWorks ai-keys-service Dockerfile
# 多阶段构建：先编译 TS，再跑轻量运行时镜像

FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 通过 corepack 启用
RUN corepack enable

COPY services/ai-keys-service/package.json ./
RUN npm install --no-audit --no-fund

COPY services/ai-keys-service/tsconfig.json ./
COPY services/ai-keys-service/src ./src
RUN npm run build

# ─── Runtime ───
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 仅拷贝产物 + 必要依赖
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8083
USER node

CMD ["node", "dist/index.js"]
