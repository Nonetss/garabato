# HTTP Gateway

## Purpose

Provides a Caddy gateway as the single public HTTP entry point that routes API traffic to the backend and pages to the Astro frontend, keeping internal services unexposed.

## Requirements

### Requirement: Single public HTTP entry point

The gateway (`apps/gateway/Caddyfile`, Caddy) SHALL serve an HTTP site on port `GATEWAY_HTTP_PORT` (default `80`) that forwards `/rpc/*`, `/api/*`, `/scalar*` and `/openapi.json` to the backend's HTTP server (`BACKEND_HTTP_UPSTREAM`, default `backend:3000`) and every other request to the frontend's Astro server (`FRONTEND_HTTP_UPSTREAM`, default `frontend:4321`). Responses SHALL be compressed with zstd or gzip when the client accepts it. Because both apps are served on the same origin, the browser SHALL reach the API and Better Auth without cross-origin requests. The Caddyfile SHALL define only this HTTP site, with its admin API and automatic HTTPS disabled.

#### Scenario: API call on the page's origin

- **WHEN** the browser sends `POST /rpc/v1/...` or `GET /api/auth/get-session` to the public URL
- **THEN** the gateway SHALL forward it to the backend's HTTP server and relay the response, including its `Set-Cookie` headers, unchanged

#### Scenario: Page request

- **WHEN** the browser requests `/login`
- **THEN** the gateway SHALL forward it to the frontend and return the rendered page

#### Scenario: API documentation

- **WHEN** a client requests `/scalar` or `/openapi.json`
- **THEN** the gateway SHALL forward it to the backend

### Requirement: Internal services are never exposed

In `compose.prod.yml` the gateway SHALL be the only service with `ports`; the frontend, backend and Loki SHALL use `expose` only, and the `db` service SHALL publish no port. Nothing outside the Docker network SHALL reach the backend, the frontend, Postgres or Loki except through the gateway's HTTP site.

#### Scenario: Published ports in production

- **WHEN** `compose.prod.yml` is inspected
- **THEN** only the `gateway` service SHALL declare `ports`, mapping the public port to the gateway's HTTP site, and no service SHALL publish `3000`, `4321`, `5432` or `3100`

#### Scenario: Backend from the host in production

- **WHEN** the production stack runs and a client outside the Docker network connects to the backend's port `3000`
- **THEN** the connection SHALL fail, because that port is not published

### Requirement: Frontend container serves Astro only

The frontend production image SHALL run only the Astro standalone server, listening on `0.0.0.0:4321`, with no embedded reverse proxy. Its healthcheck SHALL request `/login` from Astro directly.

#### Scenario: Frontend health

- **WHEN** compose runs the frontend healthcheck
- **THEN** it SHALL request `http://localhost:4321/login` inside the frontend container and report healthy only if Astro answers successfully

### Requirement: Gateway HTTP site in host-network dev

The host-network gateway used in development (`bun run gateway`, which runs `apps/gateway/compose.yml`, and the `gateway` service of `compose.dev.yml`) SHALL set `GATEWAY_HTTP_PORT=8080` and point `BACKEND_HTTP_UPSTREAM` and `FRONTEND_HTTP_UPSTREAM` at `localhost:3000` and `localhost:4321`, so it never binds the host's port 80. Native dev SHALL keep using the Vite dev proxy at `http://localhost:4321`.

#### Scenario: Production-like entry in dev

- **WHEN** a developer runs the apps natively plus `bun run gateway` and opens `http://localhost:8080`
- **THEN** the gateway SHALL serve the app with the same routing as production, and `http://localhost:4321` SHALL keep working through Vite
