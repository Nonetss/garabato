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
COPY apps/site/package.json apps/site/
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
# tsdown bundles the workspace packages AND every npm dependency into
# dist/ (see tsdown.config.ts), so the runtime stage needs no node_modules.
RUN cd apps/backend && bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Bun is the only runtime (the app uses Bun.cron and Bun's `export default`
# serving); the compose healthchecks use `bun -e` too, so no Node is needed.
FROM oven/bun:${BUN_VERSION}-slim AS runtime
ENV NODE_ENV=production

# runMigrations() runs from the bundle's cwd (WORKDIR = apps/backend/) and
# resolves the migrations folder as ../../packages/db/src/migrations, so the
# repo layout below must match what the path expects at runtime.
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/packages/db/src/migrations /app/packages/db/src/migrations

EXPOSE 3000

WORKDIR /app/apps/backend
CMD ["bun", "dist/index.mjs"]
