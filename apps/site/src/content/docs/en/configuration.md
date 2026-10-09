---
title: Configuration
description: The environment variables a deployment sets, and where the full list lives.
order: 4
---

All runtime configuration comes from environment variables. In a Docker deployment they live in the `.env` next to `compose.prod.yml`, which every service reads. The backend validates its variables at startup and exits with a clear error when one is missing or malformed.

The complete list, with every default and a comment per variable, is [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example) in the repository. These are the ones a deployment sets.

## Deployment

Read by `compose.prod.yml` itself.

| Variable | Notes |
| --- | --- |
| `FRONTEND_PORT` | Host port the gateway is published on. Default `4444`. |
| `POSTGRES_PASSWORD` | Password of the bundled `db` service. |
| `COMPOSE_PROFILES` | `minio` starts the bundled MinIO and creates its bucket. Leave it unset to use an external store. |

## Backend

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `CORS_ORIGIN` | yes | The public URL of the app, as the browser sees it. `compose.prod.yml` also passes it as `BETTER_AUTH_URL`. |
| `BETTER_AUTH_SECRET` | yes | At least 32 characters. Signs sessions and cookies. |
| `CERTIFICATE_ENCRYPTION_KEY` | yes | Base64 of exactly 32 bytes. Master key that encrypts the stored certificates and documents. Back it up, and never reuse it across environments. |
| `S3_ENDPOINT` | yes | S3-compatible endpoint, a full URL. The bundled MinIO is `http://minio:9000`. |
| `S3_BUCKET` | yes | The bucket must exist. The bundled MinIO creates it on startup. |
| `S3_REGION` | no | Default `us-east-1`; MinIO ignores it. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | yes | Store credentials. With the bundled MinIO they are also its root user and password (at least 8 characters). |
| `TSA_URL` | no | RFC 3161 time-stamping authority. When set, every signature carries its timestamp (PAdES B-T) and fails if the TSA cannot give one; unset, signatures are B-B. In production use a TSA you trust, such as a qualified trust service provider. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | no | The admin created at startup when all three are set. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_DISCOVERY_URL` | no | All three together enable single sign-on. See [Users and sign-in](../authentication/). |
| `LOG_LEVEL` | no | `info` by default. |

`compose.prod.yml` sets the addresses between containers itself (`BACKEND_URL`, `LOKI_URL`) and `NODE_ENV=production`, so you do not need them in `.env`.

## Limits

| What | Limit |
| --- | --- |
| PDF upload | 20 MiB, not password-protected. |
| PKCS#12 certificate | 100 KiB, `.p12` or `.pfx`. |
| Signature reason and place | 200 characters each. |
