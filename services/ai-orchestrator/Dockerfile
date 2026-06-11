# Multi-stage build for ai-orchestrator
FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY services/ai-orchestrator ./services/ai-orchestrator
RUN pnpm install --filter @manhuaworks/ai-orchestrator... --frozen-lockfile=false
RUN pnpm --filter @manhuaworks/ai-orchestrator run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=builder /repo/services/ai-orchestrator/dist ./dist
COPY --from=builder /repo/services/ai-orchestrator/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/services/ai-orchestrator/node_modules ./node_modules
EXPOSE 8087
CMD ["node", "dist/index.js"]
