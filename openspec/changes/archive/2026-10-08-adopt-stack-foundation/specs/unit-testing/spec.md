## ADDED Requirements

### Requirement: One root command runs every unit suite

The repo SHALL run every workspace's unit-test suite from the root with `bun run test` (`turbo test`). That command SHALL cover at least `packages/api`, whose suite runs with `bun test`, and SHALL exit non-zero when any test in any suite fails.

#### Scenario: All suites run from the root

- **WHEN** `bun run test` is executed from the repo root
- **THEN** the unit suite of `packages/api` SHALL run, together with any other workspace that declares a `test` script

#### Scenario: A failing test fails the command

- **WHEN** any test in any of those suites fails
- **THEN** `bun run test` SHALL exit with a non-zero status

#### Scenario: Running one workspace's suite

- **WHEN** `turbo run test --filter=@nonete/api` is executed
- **THEN** only that workspace's unit suite SHALL run

### Requirement: Unit tests are hermetic

Unit tests SHALL NOT open a database connection, make a network call, or depend on a running service (backend, frontend, gateway, Postgres or Loki). A unit suite SHALL pass on a machine where none of those is running and no `.env` file is present. The `packages/api` suite SHALL preload a setup file that overwrites the required server variables with placeholders (a `DATABASE_URL` pointing at a loopback port that refuses connections) and clears the optional variables that switch on integrations (`LOKI_URL`, `ADMIN_*`, `OIDC_*`, `SKIP_ENV_VALIDATION`).

#### Scenario: Suites pass with nothing running

- **WHEN** `bun run test` runs on a machine with no database, no dev stack and no `.env` files
- **THEN** every unit suite SHALL pass

#### Scenario: A real DATABASE_URL in the shell is never used

- **WHEN** `bun run test` runs with a `DATABASE_URL` that points at a live database exported in the shell
- **THEN** no `packages/api` test SHALL connect to that database

### Requirement: Unit tests live outside production source

Each workspace's unit tests SHALL live in a `tests/` directory at the workspace root, outside the `src/` directory that ships as runtime source. Test files SHALL be type-checked by the workspace's `check-types` and linted by Biome.

#### Scenario: TypeScript test file placement

- **WHEN** a unit test is added for `packages/api/src/shared/pagination.ts`
- **THEN** it SHALL live under `packages/api/tests/` (e.g. `packages/api/tests/shared/pagination.test.ts`)
- **AND** `bun run --filter @nonete/api check-types` SHALL type-check it

### Requirement: API access builders are covered

The `packages/api` unit suite SHALL verify, for each procedure builder, both who it lets through and who it rejects, and the `access` meta it stamps:

- `publicProcedure`: an anonymous caller is allowed.
- `protectedProcedure`: no user → `UNAUTHORIZED`; a signed-in user is allowed.
- `adminProcedure`: no user → `UNAUTHORIZED`; a non-admin → `FORBIDDEN`; an admin is allowed.
- `permissionProcedure`: no user or session → `UNAUTHORIZED`; a non-admin without an active organization → `FORBIDDEN`; a non-admin whose organization check denies → `FORBIDDEN`; a non-admin whose check allows → allowed; an admin is allowed without the organization check being consulted.
- `cronProcedure`: a context without the scheduler marker → `FORBIDDEN`, even for an admin; a scheduler-marked context is allowed.

#### Scenario: Protected procedure rejects an anonymous caller

- **WHEN** a procedure built with `protectedProcedure` is called with a context that has no user
- **THEN** the call SHALL fail with the `UNAUTHORIZED` error code

#### Scenario: Admin bypasses the organization permission check

- **WHEN** a procedure built with `permissionProcedure(resource, action)` is called by a user whose role is `admin`
- **THEN** the call SHALL succeed
- **AND** the organization permission check SHALL NOT be consulted

#### Scenario: Cron-only procedure rejects an HTTP-built context

- **WHEN** a procedure built with `cronProcedure` is called with an admin user but no scheduler marker on the context
- **THEN** the call SHALL fail with the `FORBIDDEN` error code

#### Scenario: Builders stamp their access meta

- **WHEN** the suite reads the meta of a procedure built with each builder
- **THEN** the `access` value SHALL match the builder (`public`, `protected`, `admin`, `cron`; `permissionProcedure` as currently declared)

### Requirement: API shared helpers are covered

The `packages/api` unit suite SHALL cover the pure helpers in `src/shared/`:

- page slicing and `hasMore` from an over-fetched list, with and without a total;
- keyset cursor round-trip, plus rejection of a malformed cursor with `BAD_REQUEST`;
- escaping of ILIKE wildcards in a search term;
- `NOT_FOUND` for a missing row, with and without a custom message;
- ISO date formatting, including `null`/`undefined`;
- the defaults and bounds of the pagination and search input fields.

#### Scenario: Malformed cursor is rejected

- **WHEN** a keyset cursor without the separator or with an invalid timestamp is decoded
- **THEN** decoding SHALL fail with the `BAD_REQUEST` error code

#### Scenario: Search wildcards are escaped

- **WHEN** a search term containing `%`, `_` or `\` is turned into a contains-pattern
- **THEN** each of those characters SHALL be escaped and the result wrapped in `%…%`
