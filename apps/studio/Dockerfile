# ManhuaWorks studio (apps/studio) — Multi-stage Dockerfile
# 2026-06-08 谢擎 L2-task-12
# 同 web，端口 3001。
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml* ./
COPY apps/studio/package.json ./apps/studio/
COPY packages/api-client/package.json ./packages/api-client/ 2>/dev/null || true
COPY packages/ui/package.json ./packages/ui/ 2>/dev/null || true
COPY packages/ui-components/package.json ./packages/ui-components/ 2>/dev/null || true
RUN npm install --no-audit --no-fund --workspaces=false \
 || (cd apps/studio && npm install --no-audit --no-fund)

FROM deps AS build
WORKDIR /repo
COPY apps/studio ./apps/studio
COPY packages/api-client ./packages/api-client 2>/dev/null || true
COPY packages/ui ./packages/ui 2>/dev/null || true
COPY packages/ui-components ./packages/ui-components 2>/dev/null || true
RUN cd apps/studio && npx vite build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /repo/apps/studio/dist ./dist
COPY --from=build /repo/apps/studio/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3001/ >/dev/null 2>&1 || exit 1
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3001", "--strictPort"]
