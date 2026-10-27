# ManhuaWorks billing-service
# Multi-stage build

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/billing-service/package.json ./services/billing-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/billing-service...

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/billing-service ./services/billing-service
COPY services/billing-service ./services/billing-service
RUN pnpm --filter @manhuaworks/billing-service build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8090

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/billing-service/dist ./dist
COPY --from=build /app/services/billing-service/package.json ./package.json
COPY --from=build /app/services/billing-service/.env ./.env

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/health', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
