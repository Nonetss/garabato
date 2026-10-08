## Context

`bun run test` (`turbo test`) runs a single suite, `packages/api` (`bun test`, 48 tests). Its conventions come from the `unit-testing` spec and `references/testing.md`: tests live in `tests/`, a preload (`tests/setup.ts`) overwrites the server env with placeholders, contexts come from `tests/fixtures/context.ts`, and module boundaries are replaced with `mock.module(...)` before the code under test is imported dynamically.

What makes the rest hard to test today:

- The API handlers import the shared `db` from `@nonete/db` and build Drizzle chains inline (`db.query.comments.findFirst(...)`, `db.insert(...).values(...).returning()`).
- `packages/cron` gets its `db` injected (`createCronService({ db })`, `createScheduler({ db, … })`, `syncDeclaredJobs({ db, … })`) typed as `Db = typeof db`, schedules through `Bun.cron` and logs through a pino `Logger`.
- `apps/frontend` has no test runner, no DOM, and its `check-types` is `astro check` over `**/*` (it would also see `tests/`).

The user chose a fake Drizzle database over an in-process Postgres (PGlite) or testing only DB-free logic.

## Goals / Non-Goals

**Goals:**

- Cover the API feature handlers, the cron package and the frontend helpers, hooks and a set of shared components, as listed in the `unit-testing` delta spec.
- Keep every suite hermetic and fast. All three suites together should still run in a few seconds.
- One fake-database implementation shared by `packages/api` and `packages/cron`.
- Zero changes to production code behavior.

**Non-Goals:**

- Validating real SQL, migrations, constraints or Drizzle relation config. That would need a real Postgres (integration or end-to-end tests), which is out of scope.
- End-to-end or browser tests (Playwright), and visual or snapshot tests.
- Coverage thresholds or a coverage gate in CI.
- Hooks that wrap TanStack Query or Better Auth's client (`use-hydrated-query`, `use-admin-user`, `use-orpc-mutation`…), and feature components under `src/features/`. These can follow later using the same setup.
- Tests for `apps/backend`, `packages/auth`, `packages/logger`, `packages/env`.

## Decisions

### 1. Fake Drizzle database and row factories live in `packages/db/testing/`, exported as `@nonete/db/testing`

A Proxy-based recorder: any property access on a chain returns a function that returns the chain again, and awaiting the chain (`then`) resolves the next result queued for its **operation key**. The key is the root of the chain: `query.<table>.findFirst`, `query.<table>.findMany`, `select`, `insert`, `update`, `delete`. Each awaited chain is recorded as `{ op, steps: [{ method, args }] }`, so a test can read `set(...)` values, `values(...)` rows or the `where` condition. The API is small:

- `createFakeDb()`
- `fake.queue(op, ...results)`
- `fake.calls(op?)`
- `fake.reset()`
- `fake.db`: the fake typed as the real `Db`

Awaiting a chain with an empty queue rejects with `fake db: no result queued for "<op>"`. `fake.queueError(op, error)` makes the next chain reject (for unique-violation paths). `stepArgs(call, method)` reads one step's arguments.

The same folder holds row factories with fixed defaults (`cronJobRow`, `userRow`, `commentRow`…), so both suites build complete, correctly typed rows without casts. `testing/index.ts` re-exports both modules, which import each other through `"#testing/*": "./testing/*.ts"`.

- **Why `packages/db`**: both `packages/api` and `packages/cron` already depend on `@nonete/db`, and the fake mirrors that package's API. Test fixtures can't be imported across workspaces from another workspace's `tests/`. Duplicating the fake in two places would drift.
- **Why `testing/` and not `src/`**: `src/` is runtime source. The explicit `"./testing"` export sits before the `"./*"` pattern so it doesn't resolve into `src/`. `packages/db`'s `tsc` and Biome already cover the folder.
- **The one cast**: `fake.db` is typed as `Db` through a single documented cast inside the fixture. A structural subset of Drizzle's type can't satisfy `typeof db`. This is the only cast the change adds, it lives in test support, and the user approved it with the fake-database choice.
- **Alternatives**: PGlite (rejected by the user: a new dependency, slower, and it would mean applying migrations to an in-process database). Per-handler hand-written stubs (rejected: duplicated and brittle). Refactoring handlers to take an injected `db` (rejected: it changes production code for tests).

### 2. Module mocks are installed once per run, with shared configurable fakes

`mock.module` in `bun test` replaces a module for the rest of the process, across files, so two files that mock `@nonete/db` with different factories would interfere depending on load order.

- `packages/api/tests/setup.ts` also mocks `@nonete/db` once, so `db` resolves to the shared fake for the whole run. `createDb` and `closeDb` stay inert. Each handler test calls `fake.reset()` in `beforeEach`. Mocking in the preload means every importer, `@nonete/auth`'s Drizzle adapter included, sees the same fake and never touches the pool. The adapter is never exercised: `@nonete/auth` calls are mocked in the files that need them.
- Prefer injection points and spies over module mocks. The cron handlers reach the service through `getCronService()`, so `tests/fixtures/cron-service.ts` binds a `CronService` made of `mock()` methods through the production `bindCronService`. There is no module mock for `#v1/cron/runtime`, and `watch-runs.test.ts` moved to it. Better Auth calls are spied with `spyOn(auth.api, "<method>")` on the real object (`tests/fixtures/auth.ts` builds the API key shapes), which restores cleanly and doesn't leak.
- The preload's "cleared" integration vars are set to `""` instead of deleted. `@nonete/env/server` loads the root `.env` with dotenv, which refilled deleted vars, so the suite was running with the developer's real `LOKI_URL`/`OIDC_*`/`ADMIN_*`. Dotenv never overrides a var that is already set, and `emptyStringAsUndefined` reads `""` as unset.
- `fetch` (logs handler) is replaced with `spyOn(globalThis, "fetch")`. The logs test mocks `@nonete/env/server` with a mutable copy of the real env, so each test can set or unset `LOKI_URL`. It is the only file that mocks that module.

### 3. `packages/cron` gets its own suite with injected fakes

The suite runs with `bun test`, a `bunfig.toml` with `root = "./tests"`, and `tests/fixtures/` for a silent logger and the `Bun.cron` spy. It needs no env preload: `@nonete/cron` imports only `@nonete/db/schema/cron` (no env) and the logger as a type. The fake database comes from `@nonete/db/testing` and is injected through the existing options, so no module mocks are needed.

- **Logger**: `pino({ level: "silent" })` satisfies `typeof logger` (`Logger`) without a cast. `pino` is added as a cron devDependency from the catalog.
- **`Bun.cron`**: replaced in the scheduler tests with a spy that records `(expression, handler)` and returns `{ stop }` mocks, keeping the real `Bun.cron.parse` that `nextRunAt` uses. A test fires a job by calling the captured handler, so no real timer runs. `start()` is called with a large `pollIntervalMs`, and `stop()` runs in `afterEach` so the interval is cleared.
- **Background runs**: `runNow` doesn't await `performRun`, so tests wait for the `onRunChange` notification of the final status (a promise resolved by the listener) instead of sleeping.

### 4. `apps/frontend` suite: `bun test` + `happy-dom` + Testing Library

- **Setup**: `bunfig.toml` (`root = "./tests"`, `preload = ["./tests/setup.ts"]`). The preload calls `GlobalRegistrator.register({ url: "https://localhost:4321/" })` from `@happy-dom/global-registrator` (a real origin, because `history.replaceState` is a no-op on `about:blank`) and pins `process.env.TZ = "UTC"` (it's already `bun test`'s default, but this keeps it explicit against a `TZ` passed through the shell). The `@/` alias resolves from `tsconfig.json` `paths`, which Bun honours natively.
- **New devDependencies**: `@happy-dom/global-registrator`, `@testing-library/react`, `@testing-library/dom`, `@types/bun`. Interaction uses Testing Library's `fireEvent`: no `user-event` and no `jest-dom` matchers. Assertions read the DOM through role and name queries.
- **Clock and timers**: relative date labels use `setSystemTime` from `bun:test`. Debounce and clipboard-reset timers use `jest.useFakeTimers()` / `advanceTimersByTime` from `bun:test` (verified to work on the installed Bun).
- **Type-checking**: `astro check` already includes `tests/` through `"include": ["**/*"]`. TypeScript 6 no longer includes every installed `@types/*` package, so `tests/bun-env.d.ts` adds `/// <reference types="bun" />` to provide `bun:test`.
- **Alternative considered**: Vitest + jsdom (rejected: a second test runner in a Bun-only repo, plus the Vite/Astro config to keep in sync).

### 5. Layout mirrors `src/`, imports never go relative

Test files import fixtures through a `"#tests/*": "./tests/*.ts"` subpath import in `packages/api` and `packages/cron`, placed before `"#*"`. The frontend uses `@/`. No test or fixture uses `./` or `../`.

| Workspace | Tests |
|---|---|
| `packages/api` | `tests/v1/<feature>/<topic>.test.ts`, fakes in `tests/fixtures/` |
| `packages/cron` | `tests/<module>.test.ts` (`cron-expression`, `errors`, `declared`, `service`, `scheduler`), fixtures in `tests/fixtures/` |
| `apps/frontend` | `tests/lib/<file>.test.ts`, `tests/hooks/<hook>.test.tsx`, `tests/components/<group>/<component>.test.tsx` |

### 6. Entity-icon targets in tests

`entityIconTargets` is empty in production. The entity-icon tests register a fake target in the record in `beforeEach` and delete it in `afterEach`, which exercises the real registry path without adding a production target.

## Risks / Trade-offs

- [The fake accepts any chain, so a query with a wrong column or a broken relation still passes] → Tests assert the operation and the values written, not SQL. Real-database coverage stays a separate, future integration suite.
- [A test can depend on the order of queued results] → Each test queues results in the order the handler awaits them and asserts recorded calls. The fake's "nothing queued" error points at the missing operation.
- [Mocking `@nonete/db` in the preload hides a real import-time failure in `@nonete/db`] → `check-types` still covers it, and the backend boots against the real module.
- [Mock leakage between files in one `bun test` process] → Covered by decision 2: one installation per specifier with shared, resettable fakes.
- [Replacing `Bun.cron` drops properties such as `parse`] → The spy fixture re-attaches the real `parse` and restores the original in `afterEach`.
- [`@types/bun` in the frontend exposes Bun globals to `src/` type-checking] → Accepted. Frontend code doesn't use them, and Biome and review catch misuse. A separate `tests/tsconfig.json` could isolate them later if it becomes a problem.
- [React 19 + happy-dom gaps (e.g. `navigator.clipboard`)] → The clipboard hook test stubs `navigator.clipboard.writeText`. Components that need APIs happy-dom lacks are left out of this change.

## Migration Plan

Additive only: new test files, fixtures, `bunfig.toml` files, `test` scripts and devDependencies. Rolling back means deleting them. `bun run test` keeps exiting non-zero on any failure. The CI workflows (`.gitea/workflows/docker-build.yml`, `.github/workflows/docker-build.yml`) only build images and don't run tests; wiring `bun run test` into CI is out of scope.

## Open Questions

- None blocking. Testing TanStack Query hooks and feature components is deliberately deferred (see Non-Goals).
