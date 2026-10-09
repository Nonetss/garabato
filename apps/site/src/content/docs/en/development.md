---
title: Development
description: Run the monorepo locally, run the checks and find your way around the code.
order: 8
---

Garabato is a Bun and Turborepo monorepo, TypeScript only. You need [Bun](https://bun.sh) 1.4.2, `openssl`, Docker with Compose 2.22 or newer, and a PostgreSQL for development that lives outside the project.

## Run it locally

```bash
bun install
bun run setup:dev   # writes the root .env with real secrets and the admin seed
```

`setup:dev` prints the admin credentials it generated. Then point `DATABASE_URL` in `.env` at your development PostgreSQL. The whole repo reads that one `.env`; [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example) documents every variable.

There are two equivalent ways to run it. They share ports, so run one or the other:

```bash
bun run dev         # the Docker dev stack with hot reload; Ctrl+C stops
bun run dev:local   # the apps natively through Turbo, plus `bun run gateway`
```

In native mode, `bun run minio:start` starts a local MinIO for the documents and `bun run loki:start` the activity log.

The app is at <https://localhost:4321>, the dev gateway (HTTPS and HTTP/2 with a local certificate authority). It routes exactly like production. `bun run dev:cert` exports the gateway's root certificate so you can trust it in the browser once.

There is no manual database step: the backend applies the committed migrations and creates the admin on startup.

## Checks

```bash
bun run check-types      # TypeScript and astro check
bun run check            # Biome lint and format
bun run test             # unit tests (bun test)
bun run tailwind:check   # Tailwind class linting
```

The unit tests are hermetic: no database, network or running service.

## Repository layout

```text
apps/
  frontend/   Astro SSR + React interface
  backend/    Hono + oRPC API and the cron scheduler
  gateway/    Caddy: the public entry point
  site/       This website
packages/
  api/        oRPC contract and handlers, versioned under v1
  auth/       Better Auth configuration
  cron/       Scheduler and cron job service
  db/         Drizzle schema, migrations and seed
  env/        Validated environment variables
  logger/     Shared pino logger
  config/     Shared tsconfig
doc/          Human documentation (Spanish), diagrams and screenshots
openspec/     Capability specs and change proposals
scripts/      setup-dev.sh and the bootstrap installer
```

## This website

The site lives in `apps/site` (Astro, static output) and is published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main` that touches it. Pages are Markdown files under `apps/site/src/content/docs/<lang>/`.

```bash
bun run --filter site dev
```

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/Nonetss/garabato). Changes go through OpenSpec, and commits follow Conventional Commits.
