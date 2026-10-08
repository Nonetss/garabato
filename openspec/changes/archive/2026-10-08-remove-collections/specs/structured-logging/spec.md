## MODIFIED Requirements

### Requirement: API error severity

Errors raised while serving an oRPC procedure over `/rpc`, `/api` or the documentation routes SHALL be logged once, at a level that reflects their cause: `warn` for a deliberate rejection (an `ORPCError` whose HTTP status is below 500), `error` for an `ORPCError` with a status of 500 or above and for any other exception, and `info` for an aborted request. This SHALL apply equally to errors raised while an event stream is already open. The entry SHALL carry the error as a structured field and the procedure path.

#### Scenario: Deliberate rejection

- **WHEN** a procedure throws `errors.NOT_FOUND({ message: "Comentario no encontrado" })`
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

- **WHEN** a request to `/rpc/v1/cron/get` fails with a deliberate rejection
- **THEN** the "request completed" entry and the procedure error entry SHALL carry the same request id

#### Scenario: Client-supplied id is ignored

- **WHEN** a request arrives with an `x-request-id: abc` header
- **THEN** its log entries SHALL carry a server-generated id, not `abc`

#### Scenario: Procedure logs through the request logger

- **WHEN** a procedure handling an HTTP request logs through the logger obtained from its context
- **THEN** the entry SHALL carry that request's id
