# ManhuaWorks collab-service Dockerfile
# Multi-stage: build -> runtime
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/collab-service/package.json ./services/collab-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/collab-service...

COPY services/collab-service/tsconfig.json ./services/collab-service/
COPY services/collab-service/src ./services/collab-service/src
COPY services/collab-service/tests ./services/collab-service/tests
RUN pnpm --filter @manhuaworks/collab-service build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/services/collab-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/services/collab-service/dist ./dist

EXPOSE 8091
USER node
CMD ["node", "dist/index.js"]
