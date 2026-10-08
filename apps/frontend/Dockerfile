# Keep in sync with "packageManager" in the root package.json.
ARG BUN_VERSION=1.4.2

# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS build
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

# Manifests first: the install layer below stays cached until a
# package.json or the lockfile changes. Every workspace package.json
# must be present or --frozen-lockfile rejects the install.
COPY package.json bun.lock bunfig.toml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/cron/package.json packages/cron/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/logger/package.json packages/logger/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
# vite.ssr.noExternal (astro.config.mjs) bundles every dependency into
# dist/server, so the runtime stage needs no node_modules.
RUN cd apps/frontend && bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Bun runs the Astro standalone server and the compose healthcheck. The
# gateway (apps/gateway) is the public entry point: it proxies /rpc, /api,
# /scalar and /openapi.json to the backend and everything else here.
FROM oven/bun:${BUN_VERSION}-slim AS runtime
ENV NODE_ENV=production

COPY --from=build /app/apps/frontend/dist /app/apps/frontend/dist

# Reachable only inside the Docker network (compose `expose`, never `ports`)
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321
CMD ["bun", "/app/apps/frontend/dist/server/entry.mjs"]
