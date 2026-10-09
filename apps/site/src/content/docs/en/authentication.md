---
title: Users and sign-in
description: Accounts, the admin role, the first admin, single sign-on with any OIDC provider, and API keys.
order: 6
---

Sign-in is handled by Better Auth. Every page except `/login` and `/signup` requires a session, and every document and certificate belongs to the user who created it.

## Accounts

Email and password sign-in is always available. By default the `/signup` page is open: anyone who can reach the site can create an account. To close it, set `DISABLE_SIGN_UP=true`. Then `/signup` shows that registration is closed, the sign-in page drops its link, and nobody can create an account through the API or through single sign-on either. Existing users keep signing in, and admins create new accounts from `/admin/users`.

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

## Two-step verification

Each user can protect their password sign-in with a code from an authenticator app (Google Authenticator, 1Password, Aegis or any TOTP app). It is optional and off by default.

- **Turn it on** from the profile (`/me`): confirm your password, scan the QR code and enter the code the app shows. Keep the backup codes it displays: each one signs you in once if you lose the app.
- **Sign in**: after the password, the sign-in page asks for the 6-digit code, or a backup code. Tick "trust this device" to skip the code in that browser for 30 days.
- **Turn it off or get new backup codes** from the same row in the profile, again with your password.

It applies to password sign-in only: single sign-on relies on your identity provider's own verification, and API keys are not affected.

If a user loses both the app and the backup codes, an operator can turn it off in the database: set `two_factor_enabled` to `false` on their `user` row and delete their row in `two_factor`.

## API keys

API keys let scripts and other services call the API as a user. Send one in the `x-api-key` header; the request acts as the key's owner.

```bash
curl -H "x-api-key: $GARABATO_KEY" https://sign.example.com/api/v1/document/list
```

Admins manage the keys at `/admin/api-keys`. The API also accepts a Bearer token besides the session cookie.
