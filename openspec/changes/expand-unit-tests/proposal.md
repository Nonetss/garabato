## Why

The only unit suite today is `packages/api`, and it covers the procedure builders, the `src/shared` helpers and one cron handler (`watchRuns`). The feature handlers that hold most of the API's rules (comment ownership, entity-icon access, organization roles, keyset paging), the whole `packages/cron` package (expression validation, the code-declared job sync, the scheduler and the service) and every frontend helper and hook run untested, so a regression in any of them only shows up at runtime.

## What Changes

- Add a hermetic **fake Drizzle database** test fixture that imitates the query-builder chains the code uses (`db.query.<table>.findFirst/findMany`, `select…from…where…`, `insert…values…returning`, `update…set…where…returning`, `delete…where`, `onConflictDoUpdate`), returns queued results and records the calls. No new dependency and no database connection.
- Extend the `packages/api` suite with handler tests for `comment`, `entity-icon`, `organization`, `session-history`, `api-key`, `logs` and the remaining `cron` handler methods, mocking `@nonete/db`, `@nonete/auth`, `#v1/cron/runtime` and `fetch` at their module boundaries.
- Add a **`packages/cron` unit suite** (`bun test`, `tests/`, `bunfig.toml`) covering `cron-expression`, `errors`, `declared` (`syncDeclaredJobs`), `service` (`createCronService`) and `scheduler` (`createScheduler`, `recoverOrphanedRuns`), with the fake database injected and `Bun.cron` replaced by a spy.
- Add an **`apps/frontend` unit suite** (`bun test`, `tests/`, `bunfig.toml`) covering the pure helpers in `src/lib` and, with a DOM provided by `happy-dom`, the hooks in `src/hooks` and a set of shared components through `@testing-library/react`.
- New frontend devDependencies: `@happy-dom/global-registrator`, `@testing-library/react`, `@testing-library/dom`, `@types/bun`. New `packages/cron` devDependency: `pino` (a silent logger for the scheduler and sync).
- Update `references/testing.md` in the `stack` skill so it documents three suites and the fake-database fixture instead of saying only `packages/api` has tests.

No production code changes behavior. No schema or migration changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `unit-testing`: the root command covers three suites (`packages/api`, `packages/cron`, `apps/frontend`) instead of one; the hermetic rule gains a fake-database fixture, a DOM for frontend tests and a fixed timezone/clock; new coverage requirements for the API feature handlers, the cron package and the frontend helpers, hooks and components.

## Impact

- **Code**: new files under `packages/api/tests/`, `packages/cron/tests/` and `apps/frontend/tests/`, plus the shared fake database in `packages/db/testing/` exported as `@nonete/db/testing`; new `bunfig.toml` and `"test": "bun test"` scripts in `packages/cron` and `apps/frontend`.
- **Dependencies**: devDependencies listed above, added to the root catalog where the repo pins shared versions.
- **Tooling**: `bun run test` (`turbo test`) runs three workspaces; `turbo.json`'s `test` task keeps `cache: false`. `apps/frontend`'s `check-types` (`astro check`) also type-checks its `tests/`.
- **Docs**: `.agents/skills/stack/references/testing.md` and `references/commands.md` if it lists the test command per workspace.
- **Not affected**: runtime behavior, the database schema, the Dockerfiles and compose files.
