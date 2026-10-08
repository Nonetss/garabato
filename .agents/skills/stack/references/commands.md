# Commands

Root scripts (`package.json`) go through Turbo (`turbo.json`) or `docker compose`.

## Develop

| Command | What it does |
|---|---|
| `bun run dev` | `docker compose -f compose.dev.yml up --build --watch`: the hot-reloading Docker dev stack, database included (see `docker.md`); `bun run dev:down` removes it. |
| `bun run dev:local` | Native dev: `turbo watch dev`, persistent; depends on `^build`. Needs the database (`bun run db:start`). Same host ports as the Docker dev stack, so only one runs at a time; never stop the user's running stack to start the other. |
| `bun run dev:frontend` / `dev:backend` | `turbo watch -F frontend dev` / `-F backend dev`. |
| `bun run gateway` | Runs only the gateway container (`apps/gateway/compose.yml`, host network, HTTP on `:8080`) in front of natively running apps, to try production-like routing. Optional: the normal dev URL is `astro dev` on `:4321`, whose proxy already forwards the API. |
| `bun run setup:dev` | `scripts/setup-dev.sh`: writes the root `.env` from `.env.example` with generated secrets and the admin seed (`--force` overwrites). |

Per package: backend `bun run --hot src/index.ts`; frontend `astro dev`.

## Dev database (`compose.dev.yml` `db` service)

| Command | What it does |
|---|---|
| `bun run db:start` | `docker compose -f compose.dev.yml up -d db`: Postgres 17 on `${POSTGRES_PORT:-5432}`, matching the default `DATABASE_URL`. |
| `bun run db:watch` | Same, in the foreground. |
| `bun run db:stop` / `db:down` | Stop it / remove the container (the `db_data` volume stays). |

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

`bun run test` — `turbo test`: runs every workspace `test` script; today only `packages/api` (`bun test`). Exits non-zero on any failure. One suite: `turbo run test --filter=@nonete/api`. See `testing.md`.

## Database migrations and Docker

- `bun run db:push | db:generate | db:migrate | db:studio` — filtered to `@nonete/db`. **The agent never runs these.** The backend applies pending migrations itself on startup.
- `bun run docker:build | docker:up | docker:down | docker:logs` — `docker compose` on root `compose.yml` (the production-like stack built from this checkout; `docker:up` is `up -d --build`). See `docker.md`.
