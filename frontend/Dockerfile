FROM node:22.23.1-alpine3.24@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY test/e2e/package.json test/e2e/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
ARG STARTFLOW_BUILD_CONFIGURATION=production
COPY packages/contracts packages/contracts
COPY frontend frontend
RUN case "$STARTFLOW_BUILD_CONFIGURATION" in local|development|production) ;; *) exit 2 ;; esac \
    && pnpm --filter @startflow/contracts build \
    && pnpm --filter @startflow/frontend exec ng build --configuration "$STARTFLOW_BUILD_CONFIGURATION"

# Locally verified as NGINX 1.29.8 on Alpine 3.23.4; the digest makes the base immutable.
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6 AS runner
ENV NODE_ENV=production
USER root
RUN chown 101:101 /usr/share/nginx/html
COPY --chown=101:101 frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder --chown=101:101 /workspace/frontend/dist/startflow/browser/ /usr/share/nginx/html/
USER 101
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
