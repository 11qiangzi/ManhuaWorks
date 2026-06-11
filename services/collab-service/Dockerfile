# ManhuaWorks collab-service Dockerfile
# Multi-stage: build -> runtime
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npx tsc -p tsconfig.json

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

EXPOSE 8091
USER node
CMD ["node", "dist/index.js"]
