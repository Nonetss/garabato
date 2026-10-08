## MODIFIED Requirements

### Requirement: Gateway image

The gateway image (`apps/gateway/Dockerfile`) SHALL be built from `caddy:2-alpine` with `apps/gateway/Caddyfile` copied to `/etc/caddy/Caddyfile`, SHALL expose only port `80`, and SHALL run `caddy run` with that Caddyfile. The gateway SHALL be the only service whose port is published on a public interface in any production compose file. The only other published port allowed is the bundled MinIO's administration console, bound to the host's loopback interface (`127.0.0.1:9001`) so it is reachable only from the host itself, for example through an SSH tunnel.

#### Scenario: Only the gateway is published

- **WHEN** `compose.yml` or `compose.prod.yml` is inspected
- **THEN** among the app services only `gateway` SHALL declare `ports`, mapping a host port to the gateway's port `80`, and the only other `ports` entry SHALL be MinIO's `127.0.0.1:9001:9001`

### Requirement: Production compose from registry images

`compose.prod.yml`, with compose project name `garabato`, SHALL run `frontend`, `backend` and `gateway` from the registry images `ghcr.io/nonetss/garabato-frontend:main`, `ghcr.io/nonetss/garabato-backend:main` and `ghcr.io/nonetss/garabato-gateway:main`, plus a `db` service (`postgres:17`, database `stack`, password `POSTGRES_PASSWORD` from `.env`, data in the named volume `db_data`) and a `loki` service (`grafana/loki`, data in the named volume `loki_data`, 720h retention). Under the `minio` compose profile it SHALL also run a `minio` service (`pgsty/silo`, root credentials from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, data in the named volume `minio_data`, console on `127.0.0.1:9001`, S3 API not published) and a one-shot `minio-init` service that creates the `S3_BUCKET` bucket. Without that profile the backend SHALL use the external S3-compatible store set in `.env`. Containers SHALL be named `garabato-<service>` and SHALL share a bridge network `garabato`. The app services SHALL load `.env` through `env_file`; the backend SHALL receive `NODE_ENV=production`, `BETTER_AUTH_URL` set to the `.env`'s `CORS_ORIGIN` and `LOKI_URL=http://loki:3100`, and the frontend SHALL receive `BACKEND_URL=http://backend:3000` and `LOKI_URL=http://loki:3100`. The gateway SHALL publish `${FRONTEND_PORT:-4444}:80`.

#### Scenario: Starting a deployment

- **WHEN** an operator runs `docker compose -f compose.prod.yml --env-file .env up -d` in a directory holding a `.env` written by `scripts/bootstrap.sh`
- **THEN** compose SHALL pull the `garabato-*` images, start `db`, `loki`, `backend`, `frontend` and `gateway`, plus `minio` and `minio-init` when `.env` sets `COMPOSE_PROFILES=minio`, and serve the app on `FRONTEND_PORT`

#### Scenario: External object store

- **WHEN** `.env` does not enable the `minio` profile and sets `S3_ENDPOINT` to an external S3-compatible service
- **THEN** no MinIO container SHALL start and the backend SHALL store documents in that service

#### Scenario: Data survives a redeploy

- **WHEN** the stack is recreated with newer images
- **THEN** the database, Loki and MinIO data SHALL be kept in the `db_data`, `loki_data` and `minio_data` volumes

### Requirement: Healthchecks, startup order and restart policy

Every long-running service in `compose.prod.yml` SHALL declare a healthcheck and `restart: unless-stopped`; the Bun apps SHALL run with `init: true`. The backend healthcheck SHALL request `http://localhost:3000/`, the frontend healthcheck `http://localhost:4321/login`, the `db` healthcheck SHALL run `pg_isready -U postgres -d stack`, the Loki healthcheck SHALL request `/ready`, the MinIO healthcheck SHALL request its liveness endpoint (`/minio/health/live`), and the gateway healthcheck SHALL probe Caddy inside its own container. The one-shot `minio-init` SHALL start after MinIO is healthy and SHALL NOT restart once it succeeds. The backend SHALL start only after `db` is healthy and the frontend only after the backend is healthy. No service SHALL depend on Loki or MinIO at startup, so the stack also starts when the object store is external.

#### Scenario: Database not ready yet

- **WHEN** the stack starts and Postgres is still initializing
- **THEN** the backend SHALL NOT start until the `db` healthcheck passes

#### Scenario: Loki unavailable

- **WHEN** the `loki` service is down or unhealthy
- **THEN** the backend and frontend SHALL still start and serve requests

#### Scenario: Object store unavailable

- **WHEN** the object store cannot be reached
- **THEN** the backend SHALL still start; only document uploads, downloads and signatures SHALL fail until it is reachable

#### Scenario: Crashed container

- **WHEN** the backend process exits unexpectedly
- **THEN** compose SHALL restart it

### Requirement: Local production-like compose

`compose.yml`, with compose project name `stack`, SHALL build the production images locally from the same `Dockerfile`s and run `frontend`, `backend`, `gateway`, `loki`, `minio` and the one-shot `minio-init` with the same healthchecks, using the root `.env` (optional) through `env_file`. The gateway SHALL publish `4321:80`, MinIO SHALL publish only its console on `127.0.0.1:9001`, and the backend SHALL receive `CORS_ORIGIN=http://localhost:4321` and `S3_ENDPOINT=http://minio:9000`. The root scripts `docker:build`, `docker:up`, `docker:down` and `docker:logs` SHALL operate on it.

#### Scenario: Running production images locally

- **WHEN** a developer runs `bun run docker:up`
- **THEN** the production images SHALL be built from source, MinIO SHALL start with its bucket, and the app SHALL be served through the gateway at `http://localhost:4321`

### Requirement: Deployment bootstrap script

`scripts/bootstrap.sh`, runnable from a clone or through `curl | bash`, SHALL generate a production `.env` in the current directory. It SHALL require `docker` (with the compose plugin), `openssl` and `curl`, read its prompts from `/dev/tty`, and refuse to run when a `.env` already exists there. It SHALL prompt for the host port (default `4444`), the public URL (default `http://localhost:<port>`), warning that Secure session cookies only work over plain `http` on `localhost`, the admin name, email and password (at least 8 characters), and whether to use the bundled MinIO (the default) or an external S3-compatible store; for an external one it SHALL prompt for its endpoint URL, bucket, region, access key id and secret access key. After confirmation it SHALL generate `POSTGRES_PASSWORD` (URL-safe hex), `BETTER_AUTH_SECRET` and `CERTIFICATE_ENCRYPTION_KEY` with `openssl`, plus the S3 access key id and secret for the bundled MinIO, and write `FRONTEND_PORT`, `CORS_ORIGIN` (the public URL), `POSTGRES_PASSWORD`, `DATABASE_URL` (pointing at `db:5432/stack`), `BETTER_AUTH_SECRET`, `CERTIFICATE_ENCRYPTION_KEY`, the `S3_*` settings (`S3_ENDPOINT=http://minio:9000` and `COMPOSE_PROFILES=minio` for the bundled MinIO), `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`, every value single-quoted, to a file created with mode `600`. It SHALL download `compose.prod.yml` from the `stack` repository when it is missing and SHALL offer to pull and start the stack.

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
