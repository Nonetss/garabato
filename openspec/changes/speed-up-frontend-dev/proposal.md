## Why

Pages take a long time to load in development while production is fast. The frontend container logs show that SSR is not the bottleneck (6–40 ms per page, 6–12 ms for `get-session`). The time is spent in the browser and the Vite dev server. Every island is `client:only="react"`, so nothing shows until Vite transforms and serves the island's whole unbundled module graph on demand. Each time the dev stack starts, the container is recreated with an empty Vite dependency cache. The first page load then re-optimizes dependencies and forces a full reload (`[vite] optimized dependencies changed. reloading`, triggered by Astro's `transitions-*` virtual modules being discovered late).

## What Changes

- Persist the frontend's Vite dependency cache across dev container recreations with a named volume in `compose.dev.yml`, so `bun run dev` no longer starts from a cold cache.
- Pre-declare in `optimizeDeps.include` the Astro view-transition modules that `<ClientRouter />` injects, so Vite optimizes them at startup instead of on the first page load, which removes the forced reload.
- Warm up the dev server at startup (`vite.server.warmup`) with the island entry modules (the feature barrels mounted from `.astro` pages) and the SSR pages and middleware, so the first visit doesn't pay for on-demand transforms.
- Serve the dev app over HTTPS with HTTP/2 at the same address, `https://localhost:4321`. The cost that remains is hundreds of unbundled modules over HTTP/1.1, which browsers cap at six connections per origin. Browsers only speak HTTP/2 over TLS, and Vite drops HTTP/2 whenever `server.proxy` is set (this project proxies `/rpc`, `/api`…), so the dev gateway (Caddy) takes `:4321` with a locally trusted certificate and HTTP/2, and `astro dev` moves behind it to `localhost:4320`. This applies to both the Docker dev stack and native dev (`bun run dev:local` + `bun run gateway`).
- The Docker dev stack mirrors production's single entry point: only the gateway publishes a port (`4321`). Frontend, backend and Loki leave the host network for the stack's private network and are reached by service name, with compose overriding only `BACKEND_URL` and `LOKI_URL`. The dev gateway's plain-HTTP site on `:8080` is dropped. Native dev's Loki becomes a `loki-native` service (profile `native`) published on `127.0.0.1:3100` only.
- **BREAKING (dev only)**: the dev origin becomes `https://localhost:4321`. `BETTER_AUTH_URL` and `CORS_ORIGIN` in `.env` / `.env.example` switch from `http` to `https`, existing dev sessions must sign in again (secure-prefixed cookies), native dev needs `bun run gateway` running, and each developer imports the gateway's local CA into their browser once (`bun run dev:cert`).
- The gateway's routes move to a shared `apps/gateway/routes.caddy`, imported by the production `Caddyfile` (unchanged behavior: HTTP-only site) and by a new dev-only `Caddyfile.dev`.
- Register the PWA service worker only in production builds. In dev it intercepted every unbundled Vite module, re-fetched it and wrote a copy to Cache Storage, which slowed every page and failed some module loads (`ServiceWorker intercepted the request and encountered an unexpected error`). Dev pages now unregister any worker left on the origin and delete its cache.
- Out of scope: changing the `client:only="react"` convention. Production behavior is not affected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docker-dev-environment`: adds requirements that the dev stack keeps the frontend's Vite dependency cache across container recreations, that the Astro dev server pre-optimizes the view-transition modules and warms up island and page modules at startup, and that the dev app is served over HTTPS + HTTP/2 at `https://localhost:4321` by the gateway with `astro dev` on `:4320`. Modifies the hot-reloading stack (private network, only the gateway published), Loki, native-dev configuration, Astro proxy target, dev image and coexistence requirements accordingly.
- `http-gateway`: the routing lives in a shared `routes.caddy` imported by the production `Caddyfile` and a dev-only `Caddyfile.dev`. The dev gateway serves only `https://localhost:4321` (HTTPS + HTTP/2): in the Docker dev stack it is the only published port, in front of `backend:3000` and `frontend:4320`. In native dev it runs on the host network in front of `localhost:3000` and `localhost:4320`. The `:8080` dev site is removed.

- `pwa`: the service worker is registered only in production builds, and dev unregisters it and clears its cache.

## Impact

- `apps/frontend/src/layouts/service-worker.astro` (new), used by `Layout.astro` and `Admin.astro` instead of their inline registration scripts.

- `compose.dev.yml`: a new named volume mounted on the frontend's Vite cache directory. This is not a bind mount, so the container keeps its own `node_modules`.
- `apps/frontend/astro.config.mjs`: `vite.optimizeDeps.include` and `vite.server.warmup`. Applies to native dev (`bun run dev:local`) as well. Dev-only settings, ignored by `astro build`.
- `apps/gateway/`: new `routes.caddy` and `Caddyfile.dev`. The `Caddyfile` imports the routes, the `Dockerfile` copies the three files, and `apps/gateway/compose.yml` (native dev) uses `Caddyfile.dev`, the new upstream and the CA volume.
- `compose.dev.yml`: no more `network_mode: host`. The gateway publishes `4321:4321`, uses `Caddyfile.dev`, upstreams `backend:3000` / `frontend:4320` and a `gateway_data` volume (local CA). The frontend runs `astro dev` on `0.0.0.0:4320`. The apps get `BACKEND_URL` / `LOKI_URL` overrides. Loki is internal, plus a `loki-native` profile service on `127.0.0.1:3100`. Root `loki:start` / `loki:stop` scripts target it.
- `apps/frontend/package.json` / `Dockerfile.dev`: dev port `4320`.
- `.env.example` (and the developer's `.env`): `https://localhost:4321` for `BETTER_AUTH_URL` and `CORS_ORIGIN`. Root `package.json`: `dev:cert` script. `.gitignore`: the exported CA file.
- Docs: `README.md` and the stack skill references (`docker.md`, `commands.md`, `workspaces.md`, `env.md`).
- Production images, `compose.yml` and `compose.prod.yml` keep the same behavior. The gateway image gains two config files, and its production site is unchanged.
- No API, database or dependency changes.
