FROM node:20-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY tests ./tests
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @manhuaworks/logger build
RUN pnpm --filter @manhuaworks/monitor build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/services/monitor/dist ./dist
COPY --from=build /repo/services/monitor/package.json ./
COPY --from=build /repo/services/monitor/.env ./
COPY --from=build /repo/packages/logger/dist ./node_modules/@manhuaworks/logger/dist
COPY --from=build /repo/packages/logger/package.json ./node_modules/@manhuaworks/logger/
COPY --from=build /repo/node_modules ./node_modules
EXPOSE 8092
USER node
CMD ["node", "dist/index.js"]
