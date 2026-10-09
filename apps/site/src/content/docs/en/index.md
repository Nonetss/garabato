---
title: Getting started
description: Install Garabato on a Linux server with one command and sign in for the first time.
order: 1
---

Garabato signs PDFs with your own digital certificates. You import a PKCS#12 certificate, drop a PDF, place the visible signature and download the signed file. Certificates and documents are stored encrypted. It ships as three Docker images (gateway, frontend and backend) plus PostgreSQL and, optionally, a bundled MinIO for the documents.

## Requirements

- A Linux host with Docker and the Compose plugin (`docker compose`).
- `curl` and `openssl`, which the installer uses to download files and generate secrets.
- HTTPS in front of it for anything other than `localhost`: session cookies are `Secure`.

## Install with one command

Create an empty directory for the deployment, `cd` into it and run:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/scripts/bootstrap.sh | bash
```

The script is interactive even when piped, because it reads your answers from the terminal. It asks for:

1. The **port** to publish on the host (default `4444`) and the **public URL** the browser will use (for example `https://sign.example.com`). It warns you if the URL is plain `http://` and not `localhost`, because sign-in would fail.
2. The **first admin**: name, email and a password of at least 8 characters.
3. Where to **store documents**: the bundled MinIO (default) or an external S3-compatible store, whose bucket must already exist.

Then it generates every secret with `openssl`, writes `.env` (mode `600`), downloads `compose.prod.yml` if it is missing and, if you say so, pulls the images from `ghcr.io` and starts the stack. It refuses to run if a `.env` already exists, so it never overwrites an installation. Setting `PB_REF` on the `bash` side (`… | PB_REF=v0.1.0 bash`) picks which version of `compose.prod.yml` it downloads (default `main`); the images it references stay on `:main`.

> **Back up `.env`**, above all `CERTIFICATE_ENCRYPTION_KEY`. It encrypts the stored certificates and documents; if you lose it, they cannot be recovered.

## Sign in

The backend applies the database migrations and creates the admin from `.env` on startup, so there is no separate setup step. After a minute or two, open the public URL and sign in with the email and password you chose.

## Next steps

- [Your first signature](./first-run/): import a certificate, sign a PDF and download it.
- [Deploy with Docker Compose](./deploy/): the same installation by hand, behind HTTPS, or with an external database or object store.
- [Configuration](./configuration/): the environment variables that matter.
