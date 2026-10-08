# Testing and validation

## What an agent runs

1. `bun run --filter <workspace> check-types` for the workspaces touched (or `bun run check-types`).
2. `bunx biome check <paths>` (or `bun run check`).
3. `bun run test` when a workspace with a suite changed, or anything it imports. `turbo run test --filter=<workspace>` runs one suite (`@nonete/api`, `@nonete/cron`, `frontend`).

Live checks of `/scalar`, `/openapi.json`, `/rpc` or the UI happen only when the user explicitly asks. If runtime confirmation is needed, ask the user for a screenshot or a pasted response.

## Unit suites — `bun run test`

`turbo test` runs every workspace `test` script and exits non-zero on any failure. Three workspaces have one, each run with `bun test`: `packages/api`, `packages/cron` and `apps/frontend`. Every suite follows the same rules:

- **Hermetic.** No database connection, network call or running service (backend, gateway, Postgres, Loki). A suite passes with nothing running and no `.env`. Code that queries the database runs against the fake database (below), `fetch` is replaced with `spyOn(globalThis, "fetch")`, and anything that depends on the clock or timezone runs under `TZ=UTC` (the `bun test` default) with `setSystemTime` or `jest.useFakeTimers()` from `bun:test`.
- **Tests live in `tests/` at the workspace root**, outside the runtime source (`src/`). Each workspace's `bunfig.toml` limits discovery to `tests/`. Tests are type-checked and linted with the rest of the workspace.
- **No relative imports.** Packages reach their test files through a `"#tests/*": "./tests/*.ts"` entry in `package.json` `imports`, placed before `"#*"` (`#tests/fixtures/context`). The frontend uses `@/` for `src/`.
- **Module mocks last for the whole run.** `mock.module(...)` in `bun test` replaces a module for every later file in the process. A specifier is mocked in one place (a preload, or a single file for a module only that file uses), and the fake behind it is shared and reset per test. Prefer a production injection point (`bindCronService`) or `spyOn` on a real object over `mock.module`.

### The fake database — `@nonete/db/testing`

`packages/db/testing/` (exported as `@nonete/db/testing`, outside `src/`) holds:

- `createFakeDb()`: a stand-in for the Drizzle `db` that accepts any call chain the code builds. Awaiting a chain records `{ op, steps }` and resolves the next result queued for its operation: `query.<table>.findFirst`, `query.<table>.findMany`, `select`, `insert`, `update`, `delete`. The API is `queue(op, ...results)`, `queueError(op, error)`, `calls(op?)`, `reset()` and `db`, typed as the real `Db`. `stepArgs(call, "set")` reads a step's arguments. Awaiting a chain with nothing queued rejects with the operation's name.
- Row factories with fixed defaults (`cronJobRow`, `cronRunRow`, `userRow`, `sessionRow`, `commentRow`, `entityIconRow`, `organizationRow`, `memberRow`, `teamRow`, plus `NOW`). Relational results are built by spreading a row and adding the relation (`{ ...commentRow(), author: userRow() }`).

It checks what the code reads and writes, not the SQL. Queue results in the order the code awaits them, and assert writes through `calls(...)`.

### `packages/api`

- `tests/setup.ts` (preload) *overwrites* the server env with placeholders. `DATABASE_URL` points at a closed loopback port. The optional integration vars (`LOKI_URL`, `ADMIN_*`, `OIDC_*`, `SKIP_ENV_VALIDATION`) are set to `""`, not deleted: `@nonete/env/server` loads the root `.env` with dotenv, which refills unset vars but never overrides set ones, and `emptyStringAsUndefined` reads `""` as unset. When `packages/env/src/server.ts` gains a required var, add a placeholder there. Turbo passes the shell's env through to the task (`passThroughEnv` in `turbo.json`), which is why the preload overwrites instead of defaulting.
- The same preload mocks `@nonete/db` once with the shared fake from `tests/fixtures/db.ts` (`fakeDb`). Handler tests call `fakeDb.reset()` in `beforeEach`.
- Layout mirrors `src/`:
  - `tests/index.test.ts` covers the procedure builders.
  - `tests/shared/<helper>.test.ts` covers the helpers.
  - `tests/v1/<feature>/<topic>.test.ts` covers feature handlers.
  - Test files never go under `src/`.
- Fixtures in `tests/fixtures/`:
  - `context.ts`: contexts.
  - `db.ts`: the shared fake database.
  - `cron-service.ts`: a `CronService` of `mock()` methods bound through `bindCronService`. Call `resetCronService()` in `beforeEach`.
  - `auth.ts`: Better Auth API key shapes. Spy on `auth.api.<method>` with `spyOn`.
  - `errors.ts`: `expectErrorCode(promise, code)`.
- Call procedures with `call(procedure, input, { context })` from `@orpc/server`, which runs the middleware chain as the router does, or call the handler directly when the rule under test lives there. Assert a failure by its `ORPCError` `code`.
- Mock a module only when there is no injection point. `tests/index.test.ts` replaces `#lib/permissions` before dynamically importing `#index`. `tests/v1/logs/handler.test.ts` replaces `@nonete/env/server` with a mutable copy so it can set `LOKI_URL`.

### `packages/cron`

- No preload: the package imports only the schema and the logger type. The fake database is injected through the existing options (`createCronService({ db })`, `createScheduler({ db, … })`, `syncDeclaredJobs({ db, … })`).
- `tests/fixtures/logger.ts`: `pino({ level: "silent" })`.
- `tests/fixtures/bun-cron.ts`: `installFakeBunCron()` replaces in-process `Bun.cron` with a recorder that keeps the real `parse`. A test fires a job with `jobs[i].fire()`, and no timer runs. Call `restore()` in `afterEach`.
- `runNow` returns before the run finishes. Wait for the final status through `onRunChange`, never by sleeping.

### `apps/frontend`

- `tests/setup.ts` (preload) pins `TZ=UTC` and registers a happy-dom window at `https://localhost:4321/`. The URL matters: `history.replaceState` needs a real origin. `tests/bun-env.d.ts` references `bun` types so `astro check` knows `bun:test`, because TypeScript 6 no longer includes every installed `@types/*`.
- Layout:
  - `tests/lib/<file>.test.ts` covers `src/lib`.
  - `tests/hooks/<hook>.test.tsx` covers `src/hooks`.
  - `tests/components/<group>/<component>.test.tsx` covers `src/components/shared`.
- Render with `@testing-library/react` (`render`, `renderHook`, `act`, `fireEvent`, `screen`), query by role and accessible name, and call `cleanup()` in `afterEach`: `bun test` doesn't clean up on its own. There is no `user-event` and no `jest-dom`.
- Not covered yet: hooks built on TanStack Query or Better Auth's client, and feature components under `src/features/`.

## Not present

No unit suite in `apps/backend` or in the other `packages/*`, and no integration or end-to-end suite. To add a unit suite, copy an existing setup:

- a `bunfig.toml` with `root = "./tests"`;
- a preload if the workspace imports `@nonete/env/server` or needs a DOM;
- a `"#tests/*"` import entry in a package;
- `tests/`;
- a `"test": "bun test"` script.
