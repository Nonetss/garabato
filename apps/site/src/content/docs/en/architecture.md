---
title: Architecture
description: How the gateway, frontend, backend, database and object store fit together, and how certificates and documents are protected.
order: 5
---

Garabato is a monorepo with two apps behind a Caddy gateway, plus PostgreSQL and an S3-compatible object store. Only the gateway publishes a port, so the browser sees a single origin and never talks to the backend, the database or the store directly.

| Service | Stack | Port | Role |
| --- | --- | --- | --- |
| Gateway | Caddy | `80` (published as `FRONTEND_PORT`) | Public HTTP entry point. The only place that maps paths to apps. |
| Frontend | Astro SSR, React | `4321` (internal) | The web interface. |
| Backend | Bun, Hono, oRPC, Better Auth, Drizzle | `3000` (internal) | Authentication, the API, signing. Owns the database and the object store. |
| PostgreSQL | PostgreSQL 17 | `5432` (internal) | Users, certificates, the library, versions, the signature records and the traces. |
| MinIO | S3-compatible | `9000` (internal only, nothing published) | The encrypted PDFs. Optional: any external S3-compatible store works. |
| Loki | Grafana Loki | `3100` (internal) | Optional activity log, browsable at `/admin/logs`. |

## Request paths

The gateway sends `/rpc`, `/api`, `/scalar` and `/openapi.json` to the backend and every other path to the frontend. `/health` answers `ok` for the healthcheck. Because the site and the API share one origin, the browser never makes cross-origin calls and session cookies just work.

On startup the backend applies the committed database migrations and creates the admin from `.env`.

## Anatomy of a signature

1. You press sign in the viewer. The frontend calls the backend over oRPC with the document version you are looking at, the certificate, where the stamp goes and the optional reason and place.
2. The backend checks your session and that both the document and the certificate are yours.
3. It decrypts the certificate (with the password you typed, or the remembered one) and the current version of the PDF.
4. It draws the visible stamp, if any, and signs the PDF: a detached CAdES signature over SHA-256 with the ESS signing-certificate-v2 attribute and the issuer chain embedded, under `SubFilter ETSI.CAdES.detached` (PAdES baseline B-B). When `TSA_URL` is set, it asks that time-stamping authority for an RFC 3161 timestamp over the signature and embeds it (B-T); if the TSA gives none, the signature fails instead of being stored as B-B.
5. The signed PDF is encrypted and stored as a new version, and a record lands in the signature log.

## Security model

- **Envelope encryption.** Every certificate and every document gets its own random data key, wrapped by the master key `CERTIFICATE_ENCRYPTION_KEY`. Values (the PKCS#12 file, a remembered password, each document version) are sealed with AES-256-GCM, bound to the record and slot they belong to, so a value only opens where it was sealed.
- **The store holds ciphertext only.** PDFs are encrypted before they are written to the object store, and the store never serves files directly: every download goes through the API, which decrypts it.
- **Certificate passwords are not kept** unless you ask the app to remember one, and then they are encrypted the same way.
- **Everything is per user.** Documents and certificates belong to the signed-in user; another user's answer as not found.
- **Sessions** are `httpOnly`, `Secure`, `SameSite=Lax` cookies. `/rpc` never accepts `GET`, and `/api` rejects cross-site top-level navigations, which keeps CSRF out without a client plugin.

## The API

The API is versioned under `/rpc/v1` (oRPC, used by the frontend) and `/api/v1` (OpenAPI, for scripts and other services). The interactive reference lives at `/scalar` and the raw specification at `/openapi.json`, both for admins only.

From scripts, authenticate with an API key sent as the `x-api-key` header (see [Users and sign-in](../authentication/)):

```bash
curl -H "x-api-key: $GARABATO_KEY" https://sign.example.com/api/v1/document/list
```
