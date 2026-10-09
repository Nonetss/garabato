## Why

The bundled MinIO needs a second, one-shot container (`minio-init`, and `minio-native-init` in dev) whose only job is creating the `S3_BUCKET` bucket. Once it has run it stays behind as an exited container in every deployment. On top of that, MinIO's web console is published on `127.0.0.1:9001` even though nothing in the app uses it. Operators can manage the store with `mc` inside the container instead.

## What Changes

- **Bucket creation moves into the MinIO container itself**:
  - The `minio` service starts the server and creates `S3_BUCKET` when it does not exist (idempotent).
  - Its healthcheck only passes once the server is live and the bucket exists.
- **BREAKING (compose layout)**: the `minio-init` service is removed from `compose.prod.yml` and `compose.yml`, and `minio-init` and `minio-native-init` are removed from `compose.dev.yml`. `docker compose up` does not remove the leftover container from an earlier deploy; running it with `--remove-orphans`, or one `docker rm garabato-minio-init`, cleans it up.
- **Backend dependency**: the backend in `compose.yml` and `compose.dev.yml` (dev with `required: false`) waits for a healthy `minio` instead of a completed `minio-init`. In `compose.prod.yml` nothing depends on MinIO, as before.
- **Console not published**:
  - `compose.prod.yml` and `compose.yml` drop MinIO's `127.0.0.1:9001` mapping.
  - In `compose.dev.yml`, `minio-native` keeps only `127.0.0.1:9000`, which native dev needs for the S3 API, and `minio` stops listing `9001` in `expose`.
  - The gateway becomes the only service with `ports` in `compose.yml` and `compose.prod.yml`.
- **Scripts and docs**:
  - `bun run minio:start` starts only `minio-native`.
  - The README, the site docs (deploy, architecture, configuration, in English and Spanish), `.env.example` and the `stack` skill references stop mentioning the init service and the published console. Where the docs used to describe the console, they now show the `mc` alternative.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docker-production-deployment`: the gateway becomes the only published port in both production compose files. `compose.prod.yml` and `compose.yml` run MinIO as one service that creates its own bucket, with no `minio-init` and no published console. The healthcheck and startup-order rules lose the one-shot service, and the backend in `compose.yml` waits for a healthy `minio`.
- `http-gateway`: "Internal services are never exposed" no longer allows MinIO's console on the loopback, so MinIO publishes no port in production.
- `docker-dev-environment`: the dev `minio` and `minio-native` create their own bucket, with no init services. `minio-native` publishes only `127.0.0.1:9000`, and `minio:start` starts only `minio-native`.

## Impact

- **Compose files:** `compose.prod.yml`, `compose.yml` and `compose.dev.yml`.
- **Scripts:** `package.json` (`minio:start`).
- **Docs:**
  - `README.md` and `.env.example`.
  - `apps/site/src/content/docs/{en,es}/deploy.md`, `architecture.md` and `configuration.md`.
  - `.agents/skills/stack/references/docker.md`, `references/commands.md`, `references/workspaces.md` and `SKILL.md`.
- **Unchanged:** application code, images, database and env variables.
- **Existing deployments:** the old `garabato-minio-init` container stays until it is removed with `--remove-orphans`. Anyone who used the console through an SSH tunnel loses it and uses `mc` instead.
