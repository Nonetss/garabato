## MODIFIED Requirements

### Requirement: Feature-nested router

The router SHALL group procedures by feature, nesting each feature's procedures under its own key (for example `v1.health.check`, `v1.apiKey.create`, `v1.private.getPrivateData`). Client calls SHALL address procedures as `<version>.<feature>.<method>`, never as a flat top-level name and never omitting the version. The `v1` router SHALL contain the features `health`, `private`, `authConfig`, `apiKey`, `organization`, `plugins`, `sessionHistory`, `logs`, `cron`, `comment` and `entityIcon`.

#### Scenario: Client calls a nested procedure

- **WHEN** a client invokes a procedure through the typed client
- **THEN** the call SHALL take the form `orpc.<version>.<feature>.<method>()`

### Requirement: Cross-site request protection

The API handlers SHALL resist CSRF attacks based on the session cookie without relying on a client-side plugin:

- The RPC handler under `/rpc` SHALL accept the `POST`, `PUT`, `PATCH` and `DELETE` methods for every procedure, SHALL accept `QUERY` only for procedures whose declared HTTP method is `GET` or `QUERY`, and SHALL reject `GET`.
- The OpenAPI handler under `/api` SHALL reject `GET` requests that a browser makes as a top-level navigation from another site (`Sec-Fetch-Site` `cross-site` or `none` with `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document`), and SHALL let through requests without Fetch Metadata headers (server-to-server clients).
- Authentication cookies SHALL be marked `SameSite=Lax` or stricter, so browsers do not send them on cross-site unsafe methods. `QUERY` is not a CORS-safelisted method, so a cross-site `QUERY` needs a preflight that only the configured origin passes.

#### Scenario: GET to the RPC handler

- **WHEN** a client sends `GET /rpc/v1/health/check`
- **THEN** the system SHALL NOT invoke the procedure and SHALL respond with an error

#### Scenario: QUERY to a read procedure over RPC

- **WHEN** the frontend sends `QUERY /rpc/v1/comment/counts` from its own origin
- **THEN** the procedure SHALL run with the session's context

#### Scenario: QUERY to a write procedure over RPC

- **WHEN** a client sends `QUERY /rpc/v1/comment/create`
- **THEN** the system SHALL NOT invoke the procedure and SHALL respond with an error

#### Scenario: Cross-site navigation to a REST GET

- **WHEN** a browser navigates from another site to `GET /api/v1/cron/list` carrying the session cookie
- **THEN** the system SHALL respond `403 Forbidden` without invoking the procedure

#### Scenario: Server-to-server REST call

- **WHEN** a server-side client calls `GET /api/v1/cron/list` with a user's credentials and no `Sec-Fetch-*` headers
- **THEN** the procedure SHALL run with that user's context

#### Scenario: Same-origin call from the frontend

- **WHEN** the frontend calls a procedure over `/rpc` with `POST` from its own origin
- **THEN** the procedure SHALL run with the session's context

### Requirement: RPC client method selection

The frontend's RPC link SHALL send a call with `QUERY` when it is a read: a call TanStack Query makes as a `query` or `infinite` operation, or a direct `.call()` whose client context marks it as a read. Every other call, including mutations and streamed operations, SHALL be sent with `POST`. The read marker SHALL be a typed field of the frontend's client context, never a cast or an untyped property.

#### Scenario: Query hook

- **WHEN** a component reads `orpc.v1.cron.list` through `useQuery(orpc.v1.cron.list.queryOptions(...))`
- **THEN** the request SHALL be `QUERY /rpc/v1/cron/list`

#### Scenario: Direct read inside a custom query function

- **WHEN** a hook calls `orpc.v1.comment.counts.call(input, { context: { read: true } })` inside its own `queryFn`
- **THEN** the request SHALL be `QUERY /rpc/v1/comment/counts`

#### Scenario: Mutation

- **WHEN** a component runs `orpc.v1.comment.create` through `useMutation`
- **THEN** the request SHALL be `POST /rpc/v1/comment/create`

