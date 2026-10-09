## Context

The bundled MinIO (`pgsty/silo`, a MinIO build) runs in four places:

- `minio` in `compose.prod.yml`, under the `minio` profile.
- `minio` in `compose.yml`, always on.
- `minio` in `compose.dev.yml`, under the `minio` profile.
- `minio-native` in `compose.dev.yml`, under the `native` profile.

Each one is paired with a one-shot `*-init` service that runs `mc mb --ignore-existing` for `S3_BUCKET` and exits. Bun's S3 client cannot create buckets, which is why that step exists. `compose.prod.yml` and `compose.yml` also publish the MinIO console on `127.0.0.1:9001`, and `minio-native` publishes it next to its S3 API.

Facts about the image, checked with `docker run --entrypoint …`:

- `/usr/bin/docker-entrypoint.sh` maps `server` to `silo` and ends in `exec`, so the PID of the process started in the background is the server's own PID.
- The image ships `sh`, `mc` and `curl`.
- The entrypoint points `HOME` at `/tmp` when root's home is not writable, so `mc` keeps its config there.

## Goals / Non-Goals

**Goals:**

- One container per MinIO. Nothing sits exited in `docker ps -a` after startup.
- The bucket is guaranteed to exist whenever `minio` is healthy, so `service_healthy` is enough for whoever depends on it.
- MinIO publishes no port in `compose.prod.yml` and `compose.yml`, and `minio-native` publishes only the S3 API that native dev needs.
- Stopping the container stays clean, with the signal reaching the server.

**Non-Goals:**

- Having the backend create the bucket.
- Changing the external store setup, the env variables or `scripts/bootstrap.sh`.
- Replacing the image or routing the console through the gateway.

## Decisions

### Inline wrapper entrypoint in the `minio` service

The `minio` service overrides `entrypoint` with `sh -c` and an inline script, with `$` escaped as `$$` for compose:

1. Remove the readiness marker (`/tmp/minio-bucket-ready`). It survives a container restart, because `/tmp` lives in the container's writable layer.
2. Start `/usr/bin/docker-entrypoint.sh server /data --console-address :9001` in the background and keep its PID.
3. Install `trap` on `TERM` and `INT` that forwards the signal to that PID, waits for the server and exits with its code.
4. Loop until `mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"` and `mc mb --ignore-existing "local/$S3_BUCKET"` both succeed, sleeping 1 s between tries. If the server process has died in the meantime (`kill -0` fails), exit with an error so `restart: unless-stopped` acts.
5. Create the marker.
6. `wait` on the server. If the server exits on its own, the container exits with its code; on a stop signal the trap does. A second `wait` after the first is avoided: on an already reaped PID it returns 127.

The container gets `S3_BUCKET` in its `environment`, next to the `MINIO_ROOT_*` variables it already receives.

The healthcheck becomes `CMD-SHELL`: `test -f /tmp/minio-bucket-ready && curl -fsS -o /dev/null http://localhost:9000/minio/health/live`.

Alternatives considered:

- **Backend creates the bucket on startup:** Bun's `S3Client` has no bucket operation. It would mean hand-signing SigV4 or adding `@aws-sdk/client-s3` for a single call. Discarded.
- **Script in a mounted file or a custom image:** `compose.prod.yml` is deployed on its own with its `.env`, and there are no MinIO assets in the repo. An inline script keeps the deployment self-contained. Discarded.
- **Pre-creating `/data/<bucket>` before starting the server:** MinIO in `xl-single` mode does not reliably recognise directories created outside it as buckets. Discarded.
- **`init: true` (tini) instead of `trap`:** tini only forwards signals to its direct child, the `sh`. A `trap` is still needed for the signal to reach the server. Discarded.

### The console stays on `:9001` inside the container

`--console-address ":9001"` stays, but nothing publishes it. Without the flag MinIO picks a random port on every start. A fixed internal port is more predictable and exposes nothing. Administration is done with `docker exec <container> mc …`.

### Who waits for MinIO

- `compose.yml`: the backend waits for `minio: service_healthy`.
- `compose.dev.yml`: the backend waits for `minio: service_healthy` with `required: false`, so it waits only when the profile is on.
- `compose.prod.yml`: no service depends on MinIO, as before.

### Shared definition in dev

The wrapper and the healthcheck live in the `x-minio` anchor, so `minio` and `minio-native` inherit them. The `x-minio-init` anchor and the `MINIO_HOST` variable disappear. `minio-native` keeps only `127.0.0.1:9000:9000`, `minio` keeps `expose: ["9000"]`, and `minio:start` starts only `minio-native`.

## Risks / Trade-offs

- **[Inline script in YAML]** It is harder to read and to escape (`$$`). → Keep it short, one step per line using the YAML `|` block, and comment on it in the compose file. In dev it is defined once in the anchor. In `compose.prod.yml` and `compose.yml` it is copied, as the rest of the service already is.
- **[A bucket error does not show as a crash]** If `mc mb` keeps failing, for example because `S3_BUCKET` has an invalid name, the container stays up but never becomes healthy. → The loop logs `mc`'s output, `docker compose ps` shows `unhealthy`, and `compose.yml` and dev do not start the backend.
- **[Leftover container in existing deployments]** `garabato-minio-init` stays as an orphan. → Documented: `docker compose … up -d --remove-orphans`.
- **[Loss of the console]** Anyone who used it through an SSH tunnel loses it. → The deployment docs replace that section with how to use `mc` through `docker exec`.

## Migration Plan

1. Deploy the new `compose.prod.yml` with `docker compose -f compose.prod.yml --env-file .env up -d --remove-orphans`. `minio` is recreated, finds the existing bucket and reports healthy. The orphaned `minio-init` is removed.
2. Rollback: put the previous `compose.prod.yml` back and run `up -d`. The volume and the bucket do not change.
