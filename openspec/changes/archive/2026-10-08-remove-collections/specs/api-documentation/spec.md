## MODIFIED Requirements

### Requirement: Documented operation metadata

Each oRPC procedure SHALL declare a non-empty `summary`, a non-empty `description`, at least one `tag` that groups it by area (for example `System`, `API Keys`, `User`, `Plugins`, `Organizations`, `Teams`, `Roles`), the HTTP `method` that matches what the handler does, and the `successStatus` that matches what a successful call produces. The method SHALL follow these rules:

- `GET` for every procedure without side effects (reads, lists, searches, counts) whose input fits a query string: scalars, optional filters and arrays of scalars.
- `QUERY` for procedures without side effects whose input does not fit a query string: arrays of objects, such as batch lookups keyed by entity refs (`comment.counts`, `entityIcon.getMany`). A read SHALL NOT be declared `POST` to carry a large input.
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

#### Scenario: Code-declared cron modified as a manual one

- **WHEN** an administrator calls `v1.cron.update` or `v1.cron.remove` on a cron job declared in code
- **THEN** the system SHALL throw a `CONFLICT` error with a Spanish message and SHALL change nothing

#### Scenario: Caller lacks ownership

- **WHEN** an authenticated user edits a comment written by someone else
- **THEN** the system SHALL throw a `FORBIDDEN` error

#### Scenario: Valid input rejected with a client-error code that blames the input

- **WHEN** a handler throws `BAD_REQUEST` for an input that passed validation and is only refused because of the target's state or kind
- **THEN** the system SHALL be considered non-compliant with this requirement

