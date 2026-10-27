# ManhuaWorks user-portal (apps/user-portal) — Multi-stage Dockerfile
# 2026-06-08 谢擎 L2-task-12
# 同 web，端口 3003。
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
COPY apps/user-portal/package.json ./apps/user-portal/
COPY packages/api-client/package.json ./packages/api-client/ 2>/dev/null || true
COPY packages/ui/package.json ./packages/ui/ 2>/dev/null || true
COPY packages/ui-components/package.json ./packages/ui-components/ 2>/dev/null || true
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN pnpm install --frozen-lockfile --filter @manhuaworks/user-portal...

FROM deps AS build
WORKDIR /repo
COPY apps/user-portal ./apps/user-portal
COPY packages/api-client ./packages/api-client 2>/dev/null || true
COPY packages/ui ./packages/ui 2>/dev/null || true
COPY packages/ui-components ./packages/ui-components 2>/dev/null || true
RUN pnpm --filter @manhuaworks/user-portal build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
COPY --from=build /repo/apps/user-portal/dist ./dist
COPY --from=build /repo/apps/user-portal/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
USER node
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3003/ >/dev/null 2>&1 || exit 1
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3003", "--strictPort"]
