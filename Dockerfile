# syntax=docker/dockerfile:1.7
# Shared pnpm monorepo build — Railway build context = repo root.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Match local lockfile tooling (pnpm 9 rejects overrides written by pnpm 12).
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY patches ./patches
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
COPY attached_assets ./attached_assets

# Placeholder only for packages that read DATABASE_URL at import/config time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV NODE_ENV=production

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

ENV PORT=5001
ENV BASE_PATH=/
RUN pnpm --filter @workspace/rms run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
ENV STATIC_DIR=/app/public

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate \
  && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/patches ./patches
COPY --from=build /app/lib ./lib
COPY --from=build /app/artifacts/api-server ./artifacts/api-server
COPY --from=build /app/artifacts/rms/package.json ./artifacts/rms/package.json
COPY --from=build /app/artifacts/rms/dist/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
