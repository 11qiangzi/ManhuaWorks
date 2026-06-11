# 鈹�鈹�鈹� Stage 1: 渚濊禆涓庢瀯寤?鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 鐢?corepack 鍚敤
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# 鍏?copy 鏍?workspace 鏂囦欢 + 鏈湇鍔?manifest锛屾渶澶ч檺搴﹀懡涓紦瀛?COPY pnpm-workspace.yaml package.json ./
COPY services/ai-router/package.json ./services/ai-router/
# 鎶婂叾瀹冩湇鍔＄殑 manifest 涔?copy 杩涙潵锛坧npm workspace 闇�瑕侊紱鍗充娇绌轰篃瀹夊叏锛?COPY apps/*/package.json ./apps/ 2>/dev/null || true
COPY services/*/package.json ./services/ 2>/dev/null || true
COPY packages/*/package.json ./packages/ 2>/dev/null || true

# 瑁呬緷璧?RUN pnpm install --filter @manhuaworks/ai-router... --frozen-lockfile=false

# copy 婧愮爜骞舵瀯寤?COPY tsconfig.base.json ./ 2>/dev/null || true
COPY services/ai-router ./services/ai-router
RUN pnpm --filter @manhuaworks/ai-router build

# 鈹�鈹�鈹� Stage 2: 杩愯鏃堕暅鍍?鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && apk add --no-cache tini \
    && addgroup -g 1001 -S app && adduser -S app -u 1001

ENV NODE_ENV=production \
    PORT=8082 \
    HOST=0.0.0.0

# 鎶?builder 闃舵鏋勫缓濂界殑浜х墿鍜?node_modules 鎷疯繃鏉?COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/services/ai-router/package.json ./services/ai-router/
COPY --from=builder /app/services/ai-router/dist ./services/ai-router/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/ai-router/node_modules ./services/ai-router/node_modules

# 鍒囧埌闈?root 鐢ㄦ埛
USER app
WORKDIR /app/services/ai-router

EXPOSE 8082

# tini 鏀跺兊灏歌繘绋嬶紝--enable-source-maps 璁?stack trace 鍙
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8082/health || exit 1
