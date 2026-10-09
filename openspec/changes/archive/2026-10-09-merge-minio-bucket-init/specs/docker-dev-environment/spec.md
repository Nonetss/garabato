## MODIFIED Requirements

### Requirement: Hot-reloading Docker dev stack

The repo SHALL provide `compose.dev.yml`, with compose project name `stack-dev`, running `frontend`, `backend`, `gateway` and `loki`, plus `minio` under the `minio` profile, on the stack's private network. Like production, the `gateway` SHALL be the only service that publishes a port (`4321:4321`, see "HTTPS and HTTP/2 dev entry on the usual port"). `frontend`, `backend`, `loki` and `minio` SHALL use `expose` only, and no dev service SHALL use `network_mode: host`. Each app SHALL run its development server from source: the frontend `astro dev` on `0.0.0.0:4320` and the backend `bun --hot` on `:3000`. The gateway SHALL reach them as `frontend:4320` and `backend:3000`, the apps SHALL reach Loki as `loki:3100`, the backend SHALL reach the object store at the `S3_ENDPOINT` of `.env` (`http://minio:9000` for the bundled one), and the backend SHALL reach the database through `DATABASE_URL`. `bun run dev` SHALL run `docker compose -f compose.dev.yml up --build --watch` and `bun run dev:down` SHALL remove the containers.

#### Scenario: Starting the dev stack

- **WHEN** a developer runs `bun run dev` with `DATABASE_URL` pointing at a reachable dev PostgreSQL
- **THEN** compose SHALL build the dev images, start all the services with file watching enabled, and the app SHALL be reachable at `https://localhost:4321`

#### Scenario: Single published port

- **WHEN** the dev stack runs
- **THEN** only the host port `4321` SHALL be bound by the stack, and the backend (`3000`), the frontend dev server (`4320`), Loki (`3100`) and MinIO (`9000`, `9001`) SHALL NOT be reachable from the host except through the gateway's routing

#### Scenario: Production-like routing in the dev stack

- **WHEN** the dev stack runs and the browser requests `https://localhost:4321/rpc/...`, `/api/...`, `/scalar` or `/openapi.json`
- **THEN** the gateway SHALL forward them to `backend:3000` and every other path to `frontend:4320`

### Requirement: Local object storage

`compose.dev.yml` SHALL define, under the `minio` profile, a `minio` service running the `pgsty/silo` image, with its root credentials taken from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` and its data in a named volume, reachable only on the stack's private network. The container SHALL start the server and create the `S3_BUCKET` bucket itself when it does not exist, and its healthcheck SHALL pass only once the server is live and the bucket exists; no separate init service SHALL exist. With that profile active (`COMPOSE_PROFILES=minio` and `S3_ENDPOINT=http://minio:9000` in `.env`) the backend SHALL wait for `minio` to be healthy; without it the backend SHALL use the store set in `.env` and wait for nothing. For native dev, `compose.dev.yml` SHALL define `minio-native` with the same definition under the `native` profile, published only on `127.0.0.1:9000` (the `S3_ENDPOINT` of `.env.example`); its console SHALL NOT be published. `bun run dev` SHALL NOT start it. The root scripts `minio:start` and `minio:stop` SHALL start (detached) and stop only `minio-native`.

#### Scenario: Uploads to an external store in the dev stack

- **WHEN** `.env` sets `S3_ENDPOINT` to the developer's own S3-compatible store, without the `minio` profile, and the developer runs `bun run dev` and uploads a PDF
- **THEN** no MinIO container SHALL start and the backend SHALL store the document in that store

#### Scenario: Uploads to the bundled store in the dev stack

- **WHEN** `.env` sets `COMPOSE_PROFILES=minio` and `S3_ENDPOINT=http://minio:9000` and the developer runs `bun run dev` and uploads a PDF
- **THEN** the backend SHALL store it in the dev MinIO's bucket, created by the `minio` container at startup, over the private network

#### Scenario: Standalone MinIO for native dev

- **WHEN** a developer runs `bun run minio:start`
- **THEN** only `minio-native` SHALL start, the bucket SHALL exist once it is healthy, only `127.0.0.1:9000` SHALL be bound on the host, and the apps started with `bun run dev:local` SHALL store documents in it with the default `S3_ENDPOINT`

#### Scenario: Data survives restarts

- **WHEN** a developer runs `bun run dev:down` and `bun run dev` again
- **THEN** the documents uploaded before SHALL still be in the MinIO volume
