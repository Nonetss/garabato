---
title: Users and sign-in
description: Accounts, the admin role, the first admin, single sign-on with any OIDC provider, and API keys.
order: 6
---

Sign-in is handled by Better Auth. Every page except `/login` and `/signup` requires a session, and every document and certificate belongs to the user who created it.

## Accounts

Email and password sign-in is always available. The `/signup` page is open: anyone who can reach the site can create an account, so keep the instance behind your own network or proxy rules if that is not what you want.

## The admin role

A user is either a global `admin` or not. Admins see the **Admin** section (`/admin`), where they can:

- Create and delete users, change their role or password, and ban or unban them (`/admin/users`).
- Review sessions (`/admin/sessions`).
- Manage organizations, teams and API keys.
- Browse the activity log (`/admin/logs`), when Loki is configured.

The interactive API reference at `/scalar` is for admins only.

## The first admin

The backend creates the admin described by `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 8 characters) and `ADMIN_NAME` every time it starts, if that user does not exist yet. It is idempotent: restarting neither duplicates the account nor changes its password. The installer fills in these three variables for you.

## Single sign-on (OIDC)

To add a corporate identity provider (Keycloak, Authentik, Google or anything OIDC-compliant), register a client in the provider and set three variables:

```bash
OIDC_CLIENT_ID=garabato
OIDC_CLIENT_SECRET=...
OIDC_DISCOVERY_URL=https://keycloak.example.com/realms/acme
```

`OIDC_DISCOVERY_URL` is the issuer's base URL; `/.well-known/openid-configuration` is appended to discover the endpoints. The scopes requested are `openid`, `profile` and `email`. Allow this redirect URI in the provider:

```text
https://sign.example.com/api/auth/oauth2/callback/oidc
```

If any of the three variables is empty, SSO stays off and the app boots with email and password only.

## API keys

API keys let scripts and other services call the API as a user. Send one in the `x-api-key` header; the request acts as the key's owner.

```bash
curl -H "x-api-key: $GARABATO_KEY" https://sign.example.com/api/v1/document/list
```

Admins manage the keys at `/admin/api-keys`. The API also accepts a Bearer token besides the session cookie.
