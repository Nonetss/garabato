## ADDED Requirements

### Requirement: Server-wide request body cap

The backend's `Bun.serve` SHALL set `maxRequestBodySize` to 25 MiB, so Bun refuses a larger body on every route (`/rpc`, `/api`, `/api/auth/*` and any other Hono route) before buffering it. The cap SHALL stay above the document upload limit (21 MiB) so it never preempts the per-procedure limits, which keep answering `413` with the standard API error body.

#### Scenario: Body above the server cap

- **WHEN** a client sends a 30 MiB body to `/api/auth/sign-in/email`
- **THEN** Bun SHALL refuse the request with `413` and SHALL NOT buffer the whole body

#### Scenario: Upload limit still answers first

- **WHEN** a client sends a 23 MiB body to `/rpc/v1/document/upload`
- **THEN** the oRPC handler SHALL answer `413` with the standard API error body

#### Scenario: Normal upload

- **WHEN** a client uploads a 15 MiB PDF to `/rpc/v1/document/upload`
- **THEN** the request SHALL reach the procedure
