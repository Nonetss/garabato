## Context

See proposal.md and the delta spec. Relevant current state:

- `packages/api/src/index.ts` → `tokenProcedure` resolves the token key and its owner through `src/shared/token-key.ts` (`resolveTokenCaller`) before every token procedure; the install procedures (`startConnection`, `redeem`, `installScript`, `module`) live in `src/v1/certificate-token/`.
- Token keys are Better Auth API keys (`apikey` table); `metadata` is a free text column the plugin stores as JSON and returns parsed. Nothing in the app uses it yet.
- No table holds application settings. The admin area (`/admin/*`) is built from `apps/frontend/src/features/admin/*` and declared in `apps/frontend/src/lib/app-surfaces.ts`; the activity log is the request logger shipped to Loki (`/admin/logs`).
- The module (`native/pkcs11/src/client.rs`) maps 403 on `sign` to "window closed" (marks the token logged out) and any other failure to an empty token or a failed signature.

## Goals / Non-Goals

**Goals:**
- An administrator stops the token, the installs, or old modules from the web, effective on the next request.
- Refusals never look like a closed signing window to any module, old or new.

**Non-Goals:**
- Ending sessions a site already authenticated (TLS resumption never reaches Garabato).
- Per-user or per-browser switches (disconnecting one browser already exists).
- Revoking every token key at once (turning the token off covers the emergency; keys stay for when it is turned back on).
- Pushing module updates to computers: a blocked browser is connected again by its user.

## Decisions

### One settings row in its own table

`browser_token_settings` in a new schema domain `packages/db/src/schema/browser-token/`: `id text primary key` (always `'default'`), `token_enabled boolean not null default true`, `installs_enabled boolean not null default true`, `min_module_version text` (nullable), `updated_at timestamp`, `updated_by text references user(id) on delete set null`. `src/shared/token-settings.ts` reads it with defaults when the row is missing and writes it with an upsert on `id`. The schema edit is part of the user's request; **the migration is generated and applied by the user** (task 1.2).

*Alternatives:* a generic `app_settings` key/value table (untyped, nothing else needs it yet); environment variables (rejected by the user: changes need a restart and server access).

No cache: the settings are one primary-key read per token request, which are a handful per sign-in, and an emergency switch must apply at once.

### Where the checks run

- `tokenProcedure` (after the key, owner and two-factor checks): token off → `SERVICE_UNAVAILABLE`; reported version below the minimum → `PRECONDITION_FAILED`. Both throw before the handler, so nothing is signed or traced.
- Install procedures: a `requireInstalls()` helper (token off or installs off → `SERVICE_UNAVAILABLE`) at the top of `startConnection`, `redeem` and `module`. `installScript` never throws (its body is piped to a shell): it serves a "disabled" script, Linux or PowerShell, that only prints the message.
- `connectionStatus`, `listKeys` and `revokeKey` keep working whatever the switches say, so users can still see and disconnect browsers.

### Versions

The header `x-garabato-module: <semver> <os>-<arch>` is parsed in `token-key.ts`; missing or malformed counts as `0.1.0` with platform `unknown`. Versions compare numerically per component (`major.minor.patch`, no pre-release). The minimum is validated as `^\d+\.\d+\.\d+$` on save.

The version a token key last reported goes into its API key `metadata` (`{ moduleVersion, platform }`) through `auth.api.updateApiKey` (server-side, `userId` set), only when it differs from what is stored, so a normal request writes nothing.

The version Garabato serves is `MODULE_VERSION` in `token-module.ts`, kept equal to `native/pkcs11/Cargo.toml` by a unit test that reads the crate manifest. This change bumps both to `0.2.0`.

### Procedures

In `certificate-token`:

| Procedure | Builder | Method | Returns |
|---|---|---|---|
| `switches` | protected | GET | `tokenEnabled`, `installsEnabled`, `minModuleVersion`, `servedVersion` (what the certificates page needs) |
| `settings` | admin | GET | the switches plus `updatedAt`, `updatedBy` (id and name) and browsers per version and platform |
| `updateSettings` | admin | PUT | the saved settings; logs `browser-token.settings.updated` with the admin id and old/new values |

`listKeys` gains `moduleVersion`, `platform` and `outdated` per browser. Browsers per version come from one query over `apikey` rows whose permissions include `certificateToken`, grouping the parsed metadata.

### Module

`client.rs` sends the header on every request (`env!("CARGO_PKG_VERSION")`, `std::env::consts::{OS, ARCH}`). 503 and 412 become their own outcomes, logged as `token-disabled` and `module-outdated`; `unlock` maps them to `CKR_DEVICE_ERROR` (the browser shows an error instead of asking for the code again), `sign` to a failed signature that does not touch the logged-in state, and `certificates` to an empty token (with the 10-second retry already in place).

### Frontend

- `features/admin/browser-token/` (surface `admin-browser-token`, `/admin/browser-token`, page under `pages/admin/browser-token/`): three rows with the shared `Switch` (and an input for the version), the served version, the last change, a table of browsers per version, and `ConfirmDialog` for the three restrictive changes, its text built from the counts.
- Certificates page: `useTokenSwitches()` feeds the connect dialog (disabled state instead of the form) and the connected browsers section (a disabled notice; an "desactualizado" tag on outdated rows).

## Risks / Trade-offs

- [An admin locks everyone out by mistake] → confirmations say how many browsers are affected; turning the switch back on restores everything, no key is lost.
- [Old modules (0.1.0) cannot show a reason] → they show an empty token; the certificates page tells the user to connect the browser again.
- [Version metadata written by token requests] → only when the version changes; the write goes through Better Auth's API, not raw SQL.
- [The migration is the user's step] → until it runs, reading the settings would fail; task order puts the migration before the code that reads the table is deployed.

## Migration Plan

1. Add the table to the schema; the user generates and applies the migration.
2. Deploy the backend and frontend. Defaults keep everything working as before.
3. Rebuild the image (module 0.2.0). Existing browsers keep working until an admin raises the minimum version.
