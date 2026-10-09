---
title: Deploy with Docker Compose
description: Install by hand with compose.prod.yml, put it behind HTTPS, or use an external PostgreSQL or object store.
order: 3
---

The installer only automates these steps. Doing them by hand gives you the same stack from `compose.prod.yml`: the gateway, frontend, backend, PostgreSQL and Loki, plus MinIO when you keep the documents in the bundled store. Only the gateway publishes a port on the host.

## 1. Get the compose file

In an empty directory on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/compose.prod.yml -o compose.prod.yml
touch .env && chmod 600 .env
```

## 2. Write `.env`

`compose.prod.yml` reads its whole configuration from the `.env` next to it. Generate the secrets:

| Variable | Generate with |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48` |
| `CERTIFICATE_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `S3_SECRET_ACCESS_KEY` (bundled MinIO) | `openssl rand -hex 32` |

Use hex for the database password: it ends up inside `DATABASE_URL`, where `/`, `+` and `=` would need escaping. Then fill in the rest:

```bash
FRONTEND_PORT='4444'
CORS_ORIGIN='https://sign.example.com'
POSTGRES_PASSWORD='…'
DATABASE_URL='postgresql://postgres:…@db:5432/stack'
BETTER_AUTH_SECRET='…'
CERTIFICATE_ENCRYPTION_KEY='…'

S3_ENDPOINT='http://minio:9000'
S3_BUCKET='documents'
S3_REGION='us-east-1'
S3_ACCESS_KEY_ID='garabato'
S3_SECRET_ACCESS_KEY='…'
COMPOSE_PROFILES='minio'

ADMIN_NAME='Admin'
ADMIN_EMAIL='admin@example.com'
ADMIN_PASSWORD='…'
```

`CORS_ORIGIN` is the public URL the browser sees; the compose file also uses it as Better Auth's base URL. Single quotes make Compose read each value literally, with no `$VAR` interpolation. The full list of variables, with their defaults, is in [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example); see [Configuration](../configuration/).

> Back up `.env`. Without `CERTIFICATE_ENCRYPTION_KEY`, the stored certificates and documents cannot be decrypted.

## 3. Start the stack

```bash
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d
```

On startup the backend applies the database migrations and creates the admin if it does not exist yet, so `up -d` is all there is. Services start in order (database, backend, frontend, gateway), each one waiting for the previous one's healthcheck. With the `minio` profile, a one-shot `minio-init` container creates the bucket.

## Behind HTTPS

Session cookies are marked `Secure`, so browsers only keep them over HTTPS or on `localhost`: plan on HTTPS for anything reachable by other machines.

The gateway serves plain HTTP on `FRONTEND_PORT`. Put your usual reverse proxy (Caddy, Traefik, nginx…) in front of it, terminate TLS there and forward everything to that port. Keep `CORS_ORIGIN` on the `https://` URL the browser sees. HSTS belongs to the proxy that terminates TLS, not to the gateway.

The frontend and the API are served from the same origin, so there is nothing else to route: `/rpc`, `/api`, `/scalar` and `/openapi.json` go to the backend and everything else to the frontend, inside the gateway.

## External object store

To keep the documents in your own S3-compatible service, leave `COMPOSE_PROFILES` unset (MinIO does not start) and point the `S3_*` variables at it:

```bash
S3_ENDPOINT='https://s3.eu-west-1.amazonaws.com'
S3_BUCKET='garabato-documents'
S3_REGION='eu-west-1'
S3_ACCESS_KEY_ID='…'
S3_SECRET_ACCESS_KEY='…'
```

The bucket must already exist. Documents are encrypted before they are written, and the store never serves them directly: every download goes through the API.

## External PostgreSQL

To use a managed database (RDS, Cloud SQL…), delete the `db` service and the backend's `depends_on` entry for it from `compose.prod.yml`, and point `DATABASE_URL` at it:

```bash
DATABASE_URL='postgresql://user:password@db.example.com:5432/garabato'
```

## Data and volumes

| Volume | Holds |
| --- | --- |
| `db_data` | Users, certificates (encrypted), the document library, versions and the signature log. |
| `minio_data` | The encrypted PDFs, when you use the bundled MinIO. |
| `loki_data` | The activity log shown at `/admin/logs`, kept for 30 days. |

Back up the database, the object store and `.env` together; see [Upgrading and backups](../upgrading/).

## The MinIO console

The bundled MinIO's S3 API stays on the Docker network. Its web console is published on the host's loopback only, at `127.0.0.1:9001`; reach it through an SSH tunnel:

```bash
ssh -L 9001:127.0.0.1:9001 user@server
```

Sign in with `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.
