# Docker Dev Environment

## Purpose

Provides a hot-reloading Docker Compose dev stack with a local Loki that shares the native dev configuration, uses an external dev PostgreSQL and coexists with native dev.
## Requirements
### Requirement: Hot-reloading Docker dev stack

The repo SHALL provide `compose.dev.yml`, with compose project name `stack-dev`, running `frontend`, `backend`, `gateway` and `loki`, plus `minio` and the one-shot `minio-init` under the `minio` profile, on the stack's private network. Like production, the `gateway` SHALL be the only service that publishes a port (`4321:4321`, see "HTTPS and HTTP/2 dev entry on the usual port"). `frontend`, `backend`, `loki` and `minio` SHALL use `expose` only, and no dev service SHALL use `network_mode: host`. Each app SHALL run its development server from source: the frontend `astro dev` on `0.0.0.0:4320` and the backend `bun --hot` on `:3000`. The gateway SHALL reach them as `frontend:4320` and `backend:3000`, the apps SHALL reach Loki as `loki:3100`, the backend SHALL reach the object store at the `S3_ENDPOINT` of `.env` (`http://minio:9000` for the bundled one), and the backend SHALL reach the database through `DATABASE_URL`. `bun run dev` SHALL run `docker compose -f compose.dev.yml up --build --watch` and `bun run dev:down` SHALL remove the containers.

#### Scenario: Starting the dev stack

- **WHEN** a developer runs `bun run dev` with `DATABASE_URL` pointing at a reachable dev PostgreSQL
- **THEN** compose SHALL build the dev images, start all the services with file watching enabled, and the app SHALL be reachable at `https://localhost:4321`

#### Scenario: Single published port

- **WHEN** the dev stack runs
- **THEN** only the host port `4321` SHALL be bound by the stack, and the backend (`3000`), the frontend dev server (`4320`), Loki (`3100`) and MinIO (`9000`, `9001`) SHALL NOT be reachable from the host except through the gateway's routing

#### Scenario: Production-like routing in the dev stack

- **WHEN** the dev stack runs and the browser requests `https://localhost:4321/rpc/...`, `/api/...`, `/scalar` or `/openapi.json`
- **THEN** the gateway SHALL forward them to `backend:3000` and every other path to `frontend:4320`

### Requirement: External dev database

`compose.dev.yml` SHALL NOT define a database service. Development SHALL use a PostgreSQL that lives outside the project, on another server, reached through the `DATABASE_URL` of the root `.env`, and the documentation SHALL say so.

#### Scenario: Removing the dev stack keeps the data

- **WHEN** a developer runs `bun run dev:down`
- **THEN** no database container or volume SHALL be removed, and the data SHALL stay on the external dev server

### Requirement: Local Loki service

`compose.dev.yml` SHALL define a `loki` service running `grafana/loki` with the same flags and 720h retention as `compose.yml`, keeping its data in a named volume, reachable only on the stack's private network. No service SHALL wait for it. For native dev, `compose.dev.yml` SHALL define a `loki-native` service with the same definition under the `native` profile, published only on `127.0.0.1:3100` (the `LOKI_URL` of `.env.example`). `bun run dev` SHALL NOT start it. The root scripts `loki:start` and `loki:stop` SHALL start (detached) and stop only `loki-native`.

#### Scenario: Activity log in the dev stack

- **WHEN** a developer runs `bun run dev`
- **THEN** backend API calls and frontend page views SHALL reach the dev Loki over the private network and show up at `/admin/logs`

#### Scenario: Standalone Loki for native dev

- **WHEN** a developer runs `bun run loki:start`
- **THEN** only `loki-native` SHALL start, on `127.0.0.1:3100`, and the apps started with `bun run dev:local` SHALL ship logs to it with the default `LOKI_URL`

### Requirement: Local object storage

`compose.dev.yml` SHALL define, under the `minio` profile, a `minio` service running the `pgsty/silo` image (`server /data --console-address ":9001"`), with its root credentials taken from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` and its data in a named volume, reachable only on the stack's private network, plus a one-shot `minio-init` service that creates the `S3_BUCKET` bucket when it does not exist and then exits. With that profile active (`COMPOSE_PROFILES=minio` and `S3_ENDPOINT=http://minio:9000` in `.env`) the backend SHALL wait for `minio-init` to complete; without it the backend SHALL use the store set in `.env` and wait for nothing. For native dev, `compose.dev.yml` SHALL define `minio-native` and `minio-native-init` with the same definitions under the `native` profile, `minio-native` published only on `127.0.0.1:9000` (the `S3_ENDPOINT` of `.env.example`) and `127.0.0.1:9001` (its console). `bun run dev` SHALL NOT start them. The root scripts `minio:start` and `minio:stop` SHALL start (detached) and stop only `minio-native` and its init service.

#### Scenario: Uploads to an external store in the dev stack

- **WHEN** `.env` sets `S3_ENDPOINT` to the developer's own S3-compatible store, without the `minio` profile, and the developer runs `bun run dev` and uploads a PDF
- **THEN** no MinIO container SHALL start and the backend SHALL store the document in that store

#### Scenario: Uploads to the bundled store in the dev stack

- **WHEN** `.env` sets `COMPOSE_PROFILES=minio` and `S3_ENDPOINT=http://minio:9000` and the developer runs `bun run dev` and uploads a PDF
- **THEN** the backend SHALL store it in the dev MinIO's bucket, created at startup, over the private network

#### Scenario: Standalone MinIO for native dev

- **WHEN** a developer runs `bun run minio:start`
- **THEN** only `minio-native` and its init service SHALL start, the bucket SHALL exist, and the apps started with `bun run dev:local` SHALL store documents in it with the default `S3_ENDPOINT`

#### Scenario: Data survives restarts

- **WHEN** a developer runs `bun run dev:down` and `bun run dev` again
- **THEN** the documents uploaded before SHALL still be in the MinIO volume

### Requirement: Edits reach containers without rebuilding

`compose.dev.yml` SHALL declare `develop.watch` rules, used by `docker compose watch` / `up --watch`, so that:
- edits under an app's source (`apps/frontend/src`, `apps/frontend/public`, `apps/backend/src`) and under the `packages/*/src` each app uses (`api`, `auth`, `env`, `logger` for the frontend; `api`, `auth`, `cron`, `db`, `env`, `logger` for the backend) are synced into the containers that use them and picked up by the running dev server without restarting the container;
- edits to `apps/frontend/astro.config.mjs` are synced and restart the frontend;
- edits to `apps/gateway/Caddyfile.dev` or `apps/gateway/routes.caddy` are synced and restart the gateway;
- edits to a dependency manifest or lockfile (`package.json`, `bun.lock`, `apps/<app>/package.json`) rebuild the affected services.

Dev images SHALL NOT bind-mount the repository, so host `node_modules` never shadow the container's own.

#### Scenario: Backend code change

- **WHEN** a developer saves a change under `packages/api/src` while the dev stack runs
- **THEN** the file SHALL be synced into the backend container and `bun --hot` SHALL reload it without a rebuild or a container restart

#### Scenario: Frontend component change

- **WHEN** a developer saves a change under `apps/frontend/src`
- **THEN** the change SHALL appear in the browser through Astro/Vite HMR

#### Scenario: Dependency change

- **WHEN** a developer changes `bun.lock`
- **THEN** compose SHALL rebuild the frontend and backend dev images

#### Scenario: Routing table change

- **WHEN** a developer edits `apps/gateway/routes.caddy`
- **THEN** the gateway container SHALL restart with the new routing table without an image rebuild

### Requirement: Dev images separate from production images

Each of backend and frontend SHALL have an `apps/<app>/Dockerfile.dev` that installs dependencies with the same manifest-first cached layer as its production `Dockerfile`, copies the source and starts the app's dev server (`bun run --hot src/index.ts` for the backend, `bun run dev --host 0.0.0.0` for the frontend, whose `dev` script runs `astro dev --port 4320`). Only `compose.dev.yml` SHALL use the `Dockerfile.dev` files; the production `Dockerfile`s, `compose.yml`, `compose.prod.yml` and the CI workflow SHALL NOT.

#### Scenario: Production build unaffected

- **WHEN** CI builds the production images
- **THEN** it SHALL use the production `Dockerfile`s and never a `Dockerfile.dev`

### Requirement: Dev stack uses the native dev configuration

Each dev app container SHALL read its configuration from the root `.env` file that native dev reads. The only compose `environment` overrides for the apps SHALL be container addresses: `BACKEND_URL=http://backend:3000` for the frontend and `LOKI_URL=http://loki:3100` for both apps. Every other value, including `DATABASE_URL`, `BETTER_AUTH_URL`, `CORS_ORIGIN` and every `S3_*` setting, SHALL come from `.env` unchanged, so the dev stack stores documents wherever `.env` points.

#### Scenario: Shared data with native dev

- **WHEN** a developer creates a record while running the Docker dev stack, stops it, and later runs native `bun run dev:local`
- **THEN** the record SHALL be visible, because both use the `DATABASE_URL` from the same root `.env` file, which points at the same external dev database

### Requirement: Configurable Astro dev proxy target

`apps/frontend/astro.config.mjs` SHALL read the dev proxy target for `/rpc`, `/api`, `/scalar` and `/openapi.json` from `BACKEND_URL`, the same variable the frontend's server-side session lookups use to reach the backend, defaulting to `http://localhost:3000`. Native dev uses that default from `.env`, and the Docker dev stack overrides it with `http://backend:3000`.

#### Scenario: Native dev keeps working

- **WHEN** `bun run dev:local` runs natively without `BACKEND_URL`
- **THEN** the frontend SHALL proxy those paths to `http://localhost:3000`

### Requirement: Coexistence with native dev

Native dev (`bun run dev:local` plus `bun run gateway`, optionally `bun run loki:start`, and an object store: `bun run minio:start` or an external one set in `S3_ENDPOINT`) SHALL keep working alongside the Docker dev stack and serve the app at the same `https://localhost:4321`. The gateway is required for native dev, because it terminates TLS on `:4321` in front of the host processes `astro dev` (`:4320`) and backend (`:3000`). Because both setups bind the host's `:4321`, the documentation SHALL state that only one of them runs at a time.

#### Scenario: Switching back to native dev

- **WHEN** a developer stops the Docker dev stack and runs `bun run minio:start`, `bun run dev:local` and `bun run gateway`
- **THEN** native dev SHALL work at `https://localhost:4321` with the same root `.env` file, the same trusted CA and no extra changes

### Requirement: Persistent frontend dependency cache

`compose.dev.yml` SHALL mount a named volume on the frontend container's Vite dependency cache directory (`/app/apps/frontend/node_modules/.vite`), so the optimized dependencies survive container recreation by `bun run dev` and `bun run dev:down`. The volume SHALL NOT be a bind mount of the host repository. When dependencies change, Vite's own lockfile and config hash check SHALL invalidate the cached optimization.

#### Scenario: Restarting the dev stack

- **WHEN** a developer runs `bun run dev`, loads a page, runs `bun run dev:down` and then `bun run dev` again
- **THEN** the second start SHALL reuse the optimized dependencies from the volume, and the first page load SHALL NOT log `optimized dependencies changed. reloading` for dependencies optimized in the previous run

#### Scenario: Dependency change invalidates the cache

- **WHEN** `bun.lock` changes and compose rebuilds the frontend image
- **THEN** Vite SHALL detect the changed lockfile hash and re-optimize dependencies, never serving stale optimized modules

### Requirement: Frontend dev server warms up at startup

`apps/frontend/astro.config.mjs` SHALL configure the Astro dev server, for both native dev and the Docker dev stack, so that:
- the view-transition modules that `<ClientRouter />` injects (`astro/virtual-modules/transitions-*`) are listed in `vite.optimizeDeps.include` and optimized at startup rather than discovered on the first page load;
- `vite.server.warmup` pre-transforms the island entry modules mounted from `.astro` files (the feature barrels under `src/features`) on the client side, and the `.astro` pages and the middleware on the SSR side.

These settings SHALL only affect the dev server; `astro build` output SHALL be unchanged.

#### Scenario: First page load after startup

- **WHEN** the frontend dev server has started and a developer opens an authenticated page for the first time
- **THEN** the dev server SHALL NOT log `optimized dependencies changed. reloading`, and the browser SHALL NOT be forced into a full page reload

#### Scenario: Production build unaffected by warmup

- **WHEN** `astro build` runs for the production image
- **THEN** the build SHALL produce the same bundles as without the warmup and pre-optimization settings

### Requirement: HTTPS and HTTP/2 dev entry on the usual port

In development the app SHALL be served at `https://localhost:4321` over TLS with HTTP/2. The dev gateway SHALL terminate TLS on `:4321` with a certificate issued by its local certificate authority (`tls internal`), negotiate `h2` (and `http/1.1` as fallback), and forward requests with the production routing to the backend and to `astro dev` (`:4320`). The CA SHALL persist in the named volume `gateway_data` shared by `compose.dev.yml` and `apps/gateway/compose.yml`, so it doesn't change across restarts. The root script `dev:cert` SHALL export the CA's root certificate to a git-ignored file at the repo root, for the developer to trust in their browser once. `.env.example` SHALL set `BETTER_AUTH_URL` and `CORS_ORIGIN` to `https://localhost:4321`. The dev gateway SHALL serve no other site and SHALL NOT bind ports 80 or 443.

#### Scenario: Browser negotiates HTTP/2

- **WHEN** the dev stack runs, the developer has trusted the exported CA and opens `https://localhost:4321`
- **THEN** the page and its modules SHALL be served over HTTP/2 without a certificate warning, and signing in SHALL work

#### Scenario: HMR through the gateway

- **WHEN** a developer saves a change under `apps/frontend/src` while viewing `https://localhost:4321`
- **THEN** Vite's HMR client SHALL connect through the gateway (`wss://localhost:4321`) and apply the change

#### Scenario: CA survives restarts

- **WHEN** a developer runs `bun run dev:down` and `bun run dev` again
- **THEN** the gateway SHALL reuse the same root CA, and the browser SHALL keep trusting the certificate

