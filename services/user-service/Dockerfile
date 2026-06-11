# ManhuaWorks user-service Dockerfile (multi-stage)
# 2026-06-08 钟帧

FROM node:20-alpine AS builder
WORKDIR /app

COPY services/user-service/package.json ./
RUN npm install --no-audit --no-fund

COPY services/user-service/tsconfig.json ./
COPY services/user-service/src ./src
COPY services/user-service/tests ./tests
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 安装 bcrypt 等需要原生编译的运行时依赖
RUN apk add --no-cache python3 make g++ \
  || true

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8088
USER node

CMD ["node", "dist/src/index.js"]
