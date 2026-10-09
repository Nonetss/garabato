# Workspaces

Bun workspaces are `apps/*` and `packages/*` (root `package.json`). `bunfig.toml` sets `linker = "isolated"`. `apps/gateway` has no `package.json`, so it is not a workspace.

## Apps

### `apps/frontend`
- Astro 7 SSR (`@astrojs/node` standalone), React 19 islands, Tailwind v4 via Vite plugin, shadcn/ui (`base-nova` style on Base UI, neutral, lucide icons; `components.json`), TanStack Query + oRPC (`src/lib/orpc.ts`).
- Dev `astro dev` on `:4320` (`dev` script, `strictPort`), behind the dev gateway's `https://localhost:4321`. It still proxies `/rpc`, `/api`, `/scalar`, `/openapi.json` → `BACKEND_URL` (default `http://localhost:3000`) for direct hits, but sign-in only works on the gateway origin. In the Docker dev stack it listens on `0.0.0.0:4320` inside its container (`expose`, never `ports`). In production Docker, Astro alone listens on `0.0.0.0:4321` (compose `expose`, never `ports`) and `apps/gateway` serves it, plus the backend API, on the public port.
- Check `astro check`. Unit tests (`bun test` + happy-dom + Testing Library) in `tests/`, outside `src/`; no end-to-end suite.
- Middleware `src/middleware.ts` gates auth; layouts in `src/layouts/`; pages in `src/pages/`; features in `src/features/<domain>/`; providers in `src/providers/`; route identity in `src/lib/app-surfaces.ts`.
- PWA: `public/manifest.webmanifest` and the service worker `public/sw.js`, registered by `src/layouts/service-worker.astro` (included by `Layout.astro` and `Admin.astro`) in production builds only. In dev that component unregisters any worker and deletes its cache, because the worker would intercept every unbundled Vite module.
- `scripts/generate-icon-catalog.ts` regenerates the entity icon picker's Lucide catalog (`bun run icons:catalog`, see `frontend/entity-icons.md`).

### `apps/backend`
- Hono 4 + oRPC on Bun. HTTP only, `:3000` (`Bun.serve` without a `port`, so `PORT` or else 3000).
- Served explicitly with `Bun.serve({ id: "backend", fetch: app.fetch })` — there is no `export default app`.
- Entrypoint `src/index.ts`: `seed(auth)` from `@nonete/db/seed` applies migrations and seeds the admin, then `startCron()` (`src/cron/index.ts`) starts the scheduler and syncs code-declared jobs.
- On `SIGINT`/`SIGTERM` it shuts down in order — cron run-event streams → HTTP (5 s drain, then open connections are cut) → cron → database pool — under an 8 s hard timeout.
- `bun --hot` re-executes `src/index.ts` on every change; bootstrap, signal handlers and the server handle are guarded on `globalThis` for that reason. `apps/backend/turbo.json` marks `dev` as interruptible so `turbo watch` can restart it.
- Routers `src/routers/{auth,docs,rpc}.ts` (+ `handler-plugins.ts`), middlewares `src/middlewares/{auth,request-logger}.ts`, cron wiring `src/cron/{index,run-as}.ts`. `GET /` returns `OK` for healthchecks.
- Dev `bun run --hot src/index.ts`. Build `tsdown` → `dist/index.mjs`; `deps.alwaysBundle` inlines every dependency because the runtime image ships no `node_modules`. Check `tsc -b`.

### `apps/site`
- The project website, a static Astro 7 build (`output: "static"`, Tailwind v4, no React, no API) published to GitHub Pages at `https://nonetss.github.io/garabato/` by `.github/workflows/pages.yml`. It has nothing to do with the running app: no auth, no backend, no Docker image, and the gateway never serves it.
- `base: "/garabato"` with `trailingSlash: "always"`; every internal link goes through `href()` / `localized()` in `src/lib/url.ts`. English at the root, Spanish under `/es/` (`src/i18n/ui.ts` holds every landing string for both).
- Landing (`src/components/Landing.astro`: hero, screenshot tour, architecture, install) plus a docs collection, one Markdown file per page and language in `src/content/docs/<lang>/<slug>.md` (frontmatter `title`, `description`, `order`).
- The tour reuses the README's screenshots from the repo root `doc/screenshots/` (`src/lib/screens.ts`). Every screen ships as a pair, `<name>.webp` and `<name>-dark.webp` (its `dark` field): the frame and the lightbox show the one for the site's `.dark` theme, and the README shows the same pair with `<picture>` and `prefers-color-scheme`; the design tokens and faces mirror `apps/frontend/src/styles/global.css`, and `src/components/Logo.astro` is the app's mark.
- Dev `astro dev --port 4322` (`bun run dev:site`). Check `astro check`.

### `apps/gateway` (not a workspace)
- Docker assets only: `routes.caddy`, `Caddyfile`, `Caddyfile.dev`, `Dockerfile` (`caddy:2-alpine`, copies the three into `/etc/caddy`, runs `Caddyfile`), and a dev `compose.yml` (host network for the native apps, `localhost` upstreams, runs `Caddyfile.dev`) started by `bun run gateway`. `routes.caddy` is the only place that maps requests to apps.
- `routes.caddy`, the site body every site imports (zstd/gzip, security headers): `/health` answers `ok` (the compose healthcheck); `/rpc/*`, `/api/*`, `/scalar*`, `/openapi.json` → `BACKEND_HTTP_UPSTREAM` (`backend:3000`); everything else → `FRONTEND_HTTP_UPSTREAM` (`frontend:4321`).
- `Caddyfile` (production): one HTTP site, `:{$GATEWAY_HTTP_PORT:80}` (`h1`/`h2c`, `admin off`, `auto_https off`).
- `Caddyfile.dev` (dev only): one site, `https://localhost:4321` (`tls internal`, `h1`/`h2`), the dev URL and the only port dev exposes; `auto_https disable_redirects`, `skip_install_trust`. Its CA lives in `/data` (volume `stack-dev_gateway_data`, shared by both dev compose files); `bun run dev:cert` exports the root.
- It is the only service with `ports` on a public interface in `compose.yml` and `compose.prod.yml`; the only other `ports` entry is the bundled MinIO console on `127.0.0.1:9001`.

`NODE_ENV` defaults to `development`; `production` (set by the compose files and Dockerfiles) switches logging to JSON lines. Logs go to stdout, and also to Loki when `LOKI_URL` is set.

## TypeScript packages

| Package | Role |
|---|---|
| `packages/api` (`@nonete/api`) | oRPC contract and handlers. Builders in `src/index.ts`, shared `context.ts`/`errors.ts`, `shared/`, `lib/`, top-level `router.ts` nesting `src/v1/router.ts`. Subpath exports for `"./*"`. Unit tests (`bun test`) in `tests/`, outside `src/`. See `references/api/layering.md`. |
| `packages/auth` (`@nonete/auth`) | Better Auth factory `createAuth()` / `auth`, using the shared `db`. Plugins `admin()`, `apiKey({ enableSessionForAPIKeys: true })`, `organization()` (teams, access control, dynamic roles) and `genericOAuth` (`src/oauth.ts`, only when `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_DISCOVERY_URL` are set). `src/permissions.ts` holds `appStatements` and the `owner`/`admin`/`member` roles; `src/session.ts` exposes `createUserSession()` (used by cron to run jobs as a user). |
| `packages/db` (`@nonete/db`) | Drizzle ORM (1.0 RC, `node-postgres`). One shared pool per process: `db`, closed with `closeDb()`; `createDb()` is only called to build `db`. Schema per domain in `src/schema/<domain>/` (`auth`, `comment`, `cron`, `entity-icon`), relations in `src/relations.ts`, `src/keyset-pagination.ts`, `src/seed/` (migrations + admin seed), `src/migrations/`. Drizzle CLI scripts live here only. Test support (fake `db` and row factories) in `testing/`, exported as `@nonete/db/testing` and used only by test suites. |
| `packages/cron` (`@nonete/cron`) | oRPC-agnostic scheduler on `Bun.cron` (UTC only) plus the CRUD service over `cron_job`/`cron_run` and the code-declared job sync. Wired to the API in `apps/backend/src/cron`. Unit tests (`bun test`) in `tests/`, outside `src/`. |
| `packages/logger` (`@nonete/logger`) | pino factory (`@nonete/logger/factory`, used by the frontend's `src/lib/logger.ts`) and the backend `logger` / `child()`. Ships to Loki when `LOKI_URL` is set. |
| `packages/env` (`@nonete/env`) | `@t3-oss/env-core`: `@nonete/env/server` and `@nonete/env/web`. See `references/env.md`. |
| `packages/config` (`@nonete/config`) | Shared `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `types: ["bun"]`). |

## Docs and design

- `README.md` (English) is the human overview; `AGENTS.md` holds the hard rules for agents (`CLAUDE.md` only imports it); `PRODUCT.md` (Spanish) is the product context.
- `DESIGN.md`, `PRODUCT.md` and `.impeccable/` feed the Impeccable design skill.
- OpenSpec lives in `openspec/`: one spec per capability in `openspec/specs/<capability>/spec.md` (list them with `openspec list --specs`); finished changes are in `openspec/changes/archive/`.

## What git tracks (vs `.gitignore`)

- `.env` and `.env*.local` are ignored; `.env.example` is tracked.
- `.vscode/*` is ignored except `settings.json`, `tasks.json`, `launch.json` and `extensions.json`.
- Of the agent folders only `.claude/settings.local.json`, `.claude.lock` and `.agents.lock` are ignored; `.agents/skills/<name>/` holds the skills and `.claude/skills/<name>` symlinks to them (`../../.agents/skills/<name>`).
- `.github/*` is ignored except `.github/workflows/`.
- Drizzle migrations in `packages/db/src/migrations/` use the drizzle-kit ≥ 0.31 folder format (`<timestamp>_<name>/migration.sql` + `snapshot.json`).
