FROM node:22.14.0-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
COPY backend/package.json backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./backend/
RUN pnpm install --frozen-lockfile

COPY packages/contracts ./packages/contracts
COPY backend ./backend
RUN pnpm --filter @startflow/contracts build \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @startflow/backend prisma:generate \
  && pnpm --filter @startflow/backend build

FROM node:22.14.0-alpine AS production

ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable \
  && addgroup -S startflow \
  && adduser -S startflow -G startflow

COPY --from=builder --chown=startflow:startflow /app /app
RUN chmod +x /app/backend/entrypoint.sh
USER startflow
EXPOSE 3001

ENTRYPOINT ["/app/backend/entrypoint.sh"]
CMD ["node", "backend/dist/main.js"]
