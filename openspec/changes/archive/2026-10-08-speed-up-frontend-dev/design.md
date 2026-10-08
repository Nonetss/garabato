## Context

In development (Docker dev stack via `bun run dev`), pages take a long time to appear, while production is fast. The evidence from the dev container logs:

- SSR is fast: `[200] /admin/users 19ms`, `/config 10ms`, and the backend's `get-session` takes 6–12 ms. Neither the remote dev database nor the session round trip is the bottleneck.
- Every island is `client:only="react"` (a project convention), so the page is empty until the browser has fetched and executed the island's module graph. In dev, Vite serves that graph unbundled, transforming each module the first time it is requested. That means hundreds of requests in a waterfall over HTTP/1.1.
- On the first load after `bun run dev`, Vite logs `dependencies optimized: astro/virtual-modules/transitions-*.js` followed by `optimized dependencies changed. reloading`. The container is recreated on every start, so its `node_modules/.vite` cache is empty every time.

`compose.dev.yml` syncs source with `develop.watch` and deliberately avoids bind mounts so the container keeps its own `node_modules` (bun `linker = "isolated"`). Production uses `astro build`, which bundles and minifies everything and is not affected.

## Goals / Non-Goals

**Goals:**
- Remove the forced full reload on the first page load after starting the dev stack.
- Keep Vite's dependency optimization across dev container recreations.
- Move module transform work from the first visit to dev server startup.

- Serve the dev app over HTTP/2 to lift the six-connections-per-origin limit, without changing the address developers use (`localhost:4321`).

**Non-Goals:**
- Changing the `client:only="react"` convention or switching islands to SSR hydration.
- Any behavior change to production images, `compose.yml`, `compose.prod.yml` or `astro build` output. The gateway image only gains config files its production command never reads.

## Decisions

### Named volume on `/app/apps/frontend/node_modules/.vite`

Mount a named volume (`frontend_vite_cache`) on the frontend service at Vite's default cache directory. Astro keeps Vite's default `cacheDir` (`<project root>/node_modules/.vite`), and the project root in the container is `/app/apps/frontend`.

- *Why a named volume:* it survives `down`/`up` and image rebuilds but is not a bind mount, so it doesn't conflict with the "no bind mounts, container-owned `node_modules`" rule. Docker overlays it onto the image's `node_modules` only at that subpath.
- *Alternative: set `vite.cacheDir` to a path outside `node_modules` (e.g. `.astro/vite`):* this would change native dev behavior too and gives nothing extra. Rejected.
- *Invalidation:* Vite stores a hash of the lockfile, the relevant config and `optimizeDeps` in `_metadata.json` and re-optimizes when it differs, so a stale volume after a `bun.lock` change is handled by Vite itself. `bun run dev:down` removes containers but not volumes. `docker compose -f compose.dev.yml down -v` resets the cache if ever needed.

### Pre-optimize the view-transition modules

Add the four modules Vite discovered late (`astro/virtual-modules/transitions-events.js`, `transitions-router.js`, `transitions-swap-functions.js`, `transitions-types.js`) to the existing `vite.optimizeDeps.include`, next to `@base-ui/react/**`. They are injected by the `<ClientRouter />` script in `Layout.astro`, which Vite's import scanner doesn't see. That is why they trigger the late re-optimization and reload. Only modules with evidence of late discovery are added. Listing every heavy dependency (lucide, TanStack Query, oRPC) is unnecessary, because the scanner already finds them through the `.tsx` imports.

### `vite.server.warmup`

- `clientFiles`: `./src/features/**/index.ts`. Astro hydrates a `client:only` island by importing the module the `.astro` page imported it from, which is the feature barrel (`@/features/admin/users`…). Warming the barrels transforms each island's whole client graph at startup. Add `./src/components/shared/layout/*.tsx` and `./src/components/ui/sonner.tsx` for the islands mounted directly from layouts (`ScrollToTopButton`, `SectionNavOverview`, `Toaster`).
- `ssrFiles`: `./src/pages/**/*.astro` and `./src/middleware.ts`, so the first SSR request doesn't pay for compiling pages and layouts.
- *Why globs, not a hand-kept list:* new features and pages are covered without editing the config, and the stack skill discourages hand-copied enumerations.

Warmup runs once in the background at startup; it doesn't block `astro dev` from listening.

### HTTPS + HTTP/2 at `https://localhost:4321`, terminated by the dev gateway

Browsers only negotiate HTTP/2 over TLS. The Caddyfile's existing `h2c` is cleartext HTTP/2, which no browser speaks. Two ways to get TLS + HTTP/2 on `:4321`:

- *Vite `server.https`:* rejected. Vite downgrades to HTTPS over HTTP/1.1 whenever `server.proxy` is configured, and the frontend relies on the proxy for `/rpc`, `/api`, `/scalar` and `/openapi.json`.
- *Caddy in front (chosen):* the dev gateway already exists and already has the production routing. It listens on `:4321` with TLS and `protocols h1 h2`, forwards the API paths straight to the backend and everything else to `astro dev`, which moves to `:4320`. Caddy talks HTTP/1.1 to Vite over the local network, where the connection limit doesn't apply. The Vite proxy stays configured (harmless) for anyone hitting `:4320` directly.

`:4320` rather than `:4322`: Astro dev servers that find `:4321` taken (now held by the gateway) fall back upward to `:4322`, `:4323`…, so another Astro project on the machine would grab the port above. Nothing picks `:4320` automatically. `astro dev --port 4320` is set in `apps/frontend/package.json`'s `dev` script, so native dev and `Dockerfile.dev` (which drops its `--port` override) agree. It is not set in `astro.config.mjs`'s `server.port`, which the Node adapter could bake into the production build. The production frontend keeps `PORT=4321` inside its container.

`h3` is left out (`protocols h1 h2`). It would need UDP and `Alt-Svc` upgrades for no measurable gain over loopback.

### Dev-only Caddyfile with shared routes

The production `Caddyfile` must stay an HTTP-only site with `auto_https off` (TLS terminates in front of it). The dev gateway needs TLS on a second site. Global options can't be split per environment inside one file, so:

- `apps/gateway/routes.caddy`: the site body (compression, security headers, `/health`, backend/frontend routing), unchanged.
- `apps/gateway/Caddyfile`: production global options plus `:{$GATEWAY_HTTP_PORT:80} { import routes.caddy }`. Same behavior as today.
- `apps/gateway/Caddyfile.dev`: global options `admin off`, `auto_https disable_redirects` (never bind `:80`), `skip_install_trust` (the container can't touch the host trust store), `servers { protocols h1 h2 }`. Its only site is `https://localhost:4321 { tls internal; import routes.caddy }`. The former plain-HTTP dev site on `:8080` is dropped, because `:4321` already routes like production.
- The gateway `Dockerfile` copies all three files into `/etc/caddy`, and the production `CMD` keeps using `Caddyfile`. `compose.dev.yml` and `apps/gateway/compose.yml` override the command to use `Caddyfile.dev` and `sync+restart` all three files.
- *Alternative: a second, standalone dev Caddyfile:* rejected, because duplicating the routes would let dev and production drift apart.

### Docker dev stack: one published port, private network

The user wants dev to expose a single port, like production. The Docker dev stack therefore leaves `network_mode: host`:

- **Network.** `frontend`, `backend` and `loki` join the stack's default network with `expose` only. The gateway is the only service with `ports` (`4321:4321`). Its upstreams are `backend:3000` and `frontend:4320`.
- **Frontend.** `Dockerfile.dev` runs `bun run dev --host 0.0.0.0`, because Vite binds loopback by default, which another container can't reach.
- **Addresses.** The root `.env` keeps the `localhost` values native dev needs. Compose overrides only container addresses, as `compose.yml` already does: `BACKEND_URL=http://backend:3000` for the frontend (SSR session lookups and the Vite proxy, which reads `process.env` first) and `LOKI_URL=http://loki:3100` for both apps. `BETTER_AUTH_URL` / `CORS_ORIGIN` stay `https://localhost:4321`, the browser's origin through the gateway.
- **Database.** The backend reaches the external dev PostgreSQL through Docker's NAT. This only works if the compose network's subnet doesn't overlap the database's address. On this machine Docker allocates from `172.52.0.0/16` (`default-address-pools`) and the database is on `172.19.1.0/24`, so there is no overlap. A machine whose Docker pool overlaps the dev database would need a pinned subnet.
- **HMR.** It is unchanged. The Vite client connects to the page's origin (`wss://localhost:4321`), and Caddy forwards the upgrade to `frontend:4320`. Vite's host check accepts `localhost`.
- **Loki for native dev.** Native apps on the host still need Loki at `localhost:3100`. Compose YAML has a shared `x-loki` definition used by two services: `loki` (internal, started by `bun run dev`) and `loki-native` (profile `native`, `127.0.0.1:3100`, started by `loki:start`). Both share the `loki_data` volume, and only one runs at a time.
- *Alternative: keep host networking and bind every app to loopback:* rejected. The ports would still be open on the host, and the user asked for a single exposed port.

Native dev can't hide its ports: the apps are host processes on `:3000` and `:4320`, and its gateway (`apps/gateway/compose.yml`) stays on the host network so it can reach them. It adds only `:4321`, and sign-in only works there.

### Local certificate authority

`tls internal` makes Caddy issue the `localhost` certificate from its own local CA, so nothing has to be installed on the host. The CA lives in Caddy's data dir, which goes on a named volume `gateway_data:/data`. Both dev compose files use the project name `stack-dev`, so they share the volume `stack-dev_gateway_data` and therefore the same CA. The root is valid for ten years. Caddy renews the intermediate and leaf certificates on its own.

`bun run dev:cert` copies the root out of the volume (`docker run --rm -v stack-dev_gateway_data:/data:ro caddy:2-alpine cat …/root.crt`) into `caddy-local-root.crt` at the repo root, which is git-ignored. The developer imports it once as a trusted authority in the browser.

*Alternative: mkcert on the host:* rejected by the user, because it means installing extra tools.

### Origin change in `.env`

The origin includes the scheme, so `BETTER_AUTH_URL` and `CORS_ORIGIN` become `https://localhost:4321` in `.env.example` and in the developer's `.env`. `BACKEND_URL` stays `http://localhost:3000` for native dev, because SSR session lookups go straight to the backend. The Docker dev stack overrides it with the service name. Better Auth already sets `secure: true` on its cookies. With an `https` base URL it also prefixes them `__Secure-`, so existing dev sessions need a new sign-in. `compose.yml` and `compose.prod.yml` set their own origins and are unaffected. `packages/api/tests/setup.ts` is hermetic and keeps its value.

### Service worker only in production

`public/sw.js` intercepts every same-origin GET outside the API paths, re-fetches it and `cache.put`s a copy. In production that is a handful of hashed chunks. In dev it is every unbundled module, on every page load, and the browser console showed module loads failing inside the worker. The registration moves into `src/layouts/service-worker.astro`, which both layouts include instead of their duplicated inline scripts:
- In production (`import.meta.env.PROD`) it keeps the same inline script: register after `load`.
- In dev it unregisters every registration on the origin and deletes `stack-shell-v1`. A browser that installed the worker on `localhost:4321` before this change is cleaned up on its next visit, with no manual DevTools step.
- *Alternative: make `sw.js` bypass `/src/`, `/node_modules/`, `/@vite/`, `/@fs/`…:* rejected. It couples the production worker to Vite's dev URL layout and still runs the worker on every dev request.

The first dev load after the change may still pass through the old worker, because the worker controls the page until it unregisters. From the next load on, requests go straight to the network.

## Risks / Trade-offs

- [Warmup adds CPU work at dev server startup, on every `astro.config.mjs` restart] → It runs in the background and transforms the same modules the first visit would. If startup becomes noticeably heavy, narrow `clientFiles` to `*-page.tsx` entries.
- [The view-transition module ids are Astro internals and may be renamed in a future Astro release] → Vite logs a warning and skips an `include` entry it can't resolve, so a rename at worst brings back the reload. Re-check the dev log after upgrading `astro`.
- [The named volume can hold an optimization for a dependency set no longer in use] → Vite's hash check re-optimizes. `down -v` is the manual reset.
- [Unbundled module requests remain intrinsic to Vite dev] → HTTP/2 multiplexes them over one connection. It doesn't remove them.
- [Each developer must trust the gateway's local CA once, or the browser shows a certificate error] → `bun run dev:cert` exports the root, the README documents the import, and the `gateway_data` volume keeps the same CA across restarts. `dev:down -v` would generate a new CA, which then has to be imported again.
- [Native dev without the gateway no longer authenticates, because the origin in `.env` is `https://localhost:4321`] → Documented. `astro dev` on `http://localhost:4320` still renders for quick checks, but sign-in only works on the gateway origin.
- [Existing dev sessions are lost: an `https` base URL makes Better Auth use `__Secure-` cookie names] → One-time sign-in. Production is unaffected.
- [HMR websocket through Caddy] → Vite's client derives the HMR socket from the page's host, port and protocol when `hmr.clientPort` is unset, so it connects to `wss://localhost:4321`. Caddy proxies WebSocket upgrades transparently.
- [Subnet overlap between the compose network and the external dev database would break DB access from the Docker dev stack] → Not the case on this machine (`172.52.0.0/16` pool vs `172.19.1.53`). Documented as the thing to check if the backend can't reach the database.
- [`astro dev` falls back to another port if `:4320` is busy, and Caddy then proxies to the wrong place] → `vite.server.strictPort: true` makes it fail loudly.

## Migration Plan

1. Update `.env`: `BETTER_AUTH_URL` and `CORS_ORIGIN` become `https://localhost:4321`.
2. `bun run dev:down`, then `bun run dev`. This rebuilds the gateway image and creates the `gateway_data` and `frontend_vite_cache` volumes.
3. `bun run dev:cert` and import `caddy-local-root.crt` as a trusted authority in the browser. Restart the browser if it doesn't pick it up.
4. Open `https://localhost:4321` and sign in again.

Rollback: revert the change and restore the `http` origins in `.env`. `docker volume rm stack-dev_frontend_vite_cache stack-dev_gateway_data` cleans up the volumes.

## Open Questions

None.
