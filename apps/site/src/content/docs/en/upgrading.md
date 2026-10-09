---
title: Upgrading and backups
description: Update a running installation, pin an image, and back up what cannot be rebuilt.
order: 7
---

## The usual upgrade

From the directory that holds `compose.prod.yml` and `.env`:

```bash
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d --remove-orphans
```

`--remove-orphans` removes containers of services the new compose file no longer has, such as the old one-shot `minio-init`. The backend applies any new database migration when it starts. Upgrade the three images (gateway, frontend and backend) together.

When a release changes the compose file itself, download it again before pulling. Read the [release notes](https://github.com/Nonetss/garabato/releases) first.

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/compose.prod.yml -o compose.prod.yml
```

## Pin an image

`compose.prod.yml` uses the `:main` tag of `ghcr.io/nonetss/garabato-frontend`, `garabato-backend` and `garabato-gateway`. Every build of `main` is also published as `main-<sha>`, with the first eight characters of the commit. To stay on one build, change the three `image:` lines to the same `main-<sha>` tag.

## Back up

Three things together make an installation. Back them up at the same time, so they match:

| What | Where | Why |
| --- | --- | --- |
| The database | the `db_data` volume, or your external PostgreSQL | Users, certificates, the library, versions and the signature log. |
| The documents | the `minio_data` volume, or your bucket | The encrypted PDFs of every version. |
| `.env` | next to `compose.prod.yml` | Above all `CERTIFICATE_ENCRYPTION_KEY`. |

> **Without `CERTIFICATE_ENCRYPTION_KEY` the backups are useless.** It wraps the key of every stored certificate and document; a restored database and bucket cannot be decrypted without it. Keep a copy somewhere other than the server.

A dump of the bundled database:

```bash
docker compose -f compose.prod.yml exec db pg_dump -U postgres stack > garabato.sql
```

The Loki volume only holds the activity log and can be left out.
