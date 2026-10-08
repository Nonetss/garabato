## 1. Vite dependency cache in the dev stack

- [x] 1.1 In `compose.dev.yml`, mount a named volume `frontend_vite_cache` on the `frontend` service at `/app/apps/frontend/node_modules/.vite` and declare it under the top-level `volumes` next to `loki_data`, with a short comment explaining why it exists
- [x] 1.2 Update the header comment of `compose.dev.yml` if needed so it still accurately says there are no bind mounts (named volumes only)

## 2. Astro dev server warmup

- [x] 2.1 In `apps/frontend/astro.config.mjs`, add the four view-transition modules (`astro/virtual-modules/transitions-events.js`, `transitions-router.js`, `transitions-swap-functions.js`, `transitions-types.js`) to `vite.optimizeDeps.include`, with a comment on why `<ClientRouter />` needs them listed
- [x] 2.2 Add `vite.server.warmup` with `clientFiles` (`./src/features/**/index.ts`, `./src/components/shared/layout/*.tsx`, `./src/components/ui/sonner.tsx`) and `ssrFiles` (`./src/pages/**/*.astro`, `./src/middleware.ts`), with a comment on why the barrels are the island entries

## 3. Documentation

- [x] 3.1 Document the `frontend_vite_cache` volume, its purpose and the `down -v` reset in `.agents/skills/stack/references/docker.md` (`compose.dev.yml` section)

## 4. Validation

- [x] 4.1 Run `bun run check-types` and `bunx biome check` on the changed files and fix any issue
- [x] 4.2 Run `docker compose -f compose.dev.yml config --quiet` to validate the compose file (no containers started or stopped)
- [x] 4.3 Ask the user to restart the dev stack themselves and confirm that the frontend log no longer shows `optimized dependencies changed. reloading` on the first load, and that a second `bun run dev` start reuses the cache

## 5. Gateway: shared routes and dev HTTPS site

- [x] 5.1 Move the site body of `apps/gateway/Caddyfile` (encode, headers, `/health`, routing) into `apps/gateway/routes.caddy`, and make the `Caddyfile` site `import routes.caddy`, keeping production behavior identical
- [x] 5.2 Create `apps/gateway/Caddyfile.dev`: global `admin off`, `http_port {$GATEWAY_HTTP_PORT:8080}`, `auto_https disable_redirects`, `skip_install_trust`, `servers { protocols h1 h2 }`; an HTTP site on `:{$GATEWAY_HTTP_PORT:8080}` and `https://localhost:4321 { tls internal }`, both importing `routes.caddy`
- [x] 5.3 Copy `Caddyfile`, `Caddyfile.dev` and `routes.caddy` into `/etc/caddy` in `apps/gateway/Dockerfile` (production `CMD` unchanged)
- [x] 5.4 Validate both Caddyfiles with `caddy validate` in a throwaway `caddy:2-alpine` container (no running service touched)

## 6. Dev wiring on `:4320`

- [x] 6.1 `apps/frontend/package.json`: `dev` runs `astro dev --port 4320`. `apps/frontend/astro.config.mjs`: `vite.server.strictPort: true`. `apps/frontend/Dockerfile.dev`: `CMD ["bun", "run", "dev"]`, `EXPOSE 4320`, updated comment
- [x] 6.2 `compose.dev.yml` gateway: `command` with `Caddyfile.dev`, `FRONTEND_HTTP_UPSTREAM: localhost:4320`, volume `gateway_data:/data`, watch `sync+restart` for `Caddyfile.dev` and `routes.caddy` (replacing the `Caddyfile` rule), updated comments, `gateway_data` declared under `volumes`
- [x] 6.3 `apps/gateway/compose.yml`: same `command`, upstream, `gateway_data` volume and comments for native dev
- [x] 6.4 Root `package.json`: `dev:cert` script exporting the CA root from `stack-dev_gateway_data` to `caddy-local-root.crt`. `.gitignore`: ignore `caddy-local-root.crt`
- [x] 6.5 `.env.example`: `BETTER_AUTH_URL` and `CORS_ORIGIN` to `https://localhost:4321` with updated comments. Update the developer's `.env` the same way (only those two lines)

## 7. Documentation

- [x] 7.1 `README.md`: dev URLs, native dev needs `bun run gateway`, one-time CA trust (`bun run dev:cert` + browser import), `:4320` in the ports list
- [x] 7.2 Stack skill references: `docker.md` (dev stack, gateway compose, Dockerfiles), `commands.md` (`gateway`, `dev:local`, `dev:cert`), `workspaces.md` (frontend dev port, gateway files), `env.md` (dev origin), plus `SKILL.md` and `AGENTS.md` where they state the dev URL

## 8. Single published port in dev

- [x] 8.1 `compose.dev.yml`: drop `network_mode: host`. Frontend/backend get `expose` and the `BACKEND_URL` / `LOKI_URL` overrides. The gateway publishes `4321:4321` with upstreams `backend:3000` / `frontend:4320` and `depends_on`
- [x] 8.2 `apps/frontend/Dockerfile.dev`: `CMD ["bun", "run", "dev", "--host", "0.0.0.0"]`
- [x] 8.3 `Caddyfile.dev`: only the `https://localhost:4321` site (drop `:8080` and `http_port`). `apps/gateway/compose.yml` drops `GATEWAY_HTTP_PORT`
- [x] 8.4 Loki: shared `x-loki` definition, internal `loki` and `loki-native` (profile `native`, `127.0.0.1:3100`). `loki:start` / `loki:stop` target `loki-native`
- [x] 8.5 Docs: README, `doc/02`, `doc/09`, stack references (`docker.md`, `env.md`, `commands.md`, `workspaces.md`)

## 9. Service worker only in production

- [x] 9.1 New `apps/frontend/src/layouts/service-worker.astro`: registers `/sw.js` after `load` only when `import.meta.env.PROD`. In dev it unregisters every registration and deletes `stack-shell-v1`
- [x] 9.2 `Layout.astro` and `Admin.astro` render `<ServiceWorker />` instead of their inline registration scripts

## 10. Final validation

- [x] 10.1 `bun run check-types`, Biome on changed files, `docker compose -f compose.dev.yml config --quiet` and `docker compose -f apps/gateway/compose.yml config --quiet`
- [x] 10.2 Ask the user to update `.env` if not done, restart the dev stack, run `bun run dev:cert`, trust the CA and confirm that only `4321` is published, that the console shows no service worker errors after one reload, that `https://localhost:4321` loads over `h2` (Network → Protocol column), sign-in works and HMR applies an edit
