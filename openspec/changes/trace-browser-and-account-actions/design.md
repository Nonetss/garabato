## Context

Traces are rows of `trace_events` written by `recordTraces` (`packages/api/src/shared/trace.ts`) inside the action's transaction, with the client IP taken from `X-Forwarded-For`. Types are a TypeScript union over a `text` column and details a typed `jsonb`, so new types need no migration. The trail (`v1.trace.list`) maps each type to an output variant; the frontend has labels, icons, a tone and detail rows per type. The browser token procedures live in `packages/api/src/v1/certificate-token/`; account actions are Better Auth endpoints (`/api/auth/*`), outside the oRPC handlers.

## Goals / Non-Goals

**Goals:** every browser token and account action of the list leaves a trace; the listed security failures too; nothing secret is stored.

**Non-Goals:** library, tag, comment and icon actions (not asked); tracing refusals beyond the listed ones; alerts or notifications on failures; admin actions (they go to the activity log).

## Decisions

### Trace types and details

| Type | Details |
|---|---|
| `browser.connected` | `{ key: { id, name }, platform }` |
| `browser.disconnected` | `{ key: { id, name } }` |
| `browser.unlocked`, `browser.locked` | `{ key: { id, name } }` |
| `browser.unlockFailed` | `{ key: { id, name }, reason: "wrong-code" \| "locked-out" }` |
| `browser.installRefused` | `{ name, reason: "used" \| "expired" }` |
| `account.signedIn` | `{ method: "password" \| "sso", userAgent: string \| null }` |
| `account.signInFailed` | `{ reason: "wrong-password" \| "banned" }` |
| `account.signedOut`, `account.passwordChanged`, `account.twoFactorEnabled`, `account.twoFactorDisabled`, `account.twoFactorFailed` | none |
| `account.nameChanged` | `{ from, to }` (the existing rename shape) |

### Browser traces from the handlers

`recordTraces` takes a `Context`; the token procedures already have one. `redeem` writes `browser.connected` after the key exists; `revokeKey` after Better Auth deletes it; `unlock` writes `browser.unlocked` on success and `browser.unlockFailed` on a wrong code or lockout before throwing; `lock` writes `browser.locked`. Refused install codes: the in-memory store already keeps a redeemed or expired entry for one more period, so `redeem` can tell "used" or "expired" and who owns it; an unknown code stays untraced. `browser.installRefused` is written before the `NOT_FOUND`.

### Account traces from a Better Auth hook

`packages/auth` registers `hooks.after` (`createAuthMiddleware`) that looks at `ctx.path` and the outcome (`ctx.context.returned`: a response or an `APIError`; `ctx.context.newSession` on sign-in):

| Path | Trace |
|---|---|
| `/sign-in/email` ok, `/callback/:id` and `/oauth2/callback/:id` ok | `account.signedIn` (method, `user-agent` header) |
| `/sign-in/email` failed for an existing email | `account.signInFailed` (wrong password or banned) |
| `/sign-out` | `account.signedOut` (user from the session before it is gone, read in `hooks.before`) |
| `/update-user` with a new `name` | `account.nameChanged` (previous name read in `hooks.before`) |
| `/change-password` ok | `account.passwordChanged` |
| `/two-factor/enable` → `/two-factor/verify-totp` completing enrolment, `/two-factor/disable` ok | `account.twoFactorEnabled` / `account.twoFactorDisabled` |
| `/two-factor/verify-totp` failed at sign-in | `account.twoFactorFailed` |

The trace writer used there is a small function in `packages/db` (or `packages/auth`) that inserts into `trace_events` with the IP from the request headers; `packages/api`'s `recordTraces` keeps its signature and delegates to it, so both write the same rows. The exact paths and the shape of `ctx.context` in Better Auth 1.7.7 are confirmed by the first task with a hook test against the real `auth` instance and the fake database.

Two-step enrolment is "on" only when the first code is verified (the plugin flips `twoFactorEnabled` then), so the trace is written when `/two-factor/verify-totp` succeeds for a user whose flag was off before the request.

### Frontend

Labels and icons per type (`TRAIL_TYPE_LABELS`, `TRAIL_TYPE_ICONS`), `traceTone` marks `*Failed`, `browser.installRefused` and `browser.disconnected` as destructive, the description sentence and detail rows per the delta spec. The "Tipo" facet lists the new types automatically.

## Risks / Trade-offs

- [Better Auth internals (`ctx.context.returned`, paths) change on upgrade] → the hook's unit tests use the real plugin endpoints and fail on a change.
- [Failed sign-ins can be many (password guessing)] → one row each, like any trace; Better Auth's own rate limiting bounds them. No trace for unknown emails, so they cannot fill someone else's trail.
- [`browser.locked` on every browser exit] → it is what happened; the "Tipo" filter hides it.
- [Account traces are written outside the action's transaction] → Better Auth commits its own writes; the trace is written right after, so a crash between them could lose a trace (not a wrong one). Accepted.

## Migration Plan

No database migration. Deploy backend and frontend together (the trail output gains types the old frontend would not know).
