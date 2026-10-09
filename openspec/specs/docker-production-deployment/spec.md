# Docker Production Deployment

## Purpose

Defines the multi-stage production images, the registry-based and local production-like compose stacks, their healthchecks and secret handling, CI image builds and the deployment bootstrap script.

## Requirements

### Requirement: Multi-stage production images with a cached install layer

The backend and the frontend SHALL each have a production `apps/<app>/Dockerfile` with a build stage and a runtime stage, both based on `oven/bun:${BUN_VERSION}-slim`, where `BUN_VERSION` is kept in sync with `packageManager` in the root `package.json`. The build stage SHALL set `SKIP_ENV_VALIDATION=1`, copy the root `package.json`, `bun.lock`, `bunfig.toml` and every workspace `package.json` first, run `bun install --frozen-lockfile` with a cache mount for Bun's install cache, and only then copy the rest of the source and build the app with `NODE_ENV=production`. The build context SHALL be the repo root.

#### Scenario: Source-only change

- **WHEN** an image is rebuilt after a change under `apps/backend/src` with no manifest or lockfile change
- **THEN** the dependency install layer SHALL be reused from cache and only the source copy and build steps SHALL run again

#### Scenario: Dependency change

- **WHEN** a workspace `package.json` or `bun.lock` changes
- **THEN** the install layer SHALL be rebuilt with `--frozen-lockfile`

### Requirement: Bundled runtime without node_modules

The production builds SHALL bundle the workspace packages and every npm dependency into the app's `dist/` (tsdown for the backend, Astro/Vite with `vite.ssr.noExternal` for the frontend), and the runtime stage SHALL copy only the build output it needs, with no `node_modules`. Bun SHALL be the only runtime in the runtime image, and both the app and its compose healthcheck SHALL run on it. The runtime image SHALL set `NODE_ENV=production`.

#### Scenario: Runtime image contents

- **WHEN** the backend or frontend production image is inspected
- **THEN** it SHALL contain the app's `dist/` output and no `node_modules` directory

#### Scenario: Backend start command

- **WHEN** the backend production container starts
- **THEN** it SHALL run `bun dist/index.mjs` from `/app/apps/backend`, listening on port `3000`

### Requirement: Backend image ships migrations

The backend runtime image SHALL include the Drizzle migrations at `/app/packages/db/src/migrations`, laid out so the backend, running from `/app/apps/backend`, resolves them at `../../packages/db/src/migrations`. On startup the backend SHALL apply pending migrations and seed the admin, so a deployment needs no manual database step.

#### Scenario: First start on an empty database

- **WHEN** the production stack starts against an empty `stack` database
- **THEN** the backend SHALL apply every migration and create the admin from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` before serving requests successfully

### Requirement: Frontend image runs the standalone Astro server internally

The frontend runtime image SHALL run the Astro standalone server (`bun /app/apps/frontend/dist/server/entry.mjs`) with `HOST=0.0.0.0` and `PORT=4321`, exposing port `4321` only to the Docker network (compose `expose`, never `ports`). Public build-time values SHALL be passed as build arguments (`PUBLIC_SERVER_URL`).

#### Scenario: Frontend reachable only through the gateway

- **WHEN** the production stack runs
- **THEN** the frontend SHALL answer on `frontend:4321` inside the Docker network and SHALL NOT be reachable on any host port

### Requirement: Gateway image

The gateway image (`apps/gateway/Dockerfile`) SHALL be built from `caddy:2-alpine` with `apps/gateway/Caddyfile` copied to `/etc/caddy/Caddyfile`, SHALL expose only port `80`, and SHALL run `caddy run` with that Caddyfile. The gateway SHALL be the only service that publishes a port in any production compose file; no other service, the bundled MinIO included, SHALL declare `ports`.

#### Scenario: Only the gateway is published

- **WHEN** `compose.yml` or `compose.prod.yml` is inspected
- **THEN** only `gateway` SHALL declare `ports`, mapping a host port to the gateway's port `80`, and `minio` SHALL declare no `ports` entry

### Requirement: Production compose from registry images

`compose.prod.yml`, with compose project name `garabato`, SHALL run `frontend`, `backend` and `gateway` from the registry images `ghcr.io/nonetss/garabato-frontend:main`, `ghcr.io/nonetss/garabato-backend:main` and `ghcr.io/nonetss/garabato-gateway:main`, plus a `db` service (`postgres:17`, database `stack`, password `POSTGRES_PASSWORD` from `.env`, data in the named volume `db_data`) and a `loki` service (`grafana/loki`, data in the named volume `loki_data`, 720h retention). Under the `minio` compose profile it SHALL also run a single `minio` service (`pgsty/silo`, root credentials from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, data in the named volume `minio_data`, no published port) that starts the server and creates the `S3_BUCKET` bucket itself when it does not exist; no separate init service SHALL exist. Without that profile the backend SHALL use the external S3-compatible store set in `.env`. Containers SHALL be named `garabato-<service>` and SHALL share a bridge network `garabato`. The app services SHALL load `.env` through `env_file`; the backend SHALL receive `NODE_ENV=production`, `BETTER_AUTH_URL` set to the `.env`'s `CORS_ORIGIN` and `LOKI_URL=http://loki:3100`, and the frontend SHALL receive `BACKEND_URL=http://backend:3000` and `LOKI_URL=http://loki:3100`. The gateway SHALL publish `${FRONTEND_PORT:-4444}:80`.

#### Scenario: Starting a deployment

- **WHEN** an operator runs `docker compose -f compose.prod.yml --env-file .env up -d` in a directory holding a `.env` written by `scripts/bootstrap.sh`
- **THEN** compose SHALL pull the `garabato-*` images, start `db`, `loki`, `backend`, `frontend` and `gateway`, plus `minio` when `.env` sets `COMPOSE_PROFILES=minio`, and serve the app on `FRONTEND_PORT`

#### Scenario: Bucket created by the MinIO container

- **WHEN** the `minio` profile is on and `minio` starts on an empty `minio_data` volume
- **THEN** the `S3_BUCKET` bucket SHALL exist by the time `minio` reports healthy, and no exited one-shot container SHALL remain after startup

#### Scenario: Bucket already exists

- **WHEN** `minio` restarts on a volume that already holds `S3_BUCKET`
- **THEN** it SHALL keep the bucket and its objects and report healthy

#### Scenario: External object store

- **WHEN** `.env` does not enable the `minio` profile and sets `S3_ENDPOINT` to an external S3-compatible service
- **THEN** no MinIO container SHALL start and the backend SHALL store documents in that service

#### Scenario: Data survives a redeploy

- **WHEN** the stack is recreated with newer images
- **THEN** the database, Loki and MinIO data SHALL be kept in the `db_data`, `loki_data` and `minio_data` volumes

### Requirement: Healthchecks, startup order and restart policy

Every service in `compose.prod.yml` SHALL be long-running and SHALL declare a healthcheck and `restart: unless-stopped`; the Bun apps SHALL run with `init: true`. The backend healthcheck SHALL request `http://localhost:3000/`, the frontend healthcheck `http://localhost:4321/login`, the `db` healthcheck SHALL run `pg_isready -U postgres -d stack`, the Loki healthcheck SHALL request `/ready`, the MinIO healthcheck SHALL pass only when its liveness endpoint (`/minio/health/live`) answers and the `S3_BUCKET` bucket has been created, and the gateway healthcheck SHALL probe Caddy inside its own container. MinIO SHALL stop cleanly when compose stops its container. The backend SHALL start only after `db` is healthy and the frontend only after the backend is healthy. No service SHALL depend on Loki or MinIO at startup, so the stack also starts when the object store is external.

#### Scenario: Database not ready yet

- **WHEN** the stack starts and Postgres is still initializing
- **THEN** the backend SHALL NOT start until the `db` healthcheck passes

#### Scenario: Loki unavailable

- **WHEN** the `loki` service is down or unhealthy
- **THEN** the backend and frontend SHALL still start and serve requests

#### Scenario: Object store unavailable

- **WHEN** the object store cannot be reached
- **THEN** the backend SHALL still start; only document uploads, downloads and signatures SHALL fail until it is reachable

#### Scenario: MinIO up but bucket missing

- **WHEN** the MinIO server is live but the bucket has not been created yet
- **THEN** the `minio` healthcheck SHALL fail

#### Scenario: Stopping MinIO

- **WHEN** an operator runs `docker compose stop minio` or `down`
- **THEN** the MinIO server SHALL receive the stop signal and exit before compose's stop timeout, without being killed

#### Scenario: Crashed container

- **WHEN** the backend process exits unexpectedly
- **THEN** compose SHALL restart it

### Requirement: Local production-like compose

`compose.yml`, with compose project name `stack`, SHALL build the production images locally from the same `Dockerfile`s and run `frontend`, `backend`, `gateway`, `loki` and `minio` with the same healthchecks, using the root `.env` (optional) through `env_file`. `minio` SHALL create its own bucket as in `compose.prod.yml`, with no separate init service. The gateway SHALL publish `4321:80`, MinIO SHALL publish no port, and the backend SHALL receive `CORS_ORIGIN=http://localhost:4321` and `S3_ENDPOINT=http://minio:9000` and SHALL start only after `db` and `minio` are healthy. The root scripts `docker:build`, `docker:up`, `docker:down` and `docker:logs` SHALL operate on it.

#### Scenario: Running production images locally

- **WHEN** a developer runs `bun run docker:up`
- **THEN** the production images SHALL be built from source, MinIO SHALL start with its bucket, the backend SHALL start after MinIO is healthy, and the app SHALL be served through the gateway at `http://localhost:4321`

### Requirement: Secrets never baked into images

The root `.dockerignore` SHALL exclude every `.env` and `.env.*` file (except `.env.example`), `node_modules`, build outputs (`dist`, `.astro`, `.turbo`), `.git`, logs, the Dockerfiles and `compose.yml` from the build context. Runtime configuration SHALL reach containers only through compose `env_file`/`environment`, and build-time values only through build arguments carrying public values.

#### Scenario: Building with a local .env

- **WHEN** an image is built from a checkout that contains a root `.env` with real secrets
- **THEN** no layer of the image SHALL contain that `.env` or any of its values

### Requirement: CI builds only the changed images

`.github/workflows/docker-build.yml` SHALL, on push to the configured branches (including `main`), determine which of the `backend`, `frontend` and `gateway` images are affected by the pushed changes and build and push only those, as a matrix. The backend and frontend SHALL be affected by changes under their app directory, `packages/`, `package.json`, `bun.lock` or `bunfig.toml`; the gateway by changes under `apps/gateway/`; and every image by changes to the workflow itself or `.dockerignore`. A new branch, a force push or a missing base commit SHALL build every image. The jobs SHALL run on GitHub-hosted `ubuntu-26.04` runners. Each image SHALL be pushed to the GitHub Container Registry, authenticated with the workflow's `GITHUB_TOKEN` (`packages: write`), as `ghcr.io/<owner>/<repo>-<app>` in lowercase (for this repo `ghcr.io/nonetss/garabato-<app>`) with the tags `latest`, the branch name and `<branch>-<short sha>`, using a registry layer cache per branch that falls back to `main`'s. A newer push to the same branch SHALL cancel a running build.

#### Scenario: Frontend-only change

- **WHEN** a push to `main` changes only files under `apps/frontend/`
- **THEN** CI SHALL build and push only the `garabato-frontend` image, tagged `latest`, `main` and `main-<short sha>`

#### Scenario: Shared package change

- **WHEN** a push changes a file under `packages/`
- **THEN** CI SHALL rebuild both the backend and the frontend images and SHALL NOT rebuild the gateway image

#### Scenario: Nothing to build

- **WHEN** a push changes only files that affect no image
- **THEN** the build job SHALL be skipped

### Requirement: Deployment bootstrap script

`scripts/bootstrap.sh`, runnable from a clone or through `curl | bash`, SHALL generate a production `.env` in the current directory. It SHALL require `docker` (with the compose plugin), `openssl` and `curl`, read its prompts from `/dev/tty`, and refuse to run when a `.env` already exists there. It SHALL prompt for the host port (default `4444`), the public URL (default `http://localhost:<port>`), warning that Secure session cookies only work over plain `http` on `localhost`, the admin name, email and password (at least 8 characters), and whether to use the bundled MinIO (the default) or an external S3-compatible store; for an external one it SHALL prompt for its endpoint URL, bucket, region, access key id and secret access key. After confirmation it SHALL generate `POSTGRES_PASSWORD` (URL-safe hex), `BETTER_AUTH_SECRET` and `CERTIFICATE_ENCRYPTION_KEY` with `openssl`, plus the S3 access key id and secret for the bundled MinIO, and write `FRONTEND_PORT`, `CORS_ORIGIN` (the public URL), `POSTGRES_PASSWORD`, `DATABASE_URL` (pointing at `db:5432/stack`), `BETTER_AUTH_SECRET`, `CERTIFICATE_ENCRYPTION_KEY`, the `S3_*` settings (`S3_ENDPOINT=http://minio:9000` and `COMPOSE_PROFILES=minio` for the bundled MinIO), `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`, every value single-quoted, to a file created with mode `600`. It SHALL download `compose.prod.yml` from the `garabato` repository when it is missing and SHALL offer to pull and start the stack.

#### Scenario: Fresh deployment

- **WHEN** an operator runs `scripts/bootstrap.sh` in an empty directory and answers the prompts with the defaults
- **THEN** a mode-`600` `.env` with random secrets, the given admin credentials and the bundled MinIO settings SHALL be written, `compose.prod.yml` SHALL be downloaded, and, if confirmed, the stack SHALL be pulled and started with MinIO

#### Scenario: External object store

- **WHEN** the operator chooses an external S3-compatible store and enters its settings
- **THEN** the `.env` SHALL hold those settings and SHALL NOT enable the `minio` profile

#### Scenario: Existing configuration

- **WHEN** `scripts/bootstrap.sh` runs in a directory that already has a `.env`
- **THEN** it SHALL exit with an error before prompting, leaving the file unchanged

#### Scenario: Non-local plain-http URL

- **WHEN** the operator enters a public URL like `http://example.com`
- **THEN** the script SHALL warn that sign-in will fail without https and SHALL abort unless the operator confirms
