# RPC API

## Purpose

Defines the oRPC API layer: typed request context and metadata, public, protected and permission-gated procedure builders, a versioned feature-nested router, typed contracts, standard errors, shared pagination, handler mounting, CSRF protection and client method selection.

## Requirements

### Requirement: Typed request context

The system SHALL build a per-request context exposing the resolved `user`, `session`, and request `headers` to every procedure. The context MUST be derived from the values populated by the session resolution middleware. The context type SHALL additionally allow an optional `cron` marker carrying the job id and job name, which is set only by in-process callers such as the scheduler and is never populated when building a context from an HTTP request.

#### Scenario: Procedure reads the authenticated user

- **WHEN** a procedure handler executes for an authenticated request
- **THEN** the context SHALL expose the current `user`

#### Scenario: HTTP request context carries no cron marker

- **WHEN** a context is built from an incoming HTTP request
- **THEN** its `cron` marker SHALL be absent, regardless of the request's headers or body

### Requirement: Typed procedure metadata

The procedure builders SHALL declare cross-cutting metadata through typed oRPC meta plugins shared by every procedure in every version: one for access (`access`) and one for cron eligibility or scheduling (`cron`). Each plugin SHALL check its value against the shared type (`AppAccess`, `CronMeta`) and expose a getter so the router walkers (cron discovery) read the metadata back from the router definition. Metadata SHALL be optional for every procedure, and the `access` value SHALL be stamped only by the builder that creates the procedure, never by hand.

#### Scenario: Procedure declares metadata

- **WHEN** a procedure declares cron eligibility through the `cron` meta plugin (for example `cronMeta({ eligible: true })`)
- **THEN** the value SHALL be type-checked against `CronMeta` and SHALL be readable from the router definition through that plugin's getter

#### Scenario: Procedure declares no metadata

- **WHEN** a procedure declares no `cron` metadata
- **THEN** it SHALL remain valid and the `cron` getter SHALL return `undefined`

#### Scenario: Ill-typed metadata

- **WHEN** a procedure passes a value that does not satisfy `CronMeta` to the `cron` plugin (for example both `eligible: true` and a `schedule`)
- **THEN** the type check SHALL fail

### Requirement: Public procedures

The system SHALL provide a public procedure builder that requires no authentication.

#### Scenario: Health check is publicly accessible

- **WHEN** any client calls the `v1.health.check` procedure
- **THEN** the system SHALL return `"OK"` without requiring authentication

### Requirement: Protected procedures

The system SHALL provide a protected procedure builder that rejects requests lacking an authenticated user with an `UNAUTHORIZED` error.

#### Scenario: Protected procedure without authentication

- **WHEN** a request without an authenticated user calls a protected procedure
- **THEN** the system SHALL throw an `UNAUTHORIZED` error and not execute the handler

#### Scenario: Protected procedure with authentication

- **WHEN** a request with an authenticated user calls a protected procedure
- **THEN** the handler SHALL execute with the user available on the context

### Requirement: Permission-gated procedures

The system SHALL provide a type-safe `permissionProcedure(resource, action)` builder for application operations authorized within an active organization. It SHALL accept only application resource/action pairs declared by the shared permission registry, SHALL allow global admins without an organization permission lookup, and SHALL require every other caller to hold the requested permission in the active organization.

#### Scenario: Unauthenticated caller requests a permission-gated procedure

- **WHEN** a request without an authenticated user and session calls a permission-gated procedure
- **THEN** the system SHALL throw `UNAUTHORIZED` and SHALL NOT execute the handler

#### Scenario: Global admin bypasses organization permission lookup

- **WHEN** an authenticated user whose global role is `admin` calls a permission-gated procedure
- **THEN** the handler SHALL execute without requiring an active organization or organization permission check

#### Scenario: Non-admin has no active organization

- **WHEN** an authenticated non-global-admin calls a permission-gated procedure without an active organization in the session
- **THEN** the system SHALL throw `FORBIDDEN` with a message indicating that an active organization is required

#### Scenario: Organization member has the requested permission

- **WHEN** an authenticated non-global-admin holds the requested application permission in the session's active organization
- **THEN** the handler SHALL execute with the authenticated user and session in context

#### Scenario: Organization member lacks the requested permission

- **WHEN** an authenticated non-global-admin does not hold the requested application permission in the session's active organization
- **THEN** the system SHALL throw `FORBIDDEN` and SHALL NOT execute the handler

### Requirement: Private data endpoint

The system SHALL provide a protected `v1.private.getPrivateData` procedure that returns the authenticated user together with a message.

#### Scenario: Authenticated user reads private data

- **WHEN** an authenticated user calls `v1.private.getPrivateData`
- **THEN** the system SHALL return the user and a private message

### Requirement: Feature-nested router

The router SHALL group procedures by feature, nesting each feature's procedures under its own key (for example `v1.health.check`, `v1.apiKey.create`, `v1.private.getPrivateData`). Client calls SHALL address procedures as `<version>.<feature>.<method>`, never as a flat top-level name and never omitting the version. The `v1` router SHALL contain the features `health`, `private`, `authConfig`, `apiKey`, `organization`, `plugins`, `sessionHistory`, `logs`, `cron`, `comment` and `entityIcon`.

#### Scenario: Client calls a nested procedure

- **WHEN** a client invokes a procedure through the typed client
- **THEN** the call SHALL take the form `orpc.<version>.<feature>.<method>()`

### Requirement: API versioning

The top-level router SHALL nest each API version's feature router under its own key on the `appRouter` object (for example `v1`), so the version segment is derived from the router's own structure rather than a hardcoded HTTP mount prefix. Multiple versions MAY coexist as sibling keys, and adding a new version MUST NOT require changing an existing version's router, procedures, or client call sites.

#### Scenario: Adding a new API version

- **WHEN** a new API version is introduced
- **THEN** its router SHALL be nested under a new top-level key (e.g. `v2`) alongside the existing versions, and no existing version's procedures SHALL need to change

#### Scenario: Version segment appears in every path derived form

- **WHEN** a procedure is invoked over RPC, over the REST/OpenAPI handler, or through the typed client
- **THEN** the version key SHALL appear as the first path segment (`/rpc/<version>/...`, `/api/<version>/...`) or first property access (`orpc.<version>...`) in every case, sourced from the same router object

### Requirement: Typed procedure contracts

Each procedure SHALL declare a zod output schema, and a zod input schema when it accepts parameters, so responses are validated and the OpenAPI document reflects real shapes.

#### Scenario: Response matches the declared output schema

- **WHEN** a procedure handler returns a value
- **THEN** the value SHALL conform to the procedure's declared output schema

### Requirement: Standard error map

The system SHALL declare the standard oRPC error codes (from `BAD_REQUEST` through `GATEWAY_TIMEOUT`) once on the base procedure builder, each with its default message. Each code's HTTP status SHALL be resolved by the handlers (`/rpc` and `/api`) from a single code→status map, never from the error definition itself. Procedures and middleware SHALL raise errors through the shared error constructors rather than constructing ad-hoc errors.

#### Scenario: Error responses carry the mapped status

- **WHEN** a procedure throws a declared error (for example `UNAUTHORIZED`) over `/rpc` or `/api`
- **THEN** the HTTP response status SHALL be the mapped code (for example 401)

#### Scenario: Status-only lookup

- **WHEN** a handler encodes a declared error
- **THEN** the HTTP status SHALL come from the handler's code→status map and the response body SHALL carry the code, the message and the data, without a `status` field

### Requirement: Per-feature source layout

Each RPC feature's request schema, response schema, handler, and router SHALL be colocated in a single source folder under its API version's folder (`src/<version>/<feature>/{input.ts,output.ts,handler.ts,router.ts}`), rather than split across separate layer-wide directories. Adding, moving, or removing a feature MUST NOT require editing files belonging to unrelated features or other versions. Shared infrastructure (`context.ts`, `errors.ts`, and the procedure builders in `index.ts`) SHALL live at the package root, outside any version folder, since it is common to every version.

#### Scenario: Adding a new feature

- **WHEN** a new RPC feature is added to a version's router
- **THEN** its request schema, response schema, handler, and router SHALL live together in one new folder under that version's `src/<version>/`, and no existing feature's files SHALL need to change

#### Scenario: Feature files import their own siblings

- **WHEN** a feature's router or handler needs its own input/output schema
- **THEN** it SHALL import it directly from its sibling file within the same feature folder

#### Scenario: Feature files reach shared infrastructure

- **WHEN** a feature's handler or router needs the request context, error constructors, or a procedure builder
- **THEN** it SHALL import it from the package root (`context.ts`, `errors.ts`, `index.ts`), not from a copy inside its version folder

### Requirement: Shared cursor pagination helper

Any procedure returning a cursor-paginated list SHALL build its page through the shared pagination helper (`#shared/pagination`) rather than reimplementing the over-fetch/slice/`hasMore` steps or the `"<field>|<id>"` cursor encode/decode pair locally. The helper SHALL give every endpoint it is applied to the same `limit` bounds, the same cursor string format, the same response shape, and a `BAD_REQUEST` error on a malformed cursor.

#### Scenario: Handler builds a page

- **WHEN** a handler needs to return a bounded page of rows plus a `hasMore`/next-cursor decision
- **THEN** it SHALL call the shared `paginate()` helper instead of writing its own `limit + 1` / slice / `hasMore` logic

#### Scenario: Handler encodes or decodes a keyset cursor

- **WHEN** a handler's pagination is a keyset cursor over an ordered `(timestamp, id)` pair
- **THEN** it SHALL use the shared cursor encode/decode pair, which throws `BAD_REQUEST` on a cursor that doesn't parse into a valid timestamp and id

#### Scenario: Malformed cursor is rejected

- **WHEN** a caller supplies a `cursor` value that isn't a valid `"<ISO timestamp>|<id>"` pair
- **THEN** the procedure SHALL throw `BAD_REQUEST` before querying the database

#### Scenario: Non-keyset pagination still shares the slicing helper

- **WHEN** a procedure paginates over a data source that isn't queried by keyset (for example a Loki log query bounded by a single timestamp), so the shared encode/decode pair doesn't apply
- **THEN** it SHALL still use the shared `paginate()` slicing helper for the over-fetch/`hasMore` step, and MAY manage its own cursor value

### Requirement: RPC handler mounting

The system SHALL serve all procedures through an RPC handler mounted under `/rpc`, dispatching each procedure by its nested path, which includes the version segment contributed by the top-level router.

#### Scenario: Procedure is reachable by versioned path

- **WHEN** a request is sent to `/rpc/<version>/<feature>/<method>`
- **THEN** the corresponding procedure SHALL be invoked

#### Scenario: Unversioned path is not reachable

- **WHEN** a request is sent to `/rpc/<feature>/<method>` without a version segment
- **THEN** the system SHALL NOT match any procedure

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
