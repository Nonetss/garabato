## MODIFIED Requirements

### Requirement: Hot-reloading Docker dev stack

The repo SHALL provide `compose.dev.yml`, with compose project name `stack-dev`, running `frontend`, `backend`, `gateway`, `loki` and `minio` (plus the one-shot `minio-init`) on the stack's private network. Like production, the `gateway` SHALL be the only service that publishes a port (`4321:4321`, see "HTTPS and HTTP/2 dev entry on the usual port"). `frontend`, `backend`, `loki` and `minio` SHALL use `expose` only, and no dev service SHALL use `network_mode: host`. Each app SHALL run its development server from source: the frontend `astro dev` on `0.0.0.0:4320` and the backend `bun --hot` on `:3000`. The gateway SHALL reach them as `frontend:4320` and `backend:3000`, the apps SHALL reach Loki as `loki:3100`, the backend SHALL reach the object store as `minio:9000`, and the backend SHALL reach the database through `DATABASE_URL`. `bun run dev` SHALL run `docker compose -f compose.dev.yml up --build --watch` and `bun run dev:down` SHALL remove the containers.

#### Scenario: Starting the dev stack

- **WHEN** a developer runs `bun run dev` with `DATABASE_URL` pointing at a reachable dev PostgreSQL
- **THEN** compose SHALL build the dev images, start all the services with file watching enabled, and the app SHALL be reachable at `https://localhost:4321`

#### Scenario: Single published port

- **WHEN** the dev stack runs
- **THEN** only the host port `4321` SHALL be bound by the stack, and the backend (`3000`), the frontend dev server (`4320`), Loki (`3100`) and MinIO (`9000`, `9001`) SHALL NOT be reachable from the host except through the gateway's routing

#### Scenario: Production-like routing in the dev stack

- **WHEN** the dev stack runs and the browser requests `https://localhost:4321/rpc/...`, `/api/...`, `/scalar` or `/openapi.json`
- **THEN** the gateway SHALL forward them to `backend:3000` and every other path to `frontend:4320`

### Requirement: Dev stack uses the native dev configuration

Each dev app container SHALL read its configuration from the root `.env` file that native dev reads. The only compose `environment` overrides for the apps SHALL be container addresses: `BACKEND_URL=http://backend:3000` for the frontend, `LOKI_URL=http://loki:3100` for both apps and `S3_ENDPOINT=http://minio:9000` for the backend. Every other value, including `DATABASE_URL`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `S3_BUCKET` and the S3 credentials, SHALL come from `.env` unchanged.

#### Scenario: Shared data with native dev

- **WHEN** a developer creates a record while running the Docker dev stack, stops it, and later runs native `bun run dev:local`
- **THEN** the record SHALL be visible, because both use the `DATABASE_URL` from the same root `.env` file, which points at the same external dev database

### Requirement: Coexistence with native dev

Native dev (`bun run dev:local` plus `bun run gateway`, optionally `bun run loki:start`, and an object store: `bun run minio:start` or an external one set in `S3_ENDPOINT`) SHALL keep working alongside the Docker dev stack and serve the app at the same `https://localhost:4321`. The gateway is required for native dev, because it terminates TLS on `:4321` in front of the host processes `astro dev` (`:4320`) and backend (`:3000`). Because both setups bind the host's `:4321`, the documentation SHALL state that only one of them runs at a time.

#### Scenario: Switching back to native dev

- **WHEN** a developer stops the Docker dev stack and runs `bun run minio:start`, `bun run dev:local` and `bun run gateway`
- **THEN** native dev SHALL work at `https://localhost:4321` with the same root `.env` file, the same trusted CA and no extra changes

## ADDED Requirements

### Requirement: Local object storage

`compose.dev.yml` SHALL define a `minio` service running the `pgsty/silo` image (`server /data --console-address ":9001"`), with its root credentials taken from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` and its data in a named volume, reachable only on the stack's private network, plus a one-shot `minio-init` service that creates the `S3_BUCKET` bucket when it does not exist and then exits. The backend SHALL wait for `minio-init` to complete. For native dev, `compose.dev.yml` SHALL define `minio-native` and `minio-native-init` with the same definitions under the `native` profile, `minio-native` published only on `127.0.0.1:9000` (the `S3_ENDPOINT` of `.env.example`) and `127.0.0.1:9001` (its console). `bun run dev` SHALL NOT start them. The root scripts `minio:start` and `minio:stop` SHALL start (detached) and stop only `minio-native` and its init service.

#### Scenario: Uploads in the dev stack

- **WHEN** a developer runs `bun run dev` and uploads a PDF
- **THEN** the backend SHALL store it in the dev MinIO's bucket, created at startup, over the private network

#### Scenario: Standalone MinIO for native dev

- **WHEN** a developer runs `bun run minio:start`
- **THEN** only `minio-native` and its init service SHALL start, the bucket SHALL exist, and the apps started with `bun run dev:local` SHALL store documents in it with the default `S3_ENDPOINT`

#### Scenario: Data survives restarts

- **WHEN** a developer runs `bun run dev:down` and `bun run dev` again
- **THEN** the documents uploaded before SHALL still be in the MinIO volume
