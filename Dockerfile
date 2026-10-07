# Multi-arch friendly (amd64 / arm64) — cocok untuk STB/homelab ARM
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# mariadb-connector-c: sedia-kan client auth plugin (caching_sha2_password.so) supaya
# mariadb-dump bisa konek ke MySQL 8 (default auth caching_sha2_password).
# `mysql-client` (= mariadb-client) TIDAK menarik package ini, akibatnya dump error 1045.
RUN apk add --no-cache wget mysql-client mariadb-connector-c zip unzip

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY knexfile.docker.js ./
COPY docs/reference/seed ./docs/reference/seed
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && mkdir -p /app/uploads/media /app/logs \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
