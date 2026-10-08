# Environment and runtime

## One file: the root `.env`

- The repo is configured from a single `.env` at the repo root, documented by the root `.env.example`, which lists every variable with its default. That file is the source of truth for names and meanings: read it, don't copy it. There are no `apps/*/.env` or `packages/*/.env` (`scripts/setup-dev.sh` warns about leftover `apps/*/.env` files). `scripts/setup-dev.sh` writes the root `.env` from the example with real secrets.
- **Loading rule**: every reader opens `../../.env` relative to its working directory. Every workspace sits two levels below the root, and turbo and `bun --filter` run scripts from it. A variable already set in the process environment wins over the file. A missing file is not an error, which is the case in containers: compose provides their variables. A workspace script started from another directory (e.g. `bun apps/backend/src/index.ts` from the root) won't find the file.
- **Who loads it**:
  - `packages/env/src/server.ts` (backend and TS packages);
  - `packages/db/drizzle.config.ts`;
  - `apps/frontend/astro.config.mjs` (dotenv for the config itself, plus `vite.envDir` for `astro:env`).
- **Validation**: `packages/env/src/server.ts` (`@nonete/env/server`); `packages/env/src/web.ts` (`@nonete/env/web`, which validates `PUBLIC_SERVER_URL`; nothing imports it today); the frontend's server-side `astro:env` schema in `apps/frontend/astro.config.mjs` (`BACKEND_URL`, `LOKI_URL`).
- A new variable goes into its reader's schema and into the root `.env.example`, in the matching section, in the same change. When `packages/env/src/server.ts` gains a required variable, `packages/api/tests/setup.ts` gets a placeholder too (`testing.md`).

## Gotchas

- **One name per meaning.** Never introduce a second name for an existing concept:
  - `BACKEND_URL`: how the frontend reaches the backend (SSR session lookups and the dev server's proxy).
  - `BETTER_AUTH_URL`: Better Auth's base URL, read only by the backend. It is the public origin the browser uses (the same value as `CORS_ORIGIN`), never the backend's own address: OAuth/OIDC redirect URIs are built from it (`<BETTER_AUTH_URL>/api/auth/callback/<provider>`). Dev (native and Docker): `https://localhost:4321`, the dev gateway's HTTPS site, never `astro dev`'s own `:4320`.
  - `CORS_ORIGIN`: the public origin the browser uses (CORS and Better Auth's trusted origin), also in a production `.env`.
  - `DATABASE_URL`: the only database setting the apps read.
  - `NODE_ENV`: the runtime environment.
- **Container addresses** are overridden in the compose files' `environment`, never in `.env`:
  - `compose.yml`: frontend `BACKEND_URL=http://backend:3000`, `LOKI_URL=http://loki:3100`, `NODE_ENV=production`; backend `DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@db:5432/stack`, `BETTER_AUTH_URL` and `CORS_ORIGIN` both `http://localhost:${FRONTEND_PORT:-4444}`, `LOKI_URL`, `NODE_ENV`.
  - `compose.prod.yml`: the same service addresses; `DATABASE_URL`, `BETTER_AUTH_SECRET` and `CORS_ORIGIN` come from the deployment's `.env`, and `BETTER_AUTH_URL` is set to `${CORS_ORIGIN}`.
  - `compose.dev.yml` runs the apps on its private network (only the gateway publishes `4321`) and overrides only container addresses: frontend `BACKEND_URL=http://backend:3000`; frontend and backend `LOKI_URL=http://loki:3100`. Everything else comes from the root `.env`, which keeps the `localhost` values native dev uses. It runs no database: `DATABASE_URL` points at the dev PostgreSQL outside the project, on another server (`.env.example` holds a placeholder host). Native dev's Loki (`loki-native`, `bun run loki:start`) is published on `127.0.0.1:3100`, the default `LOKI_URL`.
- **A production `.env` is a different file.** `scripts/bootstrap.sh` writes it in the deployment directory, next to `compose.prod.yml` (which it downloads if missing), with single-quoted values: `FRONTEND_PORT`, `CORS_ORIGIN` (the public URL), `POSTGRES_PASSWORD`, `DATABASE_URL` (pointing at the compose `db` service), `BETTER_AUTH_SECRET` and the `ADMIN_*` seed. It refuses to run when a `.env` already exists, so never run it in this checkout; to try production locally use a separate directory, or `bun run docker:up` (`compose.yml`) here.
- **`BETTER_AUTH_SECRET`** must be ≥ 32 chars (`openssl rand -base64 48`).
- **`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`** seed the admin on backend boot when set (idempotent by email). `ADMIN_EMAIL` must pass `z.email()` (`admin@localhost` fails and crashes the boot; `setup-dev.sh` uses `admin@stack.local`). Code-declared cron jobs run as that user (`cron.md`).
- **`OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_DISCOVERY_URL`** enable the generic OIDC sign-in only when all three are set. `OIDC_DISCOVERY_URL` is the issuer's base URL; `packages/auth/src/oauth.ts` appends `/.well-known/openid-configuration`.
- **Gateway variables** (`GATEWAY_HTTP_PORT`, `BACKEND_HTTP_UPSTREAM`, `FRONTEND_HTTP_UPSTREAM`) are read by `apps/gateway/routes.caddy` (imported by `Caddyfile` and `Caddyfile.dev`) and set only in the compose files. Their defaults are the Docker service addresses.
- **`SKIP_ENV_VALIDATION=1`** bypasses `@nonete/env` in builds/CLI tasks. The Dockerfiles set it in the build stage only.
- **`LOKI_URL`** is optional: backend API calls and frontend page views become the activity log at `/admin/logs` (`logs.query` answers `BAD_GATEWAY` when Loki can't be reached). `LOG_LEVEL` (default `info`) sets the minimum severity.

## Request flow and auth

- Cookies: `sameSite=lax`, `secure`, `httpOnly`; cookie cache 60 s. Being `Secure`, over plain `http` browsers only keep them on `localhost` (`bootstrap.sh` warns about a non-localhost `http://` public URL).
- The frontend oRPC link is same-origin (`url: "/rpc"`, no `origin`). CSRF needs no client plugin (oRPC v2): the backend `RPCHandler` keeps the default `allowMethods` (POST/PUT/PATCH/DELETE, never GET) plus `QUERY` on read procedures, the `/api` OpenAPI handler adds `GetMethodCsrfProtectionHandlerPlugin` (rejects cross-site top-level GET navigations; requests without Fetch Metadata, such as API-key clients, pass), and the `SameSite=Lax` session cookie keeps browsers from sending it on cross-site unsafe methods. Caddy (prod) / Vite (dev) proxy `/rpc` and `/api` to the backend, so the browser never needs CORS. The backend's Hono `cors()` still allows `CORS_ORIGIN` with credentials.
- Two Better Auth clients: `apps/frontend/src/lib/auth-client.ts` (browser, no `baseURL`, same-origin `/api/auth`) and `src/lib/auth-server.ts` (SSR, `BACKEND_URL` from `astro:env`).
- `apps/frontend/src/middleware.ts` lets `/login`, `/signup` (and descendants) and `/logo.svg` through, redirects anonymous requests to `/login`, returns 503 when session resolution fails, redirects non-admins away from `/admin` (to `/`), forwards refreshed session cookies, and logs signed-in page views (`type: "page_view"`, skipping prefetches) for the activity log.
- The three oRPC handlers share their plugins from `apps/backend/src/routers/handler-plugins.ts`:
  - `loggingPlugin()` (`@orpc/pino`) logs each procedure error once: `warn` for 4xx `ORPCError`s, `error` for 5xx and unexpected exceptions, `info` for aborts. It replaces `onError` interceptors, so don't add those back.
  - `hardeningPlugins()` (`/rpc` and `/api` only) answers 413 above 1 MiB of body and 400 on `__proto__`/`constructor.prototype` keys.
  - `eventStreamResponseOptions` pings SSE streams every 5 s, below `Bun.serve`'s 10 s idle timeout.
- `requestLogger` (`apps/backend/src/middlewares/request-logger.ts`) gives every request a server-generated `requestId` (an inbound `x-request-id` is ignored) and a child logger, stored as the `requestScope` Hono variable and passed to `createContext({ context, request })`. oRPC's error lines carry the same id (`req.id`), and a procedure logs through it with `getRequestLogger(context)` from `#context` (`undefined` in cron runs). The logger isn't a field of the `Context` type: a `unique symbol` key there breaks the routers' emitted declarations. Signed-in `/rpc` and `/api` calls (minus auth, docs and the logs query itself) are tagged `type: "api_call"` for the activity log.
- `/scalar` and `/openapi.json` are proxied to the backend and gated there by `requireAdmin`. They come from their own `OpenAPIHandler` in `apps/backend/src/routers/docs.ts`; the `/api` handler carries no reference plugin, so `/api/scalar` and `/api/openapi.json` don't exist.
