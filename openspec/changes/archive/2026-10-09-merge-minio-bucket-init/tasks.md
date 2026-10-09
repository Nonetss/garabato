## 1. Production compose files

- [x] 1.1 In `compose.prod.yml`, replace the `minio` command with the inline wrapper from design.md:
  - It clears the marker, starts `docker-entrypoint.sh server /data --console-address :9001` in the background, sets up a `trap` on TERM/INT, loops `mc alias set` + `mc mb --ignore-existing` until both succeed (exiting if the server has died), creates the marker and `wait`s on the server (the trap itself waits for it and exits with its code).
  - Add `S3_BUCKET` to its `environment`.
  - Switch the healthcheck to `CMD-SHELL` marker + `/minio/health/live`.
  - Remove `ports`.
  - Delete the `minio-init` service and update the comments.
- [x] 1.2 Apply the same to `compose.yml`. The backend's `depends_on` swaps `minio-init: service_completed_successfully` for `minio: service_healthy`.
- [x] 1.3 Check with `docker compose config` against a throwaway env file in the scratchpad: `compose.yml`, plus `compose.prod.yml` with and without `--profile minio`. No `minio-init` and no `ports` other than the gateway's.

## 2. Dev compose and scripts

- [x] 2.1 In `compose.dev.yml`, move the wrapper, `S3_BUCKET` and the new healthcheck into `x-minio`. Delete `x-minio-init`, `minio-init` and `minio-native-init`.
- [x] 2.2 In `compose.dev.yml`:
  - Leave `minio` with `expose: ["9000"]`.
  - Leave `minio-native` with only `127.0.0.1:9000:9000`.
  - Make the backend wait for `minio: service_healthy` with `required: false`.
  - Update the header comment (`minio:start` without the console) and the service comments.
- [x] 2.3 Change `minio:start` in `package.json` to `docker compose -f compose.dev.yml --profile native up -d minio-native`.
- [x] 2.4 Check `compose.dev.yml` with `docker compose config`, with the `minio` profile, the `native` profile and neither.

## 3. Wrapper check (only with the user's go-ahead)

- [x] 3.1 Ask the user whether to start a throwaway MinIO to check the wrapper. If they agree:
  - Use its own compose project and an anonymous volume, without touching any running stack.
  - Check that it becomes healthy, the bucket exists and a restart keeps it.
  - Check that `docker stop` stops it without reaching the timeout.
  - Clean it up afterwards.

## 4. Documentation

- [x] 4.1 Update `README.md`: the `minio-init` mentions, the published console (`127.0.0.1:9001`), the `minio:start` line, and the `--remove-orphans` note for existing deployments.
- [x] 4.2 Update `apps/site/src/content/docs/{en,es}/deploy.md`:
  - Bucket creation by the `minio` container itself.
  - Replace the "MinIO console" section with administration through `docker exec … mc`.
  - Add `--remove-orphans` when updating.
- [x] 4.3 Update `apps/site/src/content/docs/{en,es}/architecture.md` (MinIO's port, internal only), `apps/site/src/content/docs/{en,es}/configuration.md` and `.env.example` (who creates the bucket).
- [x] 4.4 Update the `stack` skill:
  - `references/docker.md` (dev, `compose.yml` table and `compose.prod.yml`).
  - `references/commands.md` (`minio:start`).
  - `references/workspaces.md` and `SKILL.md` (the gateway is the only `ports`).

## 5. Validation

- [x] 5.1 Run `bunx biome check` on the touched files that Biome covers. Search for `minio-init`, `minio-native-init` and `9001` outside `openspec/changes/archive` to confirm no stale mentions remain.
- [x] 5.2 Run `openspec validate merge-minio-bucket-init`.
