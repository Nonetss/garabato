## MODIFIED Requirements

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
