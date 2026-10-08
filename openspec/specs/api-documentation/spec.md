# API Documentation

## Purpose

Serves an interactive Scalar reference and a generated OpenAPI document for the oRPC router, with OpenAPI-style REST access under `/api`, documented operation metadata, accurate error codes and authentication schemes.

## Requirements

### Requirement: Interactive documentation UI

The system SHALL serve an interactive API reference using Scalar at `/scalar` and the generated OpenAPI document, titled `Better API`, at `/openapi.json`. Access to both endpoints SHALL be restricted to authenticated users holding the `admin` role. Unauthenticated requests SHALL receive `401 Unauthorized`; authenticated non-admin requests SHALL receive `403 Forbidden`. The reference UI and the OpenAPI document SHALL NOT be reachable at any other path, in particular not under the REST prefix `/api`.

#### Scenario: Admin reaches documentation UI

- **WHEN** an authenticated user with the `admin` role requests `/scalar`
- **THEN** the system SHALL return the Scalar API reference UI

#### Scenario: Admin reaches OpenAPI document

- **WHEN** an authenticated user with the `admin` role requests `/openapi.json`
- **THEN** the system SHALL return the generated OpenAPI specification with `info.title` set to `Better API`

#### Scenario: Unauthenticated client is rejected

- **WHEN** an unauthenticated client requests `/scalar` or `/openapi.json`
- **THEN** the system SHALL respond with `401 Unauthorized`

#### Scenario: Non-admin client is rejected

- **WHEN** an authenticated user without the `admin` role requests `/scalar` or `/openapi.json`
- **THEN** the system SHALL respond with `403 Forbidden`

#### Scenario: Documentation is not exposed under the REST prefix

- **WHEN** any client, authenticated or not, requests `/api/scalar` or `/api/openapi.json`
- **THEN** the system SHALL NOT return the Scalar UI or the OpenAPI document, and SHALL respond with `404 Not Found`

### Requirement: OpenAPI-style REST access

The system SHALL serve the router's procedures over an OpenAPI-style HTTP handler mounted under `/api`, using each procedure's declared HTTP method and success status, so documented example requests are directly executable. Query-string and path parameters SHALL be coerced to the type the procedure's input schema declares (number, boolean, array, date…) before input validation, so a value that is valid once typed is not rejected just because HTTP carries it as text. Procedures declared with `QUERY` SHALL take their input from the JSON request body, like `POST`, and the generated OpenAPI 3.2 document SHALL list them as `query` operations with a request body.

#### Scenario: Procedure reachable via REST

- **WHEN** a client sends a request matching a procedure's method and path under `/api`
- **THEN** the corresponding procedure SHALL be invoked with the request context

#### Scenario: Numeric query parameter on a GET procedure

- **WHEN** an authorized client calls `GET /api/v1/logs/query?limit=20`
- **THEN** the procedure SHALL receive `limit` as the number `20` and SHALL NOT respond `400 Bad Request` because of its type

#### Scenario: Value that cannot be coerced

- **WHEN** a client sends a query parameter that cannot be converted to the declared type (for example `limit=abc`)
- **THEN** the system SHALL respond with `400 Bad Request` from input validation

#### Scenario: Batch read over QUERY

- **WHEN** an authorized client sends `QUERY /api/v1/comment/counts` with a JSON body `{ "entities": [...] }` holding 100 entity refs
- **THEN** the procedure SHALL receive the 100 refs and respond `200` with their counts

#### Scenario: Batch read over GET

- **WHEN** a client sends `GET /api/v1/comment/counts` with the entities in the query string
- **THEN** the system SHALL NOT invoke the procedure

### Requirement: Documentation reflects the REST server prefix

The generated specification SHALL declare the API server base path as `/api` so example requests and curl snippets target the OpenAPI-style endpoints.

#### Scenario: Examples target the correct path

- **WHEN** the documentation renders a request example for a procedure
- **THEN** the example URL SHALL include the `/api` prefix

### Requirement: Documented operation metadata

Each oRPC procedure SHALL declare a non-empty `summary`, a non-empty `description`, at least one `tag` that groups it by area (for example `System`, `API Keys`, `User`, `Plugins`, `Organizations`, `Teams`, `Roles`), the HTTP `method` that matches what the handler does, and the `successStatus` that matches what a successful call produces. The method SHALL follow these rules:

- `GET` for every procedure without side effects (reads, lists, searches, counts) whose input fits a query string: scalars, optional filters and arrays of scalars.
- `QUERY` for procedures without side effects whose input does not fit a query string: arrays of objects, such as batch lookups keyed by entity refs (`comment.counts`, `entityIcon.getMany`, `collection.favoriteStatuses`). A read SHALL NOT be declared `POST` to carry a large input.
- `POST` for creating a new resource whose identity the server assigns, and for actions that are neither CRUD nor idempotent (such as running a job).
- `PUT` for idempotent writes that set the whole state of a target the caller identifies: full replacement of a resource or sub-resource, and "ensure it exists" upserts keyed by a natural key. Repeating the call SHALL leave the same state.
- `PATCH` for partial updates: the procedure SHALL change only the fields it declares, leave every other field of the resource untouched, and keep the current value of any optional field the caller omits. A `PATCH` MAY require the fields it exists to change (a comment's `content`, a member's `role`).
- `DELETE` for removals, soft deletes included.

`successStatus` SHALL be `201` on every procedure whose purpose is to create a new resource and that creates one on every successful call, and SHALL be left at the default `200` otherwise: idempotent upserts that may return an existing row, and actions that record their execution as a side effect (`cron.runNow` storing a run). Procedures SHALL NOT declare `204`, because every procedure declares an `.output()` and returns a body. The `description` MUST describe what the call does in plain language and call out any non-obvious caller requirement (role, scope, side-effect) that is not visible on the procedure builder itself. Scalar at `/scalar` and the generated OpenAPI document at `/openapi.json` SHALL surface this metadata verbatim.

#### Scenario: Procedure appears under its tag

- **WHEN** the documentation is generated
- **THEN** each procedure SHALL appear with its summary and description under its configured tag

#### Scenario: Procedure without a description

- **WHEN** any procedure is added to the router without a non-empty `description` field
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: Creation procedure without a 201 success status

- **WHEN** any procedure whose purpose is to create a new resource, and that creates one on every successful call, is declared without `successStatus: 201`
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: Idempotent upsert declared as a creation

- **WHEN** a procedure that returns the existing row when the target already exists is declared with `method: "POST"` or `successStatus: 201`
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: Mutation procedure with the wrong HTTP method

- **WHEN** a procedure that removes a resource or partially updates one is declared with `method: "POST"` instead of `DELETE` or `PATCH`
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: PATCH procedure that clears omitted fields

- **WHEN** a procedure declared with `method: "PATCH"` clears or resets a stored value because the caller omitted it
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: Read procedure with side effects

- **WHEN** a procedure declared with `method: "GET"` or `method: "QUERY"` writes to the database or triggers an external side effect
- **THEN** the system SHALL be considered non-compliant with this requirement

#### Scenario: Batch read declared as GET

- **WHEN** a procedure without side effects takes an array of objects in its input and is declared with `method: "GET"` or `method: "POST"`
- **THEN** the system SHALL be considered non-compliant with this requirement

### Requirement: Error codes reflect the failure cause

Handlers SHALL throw the `errors.<CODE>()` whose HTTP status names the actual cause of the failure:

- `BAD_REQUEST` (400) when the input itself is invalid or inconsistent (malformed cursor, unknown role name, a reply whose parent belongs to another entity).
- `UNAUTHORIZED` (401) when there is no authenticated caller.
- `FORBIDDEN` (403) when the caller is authenticated but lacks the role, permission or ownership the operation needs, so another caller could do it.
- `NOT_FOUND` (404) when the target does not exist or is not visible to the caller.
- `CONFLICT` (409) when the input is valid and the caller is allowed in general, but the target's current state or kind rules the operation out for every caller (duplicates of a unique value, built-in or code-declared resources that are read-only).
- `INTERNAL_SERVER_ERROR` (500) for invariants the server broke, and `BAD_GATEWAY` (502) / `SERVICE_UNAVAILABLE` (503) when a downstream dependency failed or is not configured.

#### Scenario: Duplicate unique value

- **WHEN** a caller creates an organization with a slug that is already taken
- **THEN** the system SHALL throw a `CONFLICT` error

#### Scenario: Built-in collection modified as a custom one

- **WHEN** an authenticated user calls `v1.collection.update` or `v1.collection.delete` on their built-in favorites collection
- **THEN** the system SHALL throw a `CONFLICT` error with a Spanish message and SHALL change nothing

#### Scenario: Caller lacks ownership

- **WHEN** an authenticated user edits a comment written by someone else
- **THEN** the system SHALL throw a `FORBIDDEN` error

#### Scenario: Valid input rejected with a client-error code that blames the input

- **WHEN** a handler throws `BAD_REQUEST` for an input that passed validation and is only refused because of the target's state or kind
- **THEN** the system SHALL be considered non-compliant with this requirement

### Requirement: Authentication schemes in documentation

The specification SHALL declare security schemes for an API key passed in the `x-api-key` header and for a Bearer session token, so test requests can be authenticated from the UI.

#### Scenario: User authenticates a test request

- **WHEN** a user opens the authentication panel in the documentation UI
- **THEN** the UI SHALL offer an `x-api-key` field and a Bearer token field
