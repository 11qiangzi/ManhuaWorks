# ManhuaWorks Asset Service Dockerfile
# Multi-stage build: TypeScript compile → lightweight runtime

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests (for pnpm hoisting resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/asset-service/package.json ./services/asset-service/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/asset-service...

# Copy service source
COPY services/asset-service ./services/asset-service

# Build
RUN pnpm --filter @manhuaworks/asset-service build

# Strip devDeps for a smaller runtime image
RUN pnpm deploy --filter @manhuaworks/asset-service --prod /app/deploy

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy production-only deploy bundle
COPY --from=builder /app/deploy ./
COPY --from=builder /app/services/asset-service/dist ./dist
COPY --from=builder /app/services/asset-service/package.json ./

ENV NODE_ENV=production
ENV ASSET_PORT=8085
ENV PORT=8085

EXPOSE 8085

# tini = proper PID 1 / signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Health check — 3s timeout, 30s interval
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8085/health || exit 1

CMD ["node", "dist/index.js"]
