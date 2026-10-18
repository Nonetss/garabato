## Context

See proposal.md for the motivation and specs/ for the behaviour. The starting point is the archived change `2026-10-18-browser-certificate-token`:

- `packages/api/src/v1/certificate-token/` holds `createKey` (session; creates the API key with the `certificateToken` permission, `rateLimitEnabled: false`, one-year expiry), `listKeys`, `revokeKey` and the token-key procedures; `src/shared/token-window.ts` keeps signing windows in memory, which already assumes a single backend instance.
- `native/pkcs11` builds `libgarabato_pkcs11.so` with `cargo`; it reads `$XDG_CONFIG_HOME/garabato/token.json` and refuses it unless owner-only.
- The gateway sends `/api/*` to the backend, whose OpenAPI handler serves every procedure at `/api/v1/<feature>/<method>`. `CORS_ORIGIN` is the single public origin the browser uses.
- `apps/backend/Dockerfile` builds on `oven/bun:*-slim` (Debian); the runtime runs from `/app/apps/backend`.

## Goals / Non-Goals

**Goals:**
- One pasted command connects a browser; no Rust, no file edited by hand, no browser settings.
- The token key never appears on screen, in a URL or in shell history.
- A private-network installation hands out the module without internet.

**Non-Goals:**
- Windows and macOS; distribution packages (AUR, `.deb`); auto-update of an installed module (running a new command replaces it).
- Flatpak and Snap browsers (their sandbox cannot load a module from the home folder): detected and reported only.
- A browser extension.
- Signing the module or the script beyond HTTPS plus the SHA-256 the redeem response carries.

## Decisions

### The key is created when the code is redeemed, not before

`startConnection` (session, 2FA required) stores `{ code, userId, name, expiresAt, keyId: null }` in an in-memory store (`src/shared/install-codes.ts`, injectable clock like `token-window.ts`). `redeem` (public; the code is the credential) takes the code and the architecture, deletes the entry, creates the API key exactly as `createKey` does today, records the key id for `connectionStatus` (kept until the original expiry), and answers `{ url: CORS_ORIGIN, key, moduleSha256 }`. Until redeemed, no key exists, so an abandoned dialog leaves nothing behind and the key is never held in memory.

Codes: 8 characters from Crockford's base32 alphabet (no I, L, O, U), from `crypto.getRandomValues`; 40 bits for 10 minutes makes guessing pointless, and each wrong redeem costs a request. Shown as `7KQ4-XMPA`, accepted with or without the dash, case-insensitive.

*Alternatives:* create the key up front and hand it to the script (the key would wait in memory or in the database); put the key in the command (shell history, screen).

### File responses through oRPC

`installScript` (`GET`, input `{ code }`) and `module` (`GET`, input `{ arch }`) are `publicProcedure`s whose handlers return a `File` (`text/x-shellscript` and `application/octet-stream`); the OpenAPI handler streams it as the body. The first task verifies this with `call()` and with the OpenAPI handler; if oRPC v2 beta mishandles it, the two become plain Hono routes in `apps/backend/src/routers/` calling the same `packages/api` functions, mounted before the OpenAPI handler. The command is:

```sh
curl -fsSL 'https://garabato.lan/api/v1/certificateToken/installScript?code=7KQ4XMPA' | sh
```

### Where the module files come from

The backend resolves `../../native/pkcs11/dist/<arch>/libgarabato_pkcs11.so` from its working directory (the same trick as the migrations) and computes each file's SHA-256 once, on first request. `native/pkcs11/scripts/build-dist.sh` builds the host architecture into `dist/` for native dev; the Docker image builds both.

Dockerfile stage `module`: `FROM rust:1-slim-bookworm`, installs `gcc-aarch64-linux-gnu`, adds the `aarch64-unknown-linux-gnu` target, sets `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER`, copies only `native/pkcs11` (its own layer cache), builds both targets with cache mounts for the registry and `target/`, and copies the two `.so` files into the runtime stage. Bookworm's glibc 2.36 keeps the module loadable on current distributions. The dev compose image (`Dockerfile.dev`) does not build it: dev serves whatever `build-dist.sh` left, which `compose.dev.yml` mounts read-only into the backend (`.dockerignore` keeps `dist/` out of the image and out of watch syncs), and the script reports a missing architecture clearly.

*Alternative:* GitHub Releases (rejected by the user: it needs internet and release discipline).

### The install script

A POSIX `sh` template in `native/pkcs11/install/install.sh`, with `@@URL@@` and `@@CODE@@` placeholders filled by the handler (values validated: the URL comes from the env, the code matches the alphabet, so no shell injection). It runs with `set -eu` and `umask 077`, and in this order — nothing irreversible happens before the code is redeemed, and the code is redeemed only once the module is in place:

1. `uname -m` → `x86_64` or `aarch64` (`arm64` maps to `aarch64`); otherwise stop.
2. Check `curl`, `sha256sum`, `modutil`, `certutil`; name the package for Arch (`nss`), Debian/Ubuntu (`libnss3-tools`) and Fedora (`nss-tools`).
3. While `firefox`, `chromium` or `chrome` is running (`pgrep -x`), ask to close it and wait (NSS databases must not be written while the browser has them open).
4. Download the module to a temp file in `~/.local/lib/garabato/`.
5. Redeem (`curl -fsS -X POST … /redeem`), parse `key` and `moduleSha256` with `sed` (no `jq` dependency), check the hash, move the module into place.
6. Write `~/.config/garabato/token.json` (600).
7. For every profile directory with a `cert9.db` under `~/.mozilla/firefox/` and `~/.config/mozilla/firefox/`, and for `~/.pki/nssdb` (created with `certutil -N --empty-password` when missing): `modutil -delete "Garabato"` (ignoring failure), then `-add`.
8. Report `~/.var/app/*firefox*` / `~/snap/firefox` installs as unsupported.
9. Copy `uninstall.sh` (same folder, static) next to the module.

`install.sh` is linted with `shellcheck` when available and tested by running it against a stub server in `native/pkcs11/tests/install/` (temp `HOME`, fake `uname`, real `modutil` on temp NSS databases).

### Frontend

The connect dialog keeps its two-factor gate and name form; after submit it shows the command (copyable, with `CopyButton`), the code formatted `7KQ4-XMPA` and a countdown, and polls `connectionStatus` every 2 s while open (TanStack Query `refetchInterval`, stopped on connected or expired). Connected: a confirmation with how to use it, and the list of browsers is invalidated. Expired: a message and "Generar otro comando". `BrowserConnectedDialog` and the manual steps go away.

## Risks / Trade-offs

- [`curl … | sh` runs code from the server] → the server is the user's own Garabato over its own origin; the script is short, readable at the same URL, and the dialog says so. The binary is checked against the hash from the same origin, which guards against truncated downloads, not against a compromised server (out of scope).
- [Codes live in memory] → a backend restart drops pending codes; the dialog shows "expired" and offers a new one.
- [Cross-compiling adds minutes to the backend image build] → its own stage, cached by `native/pkcs11` content and cache mounts; CI only rebuilds the backend image when its inputs change.
- [Firefox profile layouts differ between distributions] → both known roots are scanned and the script prints which profiles it registered, so a missing one is visible.
- [Browsers running while installing] → the script waits instead of writing NSS databases in use.
- [Removing `createKey` breaks any client that used it] → only the certificates page called it; the frontend changes in the same change.

## Migration Plan

Existing connected browsers keep working (their keys and the module's config do not change). Deploy the new backend image; run the new command on a laptop to switch it from a hand-built module to the served one (the script replaces the registration). Rollback: the previous image; installed modules keep working with either.
