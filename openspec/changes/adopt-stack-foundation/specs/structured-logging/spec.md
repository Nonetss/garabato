## ADDED Requirements

### Requirement: Shared structured logger

The backend and the `@nonete/api` package SHALL emit operational logs through a single shared, configured logger instance (`logger` from `@nonete/logger`, built on pino) rather than `console.*`. Log entries SHALL be structured (machine-parseable JSON in production) and carry a severity level.

#### Scenario: Application log is structured

- **WHEN** backend or API code emits an operational log
- **THEN** the entry is produced by the shared logger with a level and structured fields, not via `console.log`/`console.error`

#### Scenario: Contextual fields instead of string prefixes

- **WHEN** a log describes an event about a specific entity (e.g. a job run, a migration step)
- **THEN** the relevant identifiers are attached as structured fields rather than interpolated into an ad-hoc `[prefix]` message string

### Requirement: Log level from environment

The logger's minimum severity level SHALL be controlled by the `LOG_LEVEL` environment variable, defaulting to `info` when unset.

#### Scenario: Default level

- **WHEN** `LOG_LEVEL` is not set
- **THEN** the logger emits `info` and above and suppresses `debug`

#### Scenario: Overriding the level

- **WHEN** `LOG_LEVEL` is set to `debug`
- **THEN** `debug` entries are emitted

### Requirement: Environment-appropriate output format

The logger SHALL emit JSON in production and MAY emit human-readable pretty output (pino-pretty) in development, selected by `NODE_ENV` without code changes.

#### Scenario: Production format

- **WHEN** the service runs with `NODE_ENV=production`
- **THEN** log lines are emitted as single-line JSON suitable for a log aggregator

#### Scenario: Development format

- **WHEN** the service runs in development with pretty output enabled
- **THEN** log lines are human-readable while carrying the same level and fields

### Requirement: Errors logged with cause

Error-level logs SHALL include the underlying error (message and stack) as a structured field.

#### Scenario: Logging a caught error

- **WHEN** code catches an error and logs it (e.g. a failed scheduled run or bootstrap failure)
- **THEN** the log entry is at `error` level and carries the error's message and stack as structured fields

### Requirement: API error severity

Errors raised while serving an oRPC procedure over `/rpc`, `/api` or the documentation routes SHALL be logged once, at a level that reflects their cause: `warn` for a deliberate rejection (an `ORPCError` whose HTTP status is below 500), `error` for an `ORPCError` with a status of 500 or above and for any other exception, and `info` for an aborted request. This SHALL apply equally to errors raised while an event stream is already open. The entry SHALL carry the error as a structured field and the procedure path.

#### Scenario: Deliberate rejection

- **WHEN** a procedure throws `errors.NOT_FOUND({ message: "Colección no encontrada" })`
- **THEN** one log entry SHALL be emitted at `warn` with the error and the procedure path, and none at `error`

#### Scenario: Upstream failure

- **WHEN** a procedure throws `errors.SERVICE_UNAVAILABLE()` because a dependency it needs is down
- **THEN** the entry SHALL be emitted at `error`

#### Scenario: Unexpected exception

- **WHEN** a procedure throws an `Error` that is not an `ORPCError`
- **THEN** the entry SHALL be emitted at `error` with the error's message and stack

#### Scenario: Failure inside an open stream

- **WHEN** a streamed procedure throws after it has already sent events
- **THEN** the error SHALL be logged at the level its cause maps to

### Requirement: Request correlation

Every HTTP request SHALL receive a server-generated request id, and every log entry produced while handling it, by the request-logging middleware and by oRPC procedure handling, SHALL carry that id as a structured field (never as a log label). Procedures SHALL be able to obtain the request's logger from their context. An inbound `x-request-id` header SHALL NOT be used as the id.

#### Scenario: Request and error lines share an id

- **WHEN** a request to `/rpc/v1/collection/get` fails with a deliberate rejection
- **THEN** the "request completed" entry and the procedure error entry SHALL carry the same request id

#### Scenario: Client-supplied id is ignored

- **WHEN** a request arrives with an `x-request-id: abc` header
- **THEN** its log entries SHALL carry a server-generated id, not `abc`

#### Scenario: Procedure logs through the request logger

- **WHEN** a procedure handling an HTTP request logs through the logger obtained from its context
- **THEN** the entry SHALL carry that request's id

### Requirement: Shared logger factory with optional Loki shipping

`@nonete/logger/factory` SHALL export an env-agnostic `createLogger({ service, level, production, lokiUrl })` used by both the backend (service `better-backend`) and the frontend's server (service `better-frontend`). When `lokiUrl` is given (from `LOKI_URL`), the logger SHALL additionally push its lines to Loki's HTTP push API in batches, with `service` as the only stream label. The logger SHALL use plain synchronous streams (`pino.multistream`), never `pino.transport()`, so it keeps working when bundled into an image without `node_modules`. A failed Loki push SHALL be swallowed and SHALL NOT affect console output or the application.

#### Scenario: No Loki configured

- **WHEN** the backend starts without `LOKI_URL`
- **THEN** logs SHALL go to stdout only and nothing SHALL attempt to contact Loki

#### Scenario: Loki configured

- **WHEN** the backend runs with `LOKI_URL=http://loki:3100`
- **THEN** its log lines SHALL be pushed to `http://loki:3100/loki/api/v1/push` under the label `service="better-backend"`, while still being written to stdout

#### Scenario: Loki unreachable

- **WHEN** a push to Loki fails
- **THEN** the failure SHALL NOT be thrown or logged, and the request being served SHALL be unaffected

#### Scenario: Bundled runtime

- **WHEN** the backend or frontend runs from its bundled production image with no `node_modules`
- **THEN** the logger, including Loki shipping, SHALL work without resolving any module at runtime
