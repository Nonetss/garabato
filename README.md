# better

A Turborepo monorepo: an Astro frontend and a Hono/oRPC backend (TypeScript,
Bun) behind a Caddy gateway. It starts from the user's template
(`stack`) and keeps its packages
(`@nonete/*`), conventions and visual system, without the template's Python
services, gRPC or agent chat.

## Architecture

Browser → gateway (Caddy) → Astro frontend and Hono/oRPC backend →
PostgreSQL, with structured logs to Loki.

## Features

- **Astro + TailwindCSS** — SSR frontend with React islands and shadcn/ui (`base-nova` on Base UI)
- **Hono + oRPC** — type-safe RPC and OpenAPI endpoints (`/rpc/v1`, `/api/v1`), versioned routing, CSRF protection, admin-only API docs at `/scalar`
- **Better Auth** — email/password (plus optional OIDC), sessions, global admin role, organizations and teams with access control, API keys
- **Drizzle + PostgreSQL** — schema per domain; committed migrations applied automatically when the backend starts
- **Cron scheduler** — persistent jobs that run cron-eligible API procedures, managed at `/crons`
- **Comments and entity icons** — threaded comments and custom icons over any resource
- **Activity log** — pino logs shipped to Loki and browsable at `/admin/logs`
- **PWA** — installable, with a web manifest and a service worker
- **Bun + Turborepo** — package manager and monorepo task runner
- **Biome** — linting and formatting
- **OpenSpec** (`openspec/`) — spec-driven documentation of every capability

## Project Structure

```txt
better/
├── apps/
│   ├── frontend/       # Astro app (TypeScript, Bun)
│   ├── backend/        # Hono + oRPC API and cron scheduler (TypeScript, Bun)
│   └── gateway/        # Caddy: public HTTP entry point (not a workspace)
├── packages/           # Shared TypeScript libraries (bun workspaces, @nonete/*)
│   ├── api/            # oRPC contract + handlers, versioned per-feature
│   ├── auth/           # Better Auth config and permissions
│   ├── cron/           # Scheduler and cron job service
│   ├── db/             # Drizzle schema, migrations, seed
│   ├── env/            # @t3-oss/env-core validated env access
│   ├── logger/         # Shared pino logger (+ Loki stream)
│   └── config/         # Shared tsconfig base
├── openspec/           # Capability specs (openspec/specs) and change proposals
└── scripts/
    ├── setup-dev.sh    # Generates the local root .env with real secrets
    └── bootstrap.sh    # Interactive installer: .env + docker compose (prod)
```

Imports: `@nonete/<pkg>` between workspaces, `#…` subpath imports (each
package's `package.json` `imports`) inside a package, and `@/…` inside an app.

## Getting Started

Requirements: [Bun](https://bun.sh) 1.4.2, `openssl`, and Docker (for the
database, Loki and the containerized stacks).

```bash
bun install
bun run setup:dev   # writes the root .env with real secrets and the admin seed
```

The whole repo is configured from one `.env` at the repo root; every app,
package, script and compose file reads it. `.env.example` lists every variable
with its default. `setup:dev` leaves an existing `.env` untouched unless you
pass `--force`, and prints the admin credentials it generated.

### Database

`bun run db:start` starts PostgreSQL from `compose.dev.yml` on
`POSTGRES_PORT` (default `5432`), matching `DATABASE_URL` in `.env`. If that
port is taken on your machine, change both. There is no manual schema step: on
startup the backend applies the committed migrations from
`packages/db/src/migrations/` and creates the admin user from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. After changing the schema, generate a migration with
`bun run db:generate` and restart the backend.

### Run everything

```bash
bun run dev        # Docker dev stack with hot reload (database included); Ctrl+C stops
bun run dev:local  # the same apps natively through Turbo (start the db with `bun run db:start`)
```

- Frontend: [http://localhost:4321](http://localhost:4321)
- Backend API: [http://localhost:3000](http://localhost:3000) — API docs at [http://localhost:4321/scalar](http://localhost:4321/scalar) (admin session)
- Gateway (optional in dev, `bun run gateway`): [http://localhost:8080](http://localhost:8080), production-like routing in front of both apps

### Develop in Docker (hot reload)

```bash
bun run dev        # build, start and watch; Ctrl+C stops
bun run dev:down   # remove the dev containers
```

`compose.dev.yml` runs the frontend (`astro dev`), the backend (`bun --hot`)
and the gateway from `apps/*/Dockerfile.dev`, plus the `db` service. The apps
run on the host network and read the root `.env` unchanged, so they use the
same ports and `localhost` addresses as native dev. `docker compose watch`
copies your edits into the containers:

| You edit | What happens |
|---|---|
| `apps/*/src`, `packages/*/src`, `apps/frontend/public` | synced, hot reload picks it up |
| `apps/frontend/astro.config.mjs`, `apps/gateway/Caddyfile` | synced, that service restarts |
| `package.json`, `bun.lock` | the affected images rebuild |

- It uses the same ports as native dev (`4321`, `3000`, `8080`): run one or the other, not both.
- Host networking needs Linux (or Docker Desktop with host networking enabled).
- Requires Docker Compose ≥ 2.22 (`watch`).

## Deployment

### Docker Compose (local, builds from source)

- Config: `compose.yml` — builds `frontend`, `backend` and `gateway` from their own `apps/*/Dockerfile`, and runs `db` (PostgreSQL) and `loki`. Only the gateway publishes a port: the site is at `http://localhost:${FRONTEND_PORT:-4444}`.
- Build images: `bun run docker:build`
- Start: `bun run docker:up`
- Logs: `bun run docker:logs`
- Stop: `bun run docker:down`

Environment variables come from the root `.env` (`env_file:`), with
container-networking values (service hostnames, ports, the database URL)
overridden in the compose file.

### Docker Compose (production, prebuilt images)

- Config: `compose.prod.yml` — pulls the `better-frontend`, `better-backend` and `better-gateway` images (published by `.github/workflows/docker-build.yml` on pushes to `main`), plus `db` (Postgres) and `loki`
- Only the gateway publishes a port (`FRONTEND_PORT`, default `4444`): it serves the site and the backend API on one origin. A reverse proxy in front of the stack targets that port
- One `.env` next to `compose.prod.yml` supplies every service's configuration. It belongs to the deployment directory, not to a dev checkout

For a fresh server, `scripts/bootstrap.sh` is a standalone installer — it
prompts for the public URL and admin credentials, generates `.env`, downloads
`compose.prod.yml` if missing, and can start the stack:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/stack/main/scripts/bootstrap.sh | bash
```

Session cookies are `Secure`, so outside `localhost` the stack must be served
over https for sign-in to work.

## Checks and Formatting

- `bun run check` — Biome format + lint
- `bun run format` — Biome format only
- `bun run check-types` — TypeScript (tsc / astro check)
- `bun run test` — the `packages/api` unit tests (`bun test`)
- `bun run tailwind:check` — Tailwind class linting (`tailwint`)

There are no git hooks.

## Available Scripts

- `bun run dev`: Start the Docker dev stack with hot reload (`compose.dev.yml`); `dev:down` removes it
- `bun run dev:local`: Start all applications natively through Turbo
- `bun run dev:frontend` / `dev:backend`: Start a single app
- `bun run gateway`: Start the gateway in front of the native apps (`:8080`)
- `bun run build`: Build all applications
- `bun run setup:dev`: Generate the local root `.env`
- `bun run db:start` / `db:watch` / `db:stop` / `db:down`: The dev PostgreSQL container
- `bun run db:push` / `db:generate` / `db:migrate` / `db:studio`: Drizzle schema commands
- `bun run icons:catalog`: Regenerate the Lucide icon catalog used by the entity icon picker
- `bun run check` / `bun run format`: Biome formatting and linting
- `bun run test`: Unit tests
- `bun run tailwind:check` / `tailwind:fix`: Tailwind class linting
- `bun run docker:build` / `docker:up` / `docker:down` / `docker:logs`: Local Docker Compose (`compose.yml`)

## Documentation

Every capability (auth, admin, crons, logging, Docker, …) has a
spec under `openspec/specs/`; finished changes are kept in
`openspec/changes/archive/`. Read those for the authoritative description of
expected behavior before changing code in an area you're unfamiliar with;
`openspec validate --specs --strict` checks they stay well-formed.

- `AGENTS.md` — normative conventions for contributors and coding agents
- `.agents/skills/stack/` — the project skill: workspaces, commands, env, Docker, API layering and frontend structure
- `DESIGN.md` / `PRODUCT.md` — visual system and product context, used by the `impeccable` design skill
