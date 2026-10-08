# stack

**A project template.** A Turborepo monorepo with an Astro frontend and a
Hono/oRPC backend (TypeScript, Bun) behind a Caddy gateway, on PostgreSQL,
ready to be cloned as the starting point of a new project. It derives from
the original `stack` template and keeps its packages (`@nonete/*`),
conventions and visual system, so code can move between projects unchanged. It
leaves out the original's Python services, gRPC and agent chat.

A new project starts with a working foundation (auth, admin panel, typed API,
cron scheduler, comments, entity icons, activity log, Docker) before any
product code exists. Those features are there because they come with the
template, not because every product needs them: use what fits, and remove
what doesn't on purpose.

The code is in English; the UI copy and the API error messages users see are
in Spanish.

## Start a new project from this template

Clone the template under your project's name and detach it from the template
repository, so the new project gets its own history from here on:

```bash
git clone https://github.com/Nonetss/stack.git my-project
cd my-project
git remote rm origin
```

Then point it at the new project's repository, if it already has one, and
set it up as described in [Getting Started](#getting-started):

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

## How it fits together

```txt
browser ──▶ gateway (Caddy, the only published port)
              │  /rpc/*, /api/*, /scalar*, /openapi.json ──▶ backend  (Hono + oRPC on Bun, :3000)
              │  /health ──▶ "ok"                              │ packages/api   contract + handlers
              │  everything else ──▶ frontend (Astro SSR, :4321)│ packages/auth  Better Auth
              │                        │                       │ packages/cron  in-process scheduler
              │                        └─ SSR session lookups ─┤ packages/db    Drizzle ──▶ PostgreSQL
              │                           (BACKEND_URL)        │ packages/logger pino  ──▶ Loki (optional)
```

- **One origin.** The gateway serves the site and the API from the same host,
  so the browser never makes cross-origin calls and session cookies just work.
  It is the only place that maps paths to apps; a new public route goes in
  `apps/gateway/Caddyfile`, never as a published port on another service.
- **In dev without the gateway**, `astro dev` proxies the same backend paths,
  so `http://localhost:4321` behaves like production.
- **The backend owns the database.** On startup it applies the committed
  migrations, seeds the admin user and starts the cron scheduler.
- **Shared packages are raw TypeScript.** `packages/*` have no build step;
  apps import their source directly.

## Features

- **Astro + TailwindCSS**: SSR frontend with React islands and shadcn/ui (`base-nova` on Base UI), light/dark/system theme
- **Hono + oRPC**: type-safe RPC and OpenAPI endpoints (`/rpc/v1`, `/api/v1`), versioned routing, CSRF protection, admin-only API docs at `/scalar`
- **Better Auth**: email/password (plus optional OIDC), sessions, global admin role, organizations and teams with access control, API keys
- **Drizzle + PostgreSQL**: schema per domain; committed migrations applied automatically when the backend starts
- **Cron scheduler**: persistent jobs that run cron-eligible API procedures, managed at `/crons`
- **Comments and entity icons**: threaded comments and custom icons over any resource
- **Activity log**: pino logs shipped to Loki and browsable at `/admin/logs`
- **PWA**: installable, with a web manifest and a service worker
- **Bun + Turborepo**: package manager and monorepo task runner
- **Biome**: linting and formatting
- **OpenSpec** (`openspec/`): spec-driven documentation of every capability

## What's in the app

Every page except login and signup requires a session.

| Route | What it is |
|---|---|
| `/` | Home |
| `/login`, `/signup` | Sign in and create an account (email/password, plus OIDC when configured) |
| `/me` | The signed-in user's account: name, email, role, changing the name and password |
| `/config/profile`, `/config/appearance` | Profile settings and theme |
| `/crons`, `/crons/[id]` | Cron jobs: list, create and edit, run history with live updates, comments on runs |
| `/admin/*` | Admin only: users, sessions, organizations, teams, API keys, Better Auth plugins and the activity log |
| `/scalar` | Interactive API docs (admin session) |

The navbar search (`⌘K` / `Ctrl+K`) jumps to any page and, once you type, to
individual records such as cron jobs.

## The API

`packages/api` holds the oRPC router, mounted by the backend twice:

- **`/rpc/v1/...`**: the RPC protocol the frontend uses through its typed
  client (`orpc.v1.<feature>.<method>()`). Reads go out as `QUERY`, writes as
  `POST`.
- **`/api/v1/...`**: the same procedures as plain HTTP (OpenAPI), for scripts
  and other services. The document is at `/openapi.json` and the docs at
  `/scalar`.

Each feature lives in `packages/api/src/v1/<feature>/` split into `input.ts`,
`output.ts`, `handler.ts` and `router.ts`. The v1 features are `health`,
`private`, `authConfig`, `apiKey`, `organization`, `plugins`,
`sessionHistory`, `logs`, `cron`, `comment` and `entityIcon`.

Every procedure is built from one of five builders, which decide who may call
it: `publicProcedure`, `protectedProcedure` (any signed-in user),
`adminProcedure` (global `admin` role), `permissionProcedure` (an
organization permission) and `cronProcedure` (only the scheduler, never over
HTTP). Callers authenticate with the session cookie, a Bearer token or an
`x-api-key` header.

## Auth and access

- **Better Auth** (`packages/auth`) handles sign-up, sign-in and sessions, with
  the `admin`, `organization` (teams and dynamic access control) and
  `api-key` plugins. Generic OIDC sign-in is enabled when its three env vars
  are set.
- **Global admin**: users with the `admin` role see `/admin` and the API docs.
  The first admin is created on backend startup from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` (idempotent by email).
- **Organizations** carry their own roles and permissions, checked by
  `permissionProcedure`.

## Cron jobs

`packages/cron` is an in-process scheduler that runs inside the backend. A job
calls an API procedure that is marked cron-eligible, with a payload, on a cron
expression, impersonating the user who owns it.

- **Code-declared jobs**: a procedure can declare its own schedule in its
  `cronMeta`. They are synced on startup, run as the seeded admin and are
  read-only in the UI.
- **Manual jobs**: created by admins at `/crons`, choosing a handler and
  filling in a form generated from its input schema.
- Each run is stored with its result or error, and the detail page follows
  runs live over SSE.

The scheduler is single-instance by design: run one backend replica.

## Logging

`packages/logger` gives every workspace the same pino logger: pretty output in
dev, JSON lines in production. Every HTTP request gets a request id that all
its log lines carry. When `LOKI_URL` is set, backend API calls and frontend
page views are also shipped to Loki and become browsable at `/admin/logs`.

## Project Structure

```txt
stack/
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
├── doc/                # Human documentation (Spanish) with diagrams
├── openspec/           # Capability specs (openspec/specs) and change proposals
└── scripts/
    ├── setup-dev.sh    # Generates the local root .env with real secrets
    └── bootstrap.sh    # Interactive installer: .env + docker compose (prod)
```

The frontend groups code by domain under `apps/frontend/src/features/<domain>/`
(one folder per use case: `overview`, `detail`…), with reusable UI in
`src/components/ui` (shadcn) and `src/components/shared`. Page identity
(title, label, icon, nav placement) is declared once in
`src/lib/app-surfaces.ts`.

Imports: `@nonete/<pkg>` between workspaces, `#…` subpath imports (each
package's `package.json` `imports`) inside a package, and `@/…` inside an app.

## Getting Started

Requirements: [Bun](https://bun.sh) 1.4.2, `openssl`, Docker (for Loki and the
containerized stacks) and a PostgreSQL database for development (see
[Database](#database)).

```bash
bun install
bun run setup:dev   # writes the root .env with real secrets and the admin seed
```

### Configuration

The whole repo is configured from one `.env` at the repo root; every app,
package, script and compose file reads it, and `packages/env` validates it on
startup. `.env.example` documents every variable with its default. The ones
that matter most:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Better Auth base URL and signing secret |
| `CORS_ORIGIN` | The public origin the browser uses |
| `BACKEND_URL` | Where the frontend reaches the backend |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin seeded on startup |
| `OIDC_*` | Optional OIDC sign-in |
| `LOKI_URL` | Optional activity log shipping |

`setup:dev` leaves an existing `.env` untouched unless you pass `--force`, and
prints the admin credentials it generated.

### Database

The repo runs no database in development. Use a dev PostgreSQL that lives
outside the project, on another server, and point `DATABASE_URL` in `.env` at
it: native dev and the Docker dev stack share it, and it survives removing the
dev containers. There is no manual schema step: on
startup the backend applies the committed migrations from
`packages/db/src/migrations/` and creates the admin user from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. After changing the schema in `packages/db/src/schema/`,
generate a migration with `bun run db:generate`, review it, commit it and
restart the backend.

### Run everything

```bash
bun run dev        # Docker dev stack with hot reload (Loki included); Ctrl+C stops
bun run dev:local  # the same apps natively through Turbo (start Loki with `bun run loki:start`)
```

- Frontend: [http://localhost:4321](http://localhost:4321)
- Backend API: [http://localhost:3000](http://localhost:3000); API docs at [http://localhost:4321/scalar](http://localhost:4321/scalar) (admin session)
- Gateway (optional in dev, `bun run gateway`): [http://localhost:8080](http://localhost:8080), production-like routing in front of both apps

### Develop in Docker (hot reload)

```bash
bun run dev        # build, start and watch; Ctrl+C stops
bun run dev:down   # remove the dev containers
```

`compose.dev.yml` runs the frontend (`astro dev`), the backend (`bun --hot`)
and the gateway from `apps/*/Dockerfile.dev`, plus `loki` on
`localhost:3100` (the `LOKI_URL` in `.env.example`) so `/admin/logs` works in
development. There is no database service: the backend uses the external dev
PostgreSQL in `DATABASE_URL`. The apps run on the host network and read the
root `.env` unchanged, so they use the same ports and `localhost` addresses as
native dev. `docker compose watch`
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

- Config: `compose.yml` builds `frontend`, `backend` and `gateway` from their own `apps/*/Dockerfile`, and runs `db` (PostgreSQL) and `loki`. Only the gateway publishes a port: the site is at `http://localhost:${FRONTEND_PORT:-4444}`.
- Build images: `bun run docker:build`
- Start: `bun run docker:up`
- Logs: `bun run docker:logs`
- Stop: `bun run docker:down`

Environment variables come from the root `.env` (`env_file:`), with
container-networking values (service hostnames, ports, the database URL)
overridden in the compose file.

### Docker Compose (production, prebuilt images)

- Config: `compose.prod.yml` pulls the `ghcr.io/nonetss/stack-{frontend,backend,gateway}:main` images, plus `db` (Postgres) and `loki`
- Images are built by `.github/workflows/docker-build.yml` on pushes to `main`, which rebuilds only the images whose code changed and pushes them to the GitHub Container Registry
- Only the gateway publishes a port (`FRONTEND_PORT`, default `4444`): it serves the site and the backend API on one origin. A reverse proxy in front of the stack targets that port
- One `.env` next to `compose.prod.yml` supplies every service's configuration. It belongs to the deployment directory, not to a dev checkout

For a fresh server, `scripts/bootstrap.sh` is a standalone installer: it
prompts for the public URL and admin credentials, generates `.env`, downloads
`compose.prod.yml` if missing, and can start the stack:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/stack/main/scripts/bootstrap.sh | bash
```

Session cookies are `Secure`, so outside `localhost` the stack must be served
over https for sign-in to work.

## Checks and Formatting

- `bun run check`: Biome format + lint
- `bun run format`: Biome format only
- `bun run check-types`: TypeScript (tsc / astro check)
- `bun run test`: the `packages/api` unit tests (`bun test`, no database or network needed)
- `bun run tailwind:check`: Tailwind class linting (`tailwint`)

There are no git hooks.

## Available Scripts

- `bun run dev`: Start the Docker dev stack with hot reload (`compose.dev.yml`); `dev:down` removes it
- `bun run dev:local`: Start all applications natively through Turbo
- `bun run dev:frontend` / `dev:backend`: Start a single app
- `bun run gateway`: Start the gateway in front of the native apps (`:8080`)
- `bun run build`: Build all applications
- `bun run setup:dev`: Generate the local root `.env`
- `bun run loki:start` / `loki:stop`: Only the dev Loki container, for native dev
- `bun run db:push` / `db:generate` / `db:migrate` / `db:studio`: Drizzle schema commands
- `bun run icons:catalog`: Regenerate the Lucide icon catalog used by the entity icon picker
- `bun run check` / `bun run format`: Biome formatting and linting
- `bun run test`: Unit tests
- `bun run tailwind:check` / `tailwind:fix`: Tailwind class linting
- `bun run docker:build` / `docker:up` / `docker:down` / `docker:logs`: Local Docker Compose (`compose.yml`)

## Working on the repo

- **Spec first.** Changes go through OpenSpec: `openspec new change <name>`,
  then proposal → specs and design → tasks → implementation, and finally the
  specs are synced and the change archived (`/opsx:propose`, `/opsx:apply`,
  `/opsx:archive` in Claude Code).
- **Commits** follow Conventional Commits: `type(scope): short imperative summary`
  (`feat(frontend): …`, `fix(api): …`, `docs(openspec): …`).
- **Migrations** are generated, reviewed and committed by hand; coding agents
  never generate or edit them.
- **Before writing** a component, hook or procedure, look for an existing one
  in `components/ui`, `components/shared`, `src/hooks`, `src/lib` and the API
  routers.

## Documentation

**Start with [`doc/`](doc/README.md).** It is the human-oriented guide to how
the project works, written in Spanish: architecture, local development,
configuration, the API, auth, the frontend, cron jobs, Docker and the
conventions, with diagrams. The rest of this section lists the reference
material it builds on.

Every capability (auth, admin, crons, logging, Docker, …) has a
spec under `openspec/specs/`; finished changes are kept in
`openspec/changes/archive/`. Read those for the authoritative description of
expected behavior before changing code in an area you're unfamiliar with;
`openspec validate --specs --strict` checks they stay well-formed.

- `doc/`: the human documentation (Spanish), one file per topic
- `AGENTS.md`: normative conventions for contributors and coding agents
- `.agents/skills/stack/`: the project skill (workspaces, commands, env, Docker, API layering and frontend structure)
- `DESIGN.md` / `PRODUCT.md`: visual system and product context, used by the `impeccable` design skill
