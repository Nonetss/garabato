## ADDED Requirements

### Requirement: Hot-reloading Docker dev stack

The repo SHALL provide `compose.dev.yml`, with compose project name `better-dev`, running `frontend`, `backend`, `gateway` and `db`. The `frontend`, `backend` and `gateway` services SHALL run on the host network (`network_mode: host`), and each app SHALL run its development server from source on the same address as native dev: the frontend `astro dev` on `:4321` and the backend `bun --hot` on `:3000`. The services SHALL reach each other and the database through `localhost`. The gateway's HTTP site SHALL listen on `:8080`, never on the host's port 80. `bun run dev` SHALL run `docker compose -f compose.dev.yml up --build --watch` and `bun run dev:down` SHALL remove the containers.

#### Scenario: Starting the dev stack

- **WHEN** a developer runs `bun run dev` on a machine with no other Postgres running
- **THEN** compose SHALL build the dev images, start all four services with file watching enabled, and the app SHALL be reachable at `http://localhost:4321`

#### Scenario: Production-like entry in the dev stack

- **WHEN** the dev stack runs and a developer opens `http://localhost:8080`
- **THEN** the gateway SHALL forward `/rpc`, `/api`, `/scalar` and `/openapi.json` to `localhost:3000` and every other path to `localhost:4321`

### Requirement: Local Postgres service

`compose.dev.yml` SHALL define a `db` service running `postgres:17` with database `better`, reachable from the host at `localhost:5432` with the credentials of the default `DATABASE_URL` in `.env.example` (`postgresql://postgres:postgres@localhost:5432/better`), and keeping its data in a named volume. The root scripts `db:start` and `db:stop` SHALL start (detached) and stop only that `db` service, so native dev can use the same database without the rest of the dev stack.

#### Scenario: Standalone database for native dev

- **WHEN** a developer runs `bun run db:start`
- **THEN** only the `db` service of `compose.dev.yml` SHALL start, and the backend started with `bun run dev:local` SHALL connect to it with the default `DATABASE_URL`

#### Scenario: Stopping the database

- **WHEN** a developer runs `bun run db:stop`
- **THEN** only the `db` service SHALL stop, and its data SHALL be kept for the next `bun run db:start`

### Requirement: Edits reach containers without rebuilding

`compose.dev.yml` SHALL declare `develop.watch` rules, used by `docker compose watch` / `up --watch`, so that:
- edits under an app's source (`apps/frontend/src`, `apps/frontend/public`, `apps/backend/src`) and under the `packages/*/src` each app uses (`api`, `auth`, `env`, `logger` for the frontend; `api`, `auth`, `cron`, `db`, `env`, `logger` for the backend) are synced into the containers that use them and picked up by the running dev server without restarting the container;
- edits to `apps/frontend/astro.config.mjs` are synced and restart the frontend;
- edits to `apps/gateway/Caddyfile` are synced and restart the gateway;
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

- **WHEN** a developer edits `apps/gateway/Caddyfile`
- **THEN** the gateway container SHALL restart with the new routing table without an image rebuild

### Requirement: Dev images separate from production images

Each of backend and frontend SHALL have an `apps/<app>/Dockerfile.dev` that installs dependencies with the same manifest-first cached layer as its production `Dockerfile`, copies the source and starts the app's dev server (`bun run --hot src/index.ts` for the backend, `bun run dev --port 4321` for the frontend). Only `compose.dev.yml` SHALL use the `Dockerfile.dev` files; the production `Dockerfile`s, `compose.yml`, `compose.prod.yml` and the CI workflow SHALL NOT.

#### Scenario: Production build unaffected

- **WHEN** CI builds the production images
- **THEN** it SHALL use the production `Dockerfile`s and never a `Dockerfile.dev`

### Requirement: Dev stack uses the native dev configuration

Each dev app container SHALL read its configuration only from the root `.env` file that native dev reads, with no compose `environment` overrides for the apps, so it uses the same `DATABASE_URL` and peer URLs.

#### Scenario: Shared data with native dev

- **WHEN** a developer creates a record while running the Docker dev stack, stops it, and later runs `bun run db:start` and native `bun run dev:local`
- **THEN** the record SHALL be visible, because both use the `DATABASE_URL` from the same root `.env` file and the same `db` service

### Requirement: Configurable Astro dev proxy target

`apps/frontend/astro.config.mjs` SHALL read the dev proxy target for `/rpc`, `/api`, `/scalar` and `/openapi.json` from `BACKEND_URL`, the same variable the frontend's server-side session lookups use to reach the backend, defaulting to `http://localhost:3000`, which both native dev and the Docker dev stack use.

#### Scenario: Native dev keeps working

- **WHEN** `bun run dev:local` runs natively without `BACKEND_URL`
- **THEN** the frontend SHALL proxy those paths to `http://localhost:3000`

### Requirement: Coexistence with native dev

Native dev (`bun run db:start`, `bun run dev:local` and optionally `bun run gateway`) SHALL keep working alongside the Docker dev stack. Because both use the same host ports, the documentation SHALL state that only one of them runs at a time.

#### Scenario: Switching back to native dev

- **WHEN** a developer stops the Docker dev stack and runs `bun run db:start` and `bun run dev:local`
- **THEN** native dev SHALL work with the same root `.env` file and no extra changes
