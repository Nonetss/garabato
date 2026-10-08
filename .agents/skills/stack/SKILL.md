---
name: stack
description: Map and conventions of the stack monorepo. Covers which workspace owns what (apps/frontend, apps/backend, apps/gateway, packages/api, auth, config, cron, db, env, logger under the `@nonete/*` scope), path aliases (`@/` in apps, `#` subpath imports in packages), dependencies, root commands, env gotchas, tests and Docker (the hot-reloading dev stack with Loki, native dev, the external dev database, the production-like compose.yml and the registry compose.prod.yml); frontend structure (features and slices, barrels, pages, app-surfaces and site-nav, Astro layouts, typography with the `Text` roles, `Hint` bubbles on icon-only controls, container queries, entity icons); how to find an existing component, hook, helper or procedure before writing new code; packages/api layering (feature files, procedure builders, errors, pagination, HTTP methods and status codes, free-text search, versions); cron scheduling with `cronMeta`; and the TypeScript code style (no casts, no `??` chains or inline ternaries). Use before any code change in this repo, before choosing or writing a React/UI component, hook, helper or procedure, to find where code lives, which convention applies and how to validate it.
---

# Stack

This repo, `stack`, is the user's project. TypeScript only: Astro + Hono + oRPC + Better Auth + Drizzle/PostgreSQL + Biome + Turborepo, on Bun 1.4.2. The workspace packages keep the `@nonete/*` scope on purpose; never rename them.

## Mental model

```
browser ──▶ apps/gateway :80 (Caddy, only published port) ──rest──▶ apps/frontend (Astro SSR :4321)
                 │ /rpc/*, /api/*, /scalar*, /openapi.json                │ SSR session lookups
                 │ (dev: astro dev's proxy does the same)                 │ (BACKEND_URL)
                 ▼                                                        ▼
          apps/backend (Hono + oRPC on Bun, HTTP :3000) ◀──────────────────┘
           │  packages/api    (contract + handlers)
           │  packages/auth   (Better Auth)
           │  packages/cron   (in-process scheduler)
           │  packages/db     (Drizzle) ──▶ PostgreSQL (`db` service; dev: external server)
           │  packages/logger (pino)    ──▶ Loki (optional, LOKI_URL)
```

- `packages/api`, `auth`, `cron`, `db`, `env` and `logger` are consumed as **raw TS source** (no build step; their `build` script is `true`).
- `apps/gateway` (one Caddy, one HTTP site) is the only routing map: `/rpc/*`, `/api/*`, `/scalar*` and `/openapi.json` go to the backend, `/health` answers `ok`, everything else goes to the frontend. Only the gateway publishes a port in `compose.yml` and `compose.prod.yml` (`${FRONTEND_PORT:-4444}:80`); a new public route goes in its `routes.caddy`, never as a `ports` entry on another service. In dev, the gateway (`Caddyfile.dev`) serves `https://localhost:4321` (HTTP/2, local CA) in front of `astro dev` on `:4320`.
- Foundation features (admin/API-key/organization plugins, cron, comments, entity icons, activity log…) exist because they came with the foundation, not because the current task needs them.

## Where to look

Read only the references the task needs. A task crossing layers reads several (a new CRUD feature: `api/layering.md` + `frontend/feature-structure.md` + `frontend/navigation-and-layouts.md`).

### Workspaces, tooling and runtime

| Task touches | Read |
|---|---|
| Which workspace owns something, entrypoints, ports, what git tracks | `references/workspaces.md` |
| Running, building, type-checking, formatting, the dev database and Loki, Docker scripts | `references/commands.md` |
| Imports between files/packages (`@/`, `#…`), adding a dependency or workspace | `references/aliases-and-deps.md` |
| Env vars, auth URLs, cookies, proxies, middleware gating, oRPC handler plugins (error logging, body limit, SSE keep-alive), request ids | `references/env.md` |
| Writing or running tests, validating a change | `references/testing.md` |
| Any TypeScript code: casts, `??` chains, ternaries, generic defaults, `let` memoization — what is not allowed and what to write instead | `references/code-style.md` |
| Dockerfiles, compose files (dev stack, production-like, registry images), CI images | `references/docker.md` |

### Frontend (`apps/frontend`)

| Task | Read |
|---|---|
| Adding or moving a feature, slice, component, hook, model or definition; imports and barrels; `public.ts`; `*-page.tsx` / `*-content.tsx`; `components/ui` vs `components/shared`; providers; finding an existing component, hook or `src/lib` helper before writing one | `references/frontend/feature-structure.md` |
| Adding a route or navigation entry; `app-surfaces.ts` / `site-nav.ts`; the navbar surface search; choosing the Astro layout | `references/frontend/navigation-and-layouts.md` |
| Styling text: headings, labels, secondary copy, state tags, monospace data; the `Text` roles and tones, type tokens, adding a role | `references/frontend/typography.md` |
| Naming an icon-only button, link or menu trigger with a hover bubble; replacing a native `title` attribute | `references/frontend/hints.md` |
| Making a grid, list row or form layout responsive; choosing between container queries (`@container`, `@md:`) and viewport breakpoints (`sm:`, `lg:`) | `references/frontend/container-queries.md` |
| Letting users choose an icon and color for an entity (`IconPicker`, `EntityIconPicker`, `EntityIcon`, `entityIcon` API), enabling it for a new entity type, regenerating the Lucide catalog | `references/frontend/entity-icons.md` |

### API (`packages/api`)

| Task | Read |
|---|---|
| New feature or procedure; file split (`input`/`output`/`handler`/`router`); builders, access and errors; shared helpers and pagination; checking whether a procedure or helper already exists; adding an API version | `references/api/layering.md` |
| Choosing a procedure's HTTP `method` (`GET`/`QUERY`/`POST`/`PUT`/`PATCH`/`DELETE`) and `successStatus`, how `/rpc` sends reads as `QUERY`, or which `errors.<CODE>()` to throw (400 vs 403 vs 404 vs 409) | `references/api/http-semantics.md` |
| A `search` procedure or a free-text filter on a `list`; matching text across several tables; GIN trigram indexes (`pg_trgm`) and when they pay off | `references/api/free-text-search.md` |

### Cron

| Task | Read |
|---|---|
| Making a procedure cron-eligible or giving it a code-declared `cron.schedule`, the scheduler, job/run storage, cron endpoints, `/crons` frontend | `references/cron.md` |

## Always true

### Tooling
- **Validation** is `check-types` + Biome; `bun run test` runs the unit suites (`bun test` in `packages/api`, `packages/cron` and `apps/frontend`). Unit tests are hermetic: no database, network or running service; database code runs against the fake from `@nonete/db/testing` (`references/testing.md`).
- **Never** run `db:generate`/`db:push`/`db:migrate`, edit `packages/db/src/migrations/`, kill running processes, stop or restart the user's Docker stack, or probe the live app with curl or a browser unless the user asks in that moment.
- **Don't copy enumerations** (env vars, OpenSpec capabilities, procedures) — read their source files instead.
- Code, comments and log/internal error messages in English; UI copy and user-facing API error messages in Spanish.
- **No casts or fallback chains** in TypeScript: no `as`/`as unknown as`/`!`, no made-up generic defaults or `never[]` shapes, no `??` chains or `??` with a non-literal default, no ternaries nested or inside expressions, no `let` + `??=`. Narrow with guards, keep real types with `satisfies`, and write defaults as named functions with early returns (`references/code-style.md`). If a type still doesn't fit, ask before casting.

### Frontend
- Before writing a new UI component, hook or client-side helper, search what already exists: `src/components/ui`, `src/components/shared/<domain>`, the owning feature's slices, `src/hooks` and `src/lib` (`references/frontend/feature-structure.md`). Reuse or extend before creating.
- React components mounted from `.astro` use `client:only="react"`, never `client:load` or another `client:*`.
- Frontend-internal imports use `@/`, never relative paths.
- Product text uses `Text` (`components/shared/brand/typography.tsx`) with a semantic role and tone, or `textVariants({ role, tone })` on a component's `className`; never hand-built `text-xs text-muted-foreground` or `font-* text-label uppercase tracking-*` strings.
- In-page layouts (grids, list rows, form, metadata and filter field grids) respond to their container with `@container` + `@md:`/`@xl:`…; viewport variants (`sm:`, `lg:`) are only for app chrome, overlay sizes and page padding (`references/frontend/container-queries.md`).
- Icon-only controls are named visually with `Hint` (`components/shared/feedback/hint.tsx`), never with a native `title` attribute; the control keeps its `aria-label`.
- Route identity (title, label, description, icon, nav placement) is declared once in `apps/frontend/src/lib/app-surfaces.ts`, never hardcoded.
- A `*-page.tsx` holds only the provider boundary around `<XContent />`; the surface lives in `*-content.tsx`.

### API
- Before adding a procedure, read the routers under `packages/api/src/v1/*/router.ts` (their `summary`/`description`) for one that already covers the need, and reuse the helpers in `src/shared` and `src/lib` instead of writing new ones (`references/api/layering.md`).
- Router files are wiring only; business logic and `@nonete/db`/`@nonete/auth` calls live in `handler.ts`.
- Throw with `errors.<CODE>()` from `#errors`, never `new ORPCError(...)`.
- `.meta(openapi({...}))` declares the method the handler actually does: `GET` and `QUERY` never write (`QUERY` only when the input is an array of objects), reads called with `.call()` inside a custom `queryFn` pass `{ context: { read: true } }`, `PUT` for idempotent replacements and natural-key upserts, `PATCH` keeps omitted fields, `successStatus: 201` only on procedures that exist to create, never `204`. The error code names the cause, and `409` (not `400`/`403`) is for targets whose state or kind refuses everyone (`references/api/http-semantics.md`).
- Never set `access` meta by hand; the builder stamps it. `cron` is a typed meta plugin (`cronMeta(...)` from `#index`), passed in the same `.meta(...)` call as `openapi(...)`.
- oRPC is v2 (`2.0.0-beta.42`, pinned exactly in the root catalog), so the `orpc*` skills and the https://orpc.dev docs apply as written; https://v1.orpc.dev does not. Moving to another pre-release is a deliberate catalog change.
- Client calls and HTTP paths always carry the version (`orpc.v1.<feature>.<method>()`, `/rpc/v1/...`, `/api/v1/...`).

### Cron
- A cron-eligible or code-scheduled procedure key is persisted in `cron_job.handler_key`: never rename, move or strip eligibility without telling the user a data migration is needed. Code-declared (`source = 'code'`) jobs are written only by the startup sync.
- A `cronProcedure` is never reachable over HTTP. The scheduler is single-instance by design.
