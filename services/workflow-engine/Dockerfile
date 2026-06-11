# ManhuaWorks Workflow Engine Dockerfile
# Multi-stage build: TypeScript compile → lightweight runtime

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace root manifests (for pnpm hoisting resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/workflow-engine/package.json ./services/workflow-engine/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @manhuaworks/workflow-engine...

# Copy service source
COPY services/workflow-engine ./services/workflow-engine

# Build
RUN pnpm --filter @manhuaworks/workflow-engine build

# Strip devDeps for a smaller runtime image
RUN pnpm deploy --filter @manhuaworks/workflow-engine --prod /app/deploy

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# FFmpeg is required by the compose workflow
RUN apk add --no-cache ffmpeg tini

# Copy production-only deploy bundle
COPY --from=builder /app/deploy ./
COPY --from=builder /app/services/workflow-engine/dist ./dist
COPY --from=builder /app/services/workflow-engine/package.json ./

ENV NODE_ENV=production
ENV PORT=8084
ENV WORKFLOW_PORT=8084

EXPOSE 8084

# tini = proper PID 1 / signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Health check via Node-side fetch — 3s timeout, 30s interval
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8084/health || exit 1

CMD ["node", "dist/index.js"]
