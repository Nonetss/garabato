# HTTP Gateway

## Purpose

Provides a Caddy gateway as the single public HTTP entry point that routes API traffic to the backend and pages to the Astro frontend, keeping internal services unexposed.
## Requirements
### Requirement: Single public HTTP entry point

The gateway (`apps/gateway/Caddyfile`, Caddy) SHALL serve an HTTP site on port `GATEWAY_HTTP_PORT` (default `80`) that forwards `/rpc/*`, `/api/*`, `/scalar*` and `/openapi.json` to the backend's HTTP server (`BACKEND_HTTP_UPSTREAM`, default `backend:3000`) and every other request to the frontend's Astro server (`FRONTEND_HTTP_UPSTREAM`, default `frontend:4321`). Responses SHALL be compressed with zstd or gzip when the client accepts it. Because both apps are served on the same origin, the browser SHALL reach the API and Better Auth without cross-origin requests. The site's body (compression, security headers, `/health` and routing) SHALL live in `apps/gateway/routes.caddy`, imported by every gateway site, so production and dev never route differently. The production `Caddyfile` SHALL define only this HTTP site, with its admin API and automatic HTTPS disabled.

#### Scenario: API call on the page's origin

- **WHEN** the browser sends `POST /rpc/v1/...` or `GET /api/auth/get-session` to the public URL
- **THEN** the gateway SHALL forward it to the backend's HTTP server and relay the response, including its `Set-Cookie` headers, unchanged

#### Scenario: Page request

- **WHEN** the browser requests `/login`
- **THEN** the gateway SHALL forward it to the frontend and return the rendered page

#### Scenario: API documentation

- **WHEN** a client requests `/scalar` or `/openapi.json`
- **THEN** the gateway SHALL forward it to the backend

### Requirement: Baseline security headers

Every response from the gateway's HTTP site SHALL carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that disables `camera`, `microphone`, `geolocation`, `payment` and `usb`, and SHALL omit the `Server` header. The gateway SHALL NOT set `Strict-Transport-Security` (TLS is terminated in front of it) nor a `Content-Security-Policy`.

#### Scenario: Page response headers

- **WHEN** the browser requests `/login` through the gateway
- **THEN** the response SHALL include the four headers above and no `Server` header

#### Scenario: Framed by another origin

- **WHEN** a page on another origin embeds the app in an `<iframe>`
- **THEN** the browser SHALL refuse to render it

### Requirement: Internal services are never exposed

In `compose.prod.yml` the gateway SHALL be the only service with `ports`; the frontend, backend and Loki SHALL use `expose` only, and the `db` service and the bundled MinIO SHALL publish no port, neither its S3 API (`9000`) nor its console (`9001`), not even on the host's loopback. Nothing outside the Docker network SHALL reach the backend, the frontend, Postgres, Loki or MinIO except through the gateway's HTTP site; documents are stored and served only through the backend, and MinIO is administered with `mc` inside its container.

#### Scenario: Published ports in production

- **WHEN** `compose.prod.yml` is inspected
- **THEN** only the `gateway` service SHALL declare `ports`, mapping the public port to the gateway's HTTP site, and no service SHALL publish `3000`, `4321`, `5432`, `3100`, `9000` or `9001`

#### Scenario: Backend from the host in production

- **WHEN** the production stack runs and a client outside the Docker network connects to the backend's port `3000`
- **THEN** the connection SHALL fail, because that port is not published

#### Scenario: MinIO console from the host

- **WHEN** the production stack runs with the bundled MinIO and a client on the host itself connects to `127.0.0.1:9001`
- **THEN** the connection SHALL fail, because MinIO publishes no port

### Requirement: Frontend container serves Astro only

The frontend production image SHALL run only the Astro standalone server, listening on `0.0.0.0:4321`, with no embedded reverse proxy. Its healthcheck SHALL request `/login` from Astro directly.

#### Scenario: Frontend health

- **WHEN** compose runs the frontend healthcheck
- **THEN** it SHALL request `http://localhost:4321/login` inside the frontend container and report healthy only if Astro answers successfully

### Requirement: Gateway HTTP site in host-network dev

The dev gateway SHALL run `apps/gateway/Caddyfile.dev`, which imports the same `routes.caddy`. Its only site SHALL be `https://localhost:4321`, with a certificate from Caddy's local CA and HTTP/2, which is the dev URL. It SHALL NOT serve an HTTP site for HTTP→HTTPS redirects; a plain HTTP request to `:4321` SHALL be redirected to `https://` on the same port (Caddy's `http_redirect` listener wrapper). It SHALL NOT try to install its CA into a trust store. In the Docker dev stack (`compose.dev.yml`), the gateway SHALL run on the stack's private network, publish only `4321:4321` and point `BACKEND_HTTP_UPSTREAM` and `FRONTEND_HTTP_UPSTREAM` at `backend:3000` and `frontend:4320`. For native dev (`bun run gateway`, which runs `apps/gateway/compose.yml`), it SHALL run on the host network and point them at `localhost:3000` and `localhost:4320`. Neither SHALL bind the host's port 80.

#### Scenario: Normal dev URL in native dev

- **WHEN** a developer runs the apps natively plus `bun run gateway` and opens `https://localhost:4321`
- **THEN** the gateway SHALL serve the app over TLS with HTTP/2 and the same routing as production, proxying pages to `astro dev` on `localhost:4320`

#### Scenario: Normal dev URL in the Docker dev stack

- **WHEN** the Docker dev stack runs and a developer opens `https://localhost:4321`
- **THEN** the gateway SHALL serve the app over TLS with HTTP/2, proxying API paths to `backend:3000` and pages to `frontend:4320` over the private network

