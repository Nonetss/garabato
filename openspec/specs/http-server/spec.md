# HTTP Server

## Purpose

Defines the backend Hono application served by Bun: its composition, hot reload, CORS, global middleware, shared database pool, graceful bounded shutdown, request body limits, prototype pollution protection and event stream keep-alive.

## Requirements

### Requirement: Application composition

The backend (`apps/backend`) SHALL compose a single Hono application served by Bun that mounts the authentication router, the RPC router, and the documentation router, and SHALL respond to `GET /` with a health string. On startup it SHALL seed the admin user and start the cron scheduler.

#### Scenario: Root health endpoint

- **WHEN** a client requests `GET /`
- **THEN** the system SHALL return `"OK"`

#### Scenario: Startup failure

- **WHEN** the startup bootstrap (admin seed or cron start) throws
- **THEN** the backend SHALL log the error and exit with a non-zero status

### Requirement: Hot reload safety

Under `bun --hot`, re-executing the entry module SHALL reload the running HTTP server in place without binding the port again, and SHALL NOT re-run the startup bootstrap or register additional signal handlers.

#### Scenario: Source change in dev

- **WHEN** a file the backend imports changes while it runs under `bun --hot`
- **THEN** the server SHALL serve the new code on the same port, and the admin seed, the cron scheduler start and the `SIGINT`/`SIGTERM` handlers SHALL NOT run again

### Requirement: Cross-origin resource sharing

The system SHALL apply CORS using the configured origin (`CORS_ORIGIN`), allow credentials, permit the `GET`, `POST`, `OPTIONS`, `DELETE`, `PUT`, `PATCH` and `QUERY` methods, and allow the `Content-Type`, `Authorization`, and `x-api-key` request headers.

#### Scenario: Preflight from the configured origin

- **WHEN** a browser sends a CORS preflight from the configured origin
- **THEN** the system SHALL respond allowing credentials and the configured methods and headers

#### Scenario: Preflight for a QUERY request

- **WHEN** a browser sends a CORS preflight from the configured origin with `Access-Control-Request-Method: QUERY`
- **THEN** the system SHALL list `QUERY` in `Access-Control-Allow-Methods`

#### Scenario: API key header is permitted

- **WHEN** a cross-origin request includes an `x-api-key` header
- **THEN** CORS SHALL allow the header

### Requirement: Global request logging and session resolution

The system SHALL apply request logging and session resolution middleware to all routes before dispatching to any router. Request logging SHALL be emitted through the shared structured logger (not Hono's default logger), producing a leveled, structured entry per request that shares format and level configuration with application logs. The "request completed" entry SHALL carry the status, latency and, when signed in, the user, at `error` for a 5xx status, `warn` for a 4xx status and `info` otherwise.

#### Scenario: Every request resolves a session

- **WHEN** any request reaches the application
- **THEN** the session resolution middleware SHALL run before the route handler so `user` and `session` are available

#### Scenario: Every request is logged structurally

- **WHEN** any request reaches the application
- **THEN** a structured request-log entry SHALL be emitted through the shared logger with a severity level, in the same format (JSON in production) as application logs

#### Scenario: Failed request level

- **WHEN** a request completes with status `404`
- **THEN** its "request completed" entry SHALL be logged at `warn`

### Requirement: Single database connection pool

The backend process SHALL serve all application database access — API handlers, authentication, the cron scheduler and startup admin seeding — from one shared connection pool. Startup database migrations MAY use a separate dedicated connection, which SHALL be closed as soon as migrations finish. No startup step SHALL leave an additional connection pool open after it completes.

#### Scenario: Startup leaves only the shared pool open

- **WHEN** the backend has finished startup, including migrations and admin seeding
- **THEN** every database connection the process holds SHALL belong to the shared pool, and the migration connection SHALL be closed

#### Scenario: Authentication uses the shared pool

- **WHEN** a request resolves a session or a user signs in
- **THEN** the authentication queries SHALL run on the same connection pool as API handlers

### Requirement: Graceful shutdown

On `SIGINT` or `SIGTERM` the backend SHALL shut down in this order: end open server-pushed event subscriptions, stop accepting new HTTP connections and let in-flight HTTP requests complete, stop the cron scheduler, close the shared database pool, and exit. The database pool SHALL be closed only after HTTP and cron have stopped. The process SHALL exit with status `0` when every step succeeds. A step that fails SHALL be logged, SHALL NOT prevent the remaining steps from running, and SHALL make the process exit with a non-zero status.

#### Scenario: In-flight request completes during shutdown

- **WHEN** the backend receives `SIGTERM` while an HTTP request is being processed
- **THEN** new connections SHALL be refused, and the in-flight request SHALL receive its normal response before the database pool is closed

#### Scenario: Open event subscriptions end before the drain

- **WHEN** the backend receives `SIGTERM` while a client is subscribed to cron run events
- **THEN** that subscription's stream SHALL end normally before the HTTP drain starts, so it does not hold the drain until its timeout

#### Scenario: Clean shutdown

- **WHEN** the backend receives `SIGINT` or `SIGTERM` and every shutdown step succeeds
- **THEN** the process SHALL release all of its database connections and exit with status `0`

#### Scenario: A shutdown step fails

- **WHEN** one shutdown step throws (for example, stopping the cron scheduler fails)
- **THEN** the failure SHALL be logged, the database pool SHALL still be closed, and the process SHALL exit with a non-zero status

### Requirement: Bounded shutdown time

Shutdown SHALL NOT wait indefinitely. In-flight HTTP requests SHALL be given a bounded drain period; connections still open when it elapses SHALL be terminated, logged as a warning, and the shutdown SHALL continue with the remaining steps. The whole shutdown SHALL be bounded by an overall timeout shorter than 10 seconds, so the process exits on its own before a default container stop grace period forces a kill; if that timeout elapses, the backend SHALL log an error and exit with a non-zero status.

#### Scenario: Long-running stream during shutdown

- **WHEN** the backend receives `SIGTERM` while a streaming response is still open after the drain period
- **THEN** that connection SHALL be terminated, a warning SHALL be logged, and the cron and database steps SHALL still run before the process exits

#### Scenario: Shutdown exceeds the overall timeout

- **WHEN** the shutdown steps have not finished when the overall timeout elapses
- **THEN** the backend SHALL log an error and exit with a non-zero status

### Requirement: Repeated termination signals

A termination signal received while shutdown is already in progress SHALL NOT start a second shutdown sequence. Each resource SHALL be closed at most once per process.

#### Scenario: Second signal during shutdown

- **WHEN** the backend receives `SIGINT` and then `SIGTERM` (or the same signal again) before shutdown has finished
- **THEN** the shutdown already in progress SHALL continue unchanged, and no step SHALL run a second time

### Requirement: Request body size limit

The `/rpc` and `/api` handlers SHALL reject a request whose body exceeds 1 MiB with HTTP `413` and the standard API error body, before any procedure runs.

#### Scenario: Oversized body

- **WHEN** a client sends a 2 MiB body to `/rpc/v1/comment/create`
- **THEN** the response SHALL be `413` and the procedure SHALL NOT run

#### Scenario: Normal body

- **WHEN** a client sends a body under 1 MiB to a procedure
- **THEN** the request SHALL be handled normally

### Requirement: Prototype pollution protection

The `/rpc` and `/api` handlers SHALL reject, with HTTP `400`, a request whose decoded input contains a `__proto__` key or a `constructor` key holding a `prototype` key at any depth, before any procedure runs. A lone `constructor` or `prototype` key SHALL still be accepted.

#### Scenario: Polluting key in a record input

- **WHEN** a client creates a cron job whose payload contains `{"__proto__": {"isAdmin": true}}`
- **THEN** the response SHALL be `400` and the procedure SHALL NOT run

#### Scenario: Ordinary key named prototype

- **WHEN** an input contains a field named `prototype` that is not under a `constructor` key
- **THEN** the request SHALL be handled normally

### Requirement: Event stream keep-alive

Event streams served by the `/rpc` and `/api` handlers SHALL send a keep-alive comment at an interval shorter than the HTTP server's idle timeout, so a stream with no events stays open.

#### Scenario: Quiet subscription stays open

- **WHEN** a client holds a run-event subscription open for a minute during which no run changes
- **THEN** the connection SHALL stay open and SHALL still deliver the next event
