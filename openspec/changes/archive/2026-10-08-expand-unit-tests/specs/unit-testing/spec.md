## MODIFIED Requirements

### Requirement: One root command runs every unit suite

The repo SHALL run every workspace's unit-test suite from the root with `bun run test` (`turbo test`). That command SHALL cover at least `packages/api`, `packages/cron` and `apps/frontend`, each of whose suites runs with `bun test`, and SHALL exit non-zero when any test in any suite fails.

#### Scenario: All suites run from the root

- **WHEN** `bun run test` is executed from the repo root
- **THEN** the unit suites of `packages/api`, `packages/cron` and `apps/frontend` SHALL run, together with any other workspace that declares a `test` script

#### Scenario: A failing test fails the command

- **WHEN** any test in any of those suites fails
- **THEN** `bun run test` SHALL exit with a non-zero status

#### Scenario: Running one workspace's suite

- **WHEN** `turbo run test --filter=@nonete/cron` (or `--filter=@nonete/api`, `--filter=frontend`) is executed
- **THEN** only that workspace's unit suite SHALL run

### Requirement: Unit tests are hermetic

Unit tests SHALL NOT open a database connection, make a network call, or depend on a running service (backend, frontend, gateway, Postgres or Loki). A unit suite SHALL pass on a machine where none of those is running and no `.env` file is present. The `packages/api` suite SHALL preload a setup file that overwrites the required server variables with placeholders (a `DATABASE_URL` pointing at a loopback port that refuses connections) and clears the optional variables that switch on integrations (`LOKI_URL`, `ADMIN_*`, `OIDC_*`, `SKIP_ENV_VALIDATION`). Code that queries the database SHALL be tested against the fake database fixture, never a real or in-process database. Code that calls `fetch` SHALL be tested with `fetch` replaced for the duration of the test. Results that depend on the timezone or the current time SHALL be computed under a fixed timezone and a fixed system clock.

#### Scenario: Suites pass with nothing running

- **WHEN** `bun run test` runs on a machine with no database, no dev stack and no `.env` files
- **THEN** every unit suite SHALL pass

#### Scenario: A real DATABASE_URL in the shell is never used

- **WHEN** `bun run test` runs with a `DATABASE_URL` that points at a live database exported in the shell
- **THEN** no `packages/api` or `packages/cron` test SHALL connect to that database

#### Scenario: Results do not depend on the machine's timezone

- **WHEN** the frontend suite runs on machines whose local timezone differs
- **THEN** every date-formatting assertion SHALL produce the same result

### Requirement: Unit tests live outside production source

Each workspace's unit tests SHALL live in a `tests/` directory at the workspace root, outside the `src/` directory that ships as runtime source. Test files SHALL be type-checked by the workspace's `check-types` and linted by Biome.

#### Scenario: TypeScript test file placement

- **WHEN** a unit test is added for `packages/api/src/shared/pagination.ts`
- **THEN** it SHALL live under `packages/api/tests/` (e.g. `packages/api/tests/shared/pagination.test.ts`)
- **AND** `bun run --filter @nonete/api check-types` SHALL type-check it

#### Scenario: Frontend test file placement

- **WHEN** a unit test is added for `apps/frontend/src/lib/format.ts`
- **THEN** it SHALL live under `apps/frontend/tests/` (e.g. `apps/frontend/tests/lib/format.test.ts`)
- **AND** `bun run --filter frontend check-types` SHALL type-check it

## ADDED Requirements

### Requirement: A fake database fixture stands in for Drizzle

The test fixtures SHALL provide a fake database that accepts the Drizzle call chains the tested code uses (`query.<table>.findFirst`/`findMany`, `select…from…where…groupBy`, `insert…values…onConflictDoUpdate…returning`, `update…set…where…returning`, `delete…where`), resolves each awaited chain with a result the test queued for that operation, and records every call with its arguments so a test can assert what was written. It SHALL fail the test when a chain is awaited with no queued result, and SHALL be resettable between tests. It SHALL NOT open a connection or execute SQL.

#### Scenario: A queued result is returned

- **WHEN** a test queues a row for `query.comments.findFirst` and the code under test awaits that call
- **THEN** the call SHALL resolve with the queued row

#### Scenario: Writes are observable

- **WHEN** the code under test awaits `update(table).set(values).where(condition)`
- **THEN** the test SHALL be able to read the `set` values from the fake's recorded calls

#### Scenario: An unexpected query fails loudly

- **WHEN** the code under test awaits a chain for which the test queued no result
- **THEN** the call SHALL reject with an error naming the operation

### Requirement: API feature handlers are covered

The `packages/api` unit suite SHALL cover the rules each feature handler enforces beyond the procedure builders, calling handlers or procedures with the fake database and with `@nonete/auth`, `#v1/cron/runtime` and `fetch` mocked at their boundaries:

- `comment`: the list is nested by `parentId` and drops a soft-deleted root with no replies while keeping one with replies, with its content blanked; `counts` returns `0` for entities with no rows; `create` rejects a missing or deleted parent with `NOT_FOUND` and a parent on another entity with `BAD_REQUEST`; `update` and `delete` reject a non-author with `FORBIDDEN`; deleting an already deleted comment succeeds without writing.
- `entity-icon`: an entity type with no registered target fails with `BAD_REQUEST`; `set`/`clear` on an entity the target does not report as writable fail with `NOT_FOUND`; `getMany` returns only icons of readable entities and makes no query when none is readable; `deleteEntityIcons` with no ids makes no query.
- `organization`: assigning a role that is neither built-in nor a custom role of that organization fails with `BAD_REQUEST`; adding a user who is already a member fails with `CONFLICT`; a missing organization, member or team fails with `NOT_FOUND`.
- `session-history`: the page holds at most `limit` sessions, `nextCursor` is set only when more rows exist and decodes to the last row, and sessions without a user are skipped.
- `api-key`: the dates Better Auth returns are serialized as ISO strings or `null`.
- `logs`: the LogQL query includes each provided filter with quotes and regex characters escaped; a network failure or a non-OK Loki response fails with `BAD_GATEWAY`; unparsable lines are skipped and pino numeric levels map to their labels.
- `cron`: `CronNotFoundError`, `CronReadOnlyError` and `CronValidationError` from the service map to `NOT_FOUND`, `CONFLICT` and `BAD_REQUEST`; `create` binds the job to the caller when `userId` is omitted and to no user when it is `null`; `listRuns` pages with a keyset cursor.

#### Scenario: Soft-deleted comment with replies stays in the tree

- **WHEN** `comment.list` loads a soft-deleted root comment that has a visible reply
- **THEN** the root SHALL be returned with empty `content` and the reply nested under it

#### Scenario: Only the author edits a comment

- **WHEN** `comment.update` is called by a user who is not the comment's author
- **THEN** the call SHALL fail with `FORBIDDEN` and no update SHALL be recorded

#### Scenario: Unknown role is rejected

- **WHEN** `organization.addMember` is called with a role that is not built-in and not a custom role of the organization
- **THEN** the call SHALL fail with `BAD_REQUEST` and no insert SHALL be recorded

#### Scenario: Loki is unreachable

- **WHEN** `logs.query` runs and `fetch` rejects
- **THEN** the call SHALL fail with `BAD_GATEWAY`

#### Scenario: Read-only cron job

- **WHEN** the cron service throws `CronReadOnlyError` for `cron.update`
- **THEN** the handler SHALL fail with `CONFLICT`

### Requirement: The cron package is covered

`packages/cron` SHALL have its own `bun test` suite that injects the fake database and a silent logger, and replaces `Bun.cron` scheduling with a spy so no timer fires. It SHALL cover:

- `assertValidCronExpression`: a valid expression passes, an invalid one and a non-UTC timezone throw `CronValidationError`; `nextRunAt` returns the next fire after a given date.
- `isUniqueViolation`: true for code `23505` on the error or on its `cause`, false otherwise.
- `syncDeclaredJobs`: inserts a declared job that does not exist, updates one whose expression, name, description or run-as user changed or that is disabled, leaves an identical one untouched, soft-deletes a persisted `code` job no longer declared, disables an existing job whose declared expression is invalid, and continues past a unique-name violation.
- `createCronService`: `create`/`update` reject an invalid expression, a non-UTC timezone and an unknown handler key before writing; a duplicate name becomes `CronValidationError`; a missing job is `CronNotFoundError`; every mutation of a `code` job is `CronReadOnlyError`; successful mutations call `onChange`.
- `createScheduler`: `start` schedules each enabled job once and is idempotent; `refresh` reschedules a job whose signature changed and unschedules a disabled one; `stop` stops every scheduled job; `runNow` fails with `CronNotFoundError` for a missing job and `CronValidationError` while a run is already in progress, records a `running` run, then finishes it as `success` or `failed` depending on the resolver, notifying `onRunChange` without letting a listener failure affect the run.
- `recoverOrphanedRuns`: marks `running` rows as `failed`.

#### Scenario: Non-UTC timezone is rejected

- **WHEN** `assertValidCronExpression("0 * * * *", "Europe/Madrid")` is called
- **THEN** it SHALL throw `CronValidationError`

#### Scenario: Code job removed from code is soft-deleted

- **WHEN** `syncDeclaredJobs` runs with a persisted active `code` job whose key is not declared
- **THEN** that job SHALL be updated with `deletedAt` set, `enabled` false and `nextRunAt` null

#### Scenario: Code jobs are read-only through the service

- **WHEN** `update`, `setEnabled` or `remove` is called on a job whose `source` is `code`
- **THEN** the call SHALL throw `CronReadOnlyError` and record no write

#### Scenario: A failing resolver marks the run failed

- **WHEN** `runNow` executes a job whose resolver rejects
- **THEN** the run SHALL be finished with status `failed` and the error message recorded

### Requirement: Frontend helpers are covered

The `apps/frontend` unit suite SHALL cover the pure helpers in `src/lib` that do not need a running app: date and duration formatting (`format.ts`, with a fixed clock for relative labels), text folding and suggestions (`fold-text.ts`), deterministic ids (`deterministic-id.ts`), user display names (`user-display.ts`), surface and navigation lookups (`app-surfaces.ts`, `site-nav.ts`: path matching, admin-only filtering, current-item detection), recent surfaces (`recent-surfaces.ts`, bounded by `RECENT_SURFACES_LIMIT` and deduplicated), icon references (`icon-registry.ts`) and theme resolution (`theme.ts`).

#### Scenario: Accent-insensitive folding

- **WHEN** `foldText` is given text with accents and mixed case
- **THEN** it SHALL return the lower-case text without diacritics

#### Scenario: Deterministic ids are stable

- **WHEN** `deterministicUuid` is called twice with the same seed
- **THEN** it SHALL return the same UUID both times, and a different one for a different seed

#### Scenario: Admin-only surfaces are hidden from users

- **WHEN** the navigable surfaces are requested for a non-admin
- **THEN** no admin-only surface SHALL be included

### Requirement: Frontend hooks are covered

The `apps/frontend` unit suite SHALL render hooks from `src/hooks` that depend only on React and the browser (debounced value, dialog form and target dialogs, `useOnOpen`, query-param state, copy to clipboard, hydration flag) in a DOM provided by `happy-dom`, using `@testing-library/react`, and SHALL assert their state transitions. Timers SHALL be controlled by the test, not waited for in real time.

#### Scenario: Debounced value trails its input

- **WHEN** the value passed to `useDebouncedValue` changes twice within the delay
- **THEN** the hook SHALL return the previous value until the delay elapses after the last change, and then the last value

#### Scenario: Query param round-trip

- **WHEN** a hook using `useQueryParam` sets a value
- **THEN** the URL's query string SHALL hold the serialized value and a fresh render SHALL parse it back
- **AND** setting the value back to the default SHALL remove the param from the URL

### Requirement: Frontend shared components are covered

The `apps/frontend` unit suite SHALL render a set of shared components with logic of their own (`IpInput`, `CidrInput`, `NumberStepper`, `SegmentedPicker`, `FilterChips`, `QueryState`) with `@testing-library/react`, and SHALL assert what the user sees and what the component reports through its callbacks, querying by role and accessible name.

#### Scenario: Number stepper wraps at its bounds

- **WHEN** `ArrowUp` is pressed on a `NumberStepper` whose value is its maximum
- **THEN** the value reported through `onChange` SHALL be its minimum

#### Scenario: Query state shows the error branch

- **WHEN** `QueryState` receives a query in the error state
- **THEN** it SHALL render the error state instead of its children
