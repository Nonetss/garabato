## MODIFIED Requirements

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

### Requirement: Gateway HTTP site in host-network dev

The dev gateway SHALL run `apps/gateway/Caddyfile.dev`, which imports the same `routes.caddy`. Its only site SHALL be `https://localhost:4321`, with a certificate from Caddy's local CA and HTTP/2, which is the dev URL. It SHALL NOT redirect HTTP to HTTPS and SHALL NOT try to install its CA into a trust store. In the Docker dev stack (`compose.dev.yml`), the gateway SHALL run on the stack's private network, publish only `4321:4321` and point `BACKEND_HTTP_UPSTREAM` and `FRONTEND_HTTP_UPSTREAM` at `backend:3000` and `frontend:4320`. For native dev (`bun run gateway`, which runs `apps/gateway/compose.yml`), it SHALL run on the host network and point them at `localhost:3000` and `localhost:4320`. Neither SHALL bind the host's port 80.

#### Scenario: Normal dev URL in native dev

- **WHEN** a developer runs the apps natively plus `bun run gateway` and opens `https://localhost:4321`
- **THEN** the gateway SHALL serve the app over TLS with HTTP/2 and the same routing as production, proxying pages to `astro dev` on `localhost:4320`

#### Scenario: Normal dev URL in the Docker dev stack

- **WHEN** the Docker dev stack runs and a developer opens `https://localhost:4321`
- **THEN** the gateway SHALL serve the app over TLS with HTTP/2, proxying API paths to `backend:3000` and pages to `frontend:4320` over the private network
