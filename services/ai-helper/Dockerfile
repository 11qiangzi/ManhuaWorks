# ManhuaWorks AI Helper Dockerfile
# Multi-stage build: TypeScript compile → lightweight runtime

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests (for pnpm hoisting resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/ai-helper/package.json ./services/ai-helper/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/ai-helper...

# Copy service source
COPY services/ai-helper ./services/ai-helper

# Build
RUN pnpm --filter @manhuaworks/ai-helper build

# Strip devDeps for a smaller runtime image
RUN pnpm deploy --filter @manhuaworks/ai-helper --prod /app/deploy

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy production-only deploy bundle
COPY --from=builder /app/deploy ./
COPY --from=builder /app/services/ai-helper/dist ./dist
COPY --from=builder /app/services/ai-helper/package.json ./

ENV NODE_ENV=production
ENV PORT=8086
ENV HELPER_PORT=8086

EXPOSE 8086

# tini = proper PID 1 / signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Health check — 3s timeout, 30s interval
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8086/health || exit 1

CMD ["node", "dist/index.js"]
