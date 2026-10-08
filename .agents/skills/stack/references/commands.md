# Commands

Root scripts (`package.json`) go through Turbo (`turbo.json`) or `docker compose`.

## Develop

| Command | What it does |
|---|---|
| `bun run dev` | `docker compose -f compose.dev.yml up --build --watch`: the hot-reloading Docker dev stack, Loki included and no database (see `docker.md`); `bun run dev:down` removes it. |
| `bun run dev:local` | Native dev: `turbo watch dev`, persistent; depends on `^build`. Needs the external dev database in `DATABASE_URL` and `bun run gateway` for the dev URL `https://localhost:4321` (`astro dev` itself is on `:4320`); `bun run loki:start` for the activity log, and an object store for documents: `bun run minio:start` (or an external one in `S3_ENDPOINT`). Same host ports as the Docker dev stack, so only one runs at a time; never stop the user's running stack to start the other. |
| `bun run dev:frontend` / `dev:backend` | `turbo watch -F frontend dev` / `-F backend dev`. |
| `bun run gateway` | Runs only the dev gateway container (`apps/gateway/compose.yml`, host network, `Caddyfile.dev`) in front of natively running apps: the dev URL `https://localhost:4321` (local CA, HTTP/2). Required for native dev. |
| `bun run dev:cert` | Exports the dev gateway's local CA root (volume `stack-dev_gateway_data`) to `caddy-local-root.crt` (git-ignored), to import once in the browser as a trusted authority. The gateway must have started once. |
| `bun run setup:dev` | `scripts/setup-dev.sh`: writes the root `.env` from `.env.example` with generated secrets and the admin seed (`--force` overwrites). |

Per package: backend `bun run --hot src/index.ts`; frontend `astro dev`.

## Dev database and Loki

The repo runs no dev database: `DATABASE_URL` in `.env` points at a PostgreSQL outside the project, on another server.

| Command | What it does |
|---|---|
| `bun run loki:start` | `docker compose -f compose.dev.yml --profile native up -d loki-native`: only the dev Loki, on `127.0.0.1:3100`, for native dev (`loki:stop` stops it). |
| `bun run minio:start` | `docker compose -f compose.dev.yml --profile native up -d minio-native minio-native-init`: only the dev MinIO, on `127.0.0.1:9000` (console `:9001`), with its bucket, for native dev (`minio:stop` stops it). |
| `bun run loki:stop` | Stop it (the `loki_data` volume stays). |

## Build and validate

| Command | What it does |
|---|---|
| `bun run build` | `turbo build`: depends on `^build`; reads `.env*` as inputs; outputs `dist/**`, `.astro/**`. The `@nonete/*` packages build nothing (`"build": "true"`, no outputs). |
| `bun run check-types` | `tsc -b` in `apps/backend`, `packages/{cron,logger}`; `tsc --noEmit -p .` in `packages/{api,auth,db,env}`; `astro check` in the frontend. |
| `bun run check` | `biome check --write .` (format + lint + organize imports). |
| `bun run format` | `biome check --write --linter-enabled=false .` (format + organize imports, no lint). |
| `bun run tailwind:check` / `tailwind:fix` | `tailwint` over `apps/frontend`. |

Scope a check to one workspace: `bun run --filter <name> check-types` (e.g. `@nonete/api`, `backend`, `frontend`).

A package-specific task in root `turbo.json` (e.g. `@nonete/api#build`) does **not** inherit the generic task's `dependsOn`; restate it if needed.

## Codegen

`bun run icons:catalog` — regenerate the entity icon picker's Lucide catalog (needs network; commit the output). Run after upgrading `lucide-react` in `apps/frontend`. See `references/frontend/entity-icons.md`.

## Tests

`bun run test` — `turbo test`: runs every workspace `test` script: `packages/api`, `packages/cron` and `apps/frontend`, each with `bun test`. Exits non-zero on any failure. One suite: `turbo run test --filter=<workspace>` (`@nonete/api`, `@nonete/cron`, `frontend`). See `testing.md`.

## Database migrations and Docker

- `bun run db:push | db:generate | db:migrate | db:studio` — filtered to `@nonete/db`. **The agent never runs these.** The backend applies pending migrations itself on startup.
- `bun run docker:build | docker:up | docker:down | docker:logs` — `docker compose` on root `compose.yml` (the production-like stack built from this checkout; `docker:up` is `up -d --build`). See `docker.md`.
