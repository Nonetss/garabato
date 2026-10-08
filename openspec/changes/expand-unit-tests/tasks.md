## 1. Shared fake database

- [x] 1.1 Create `packages/db/testing/fake-db.ts` with `createFakeDb()`: Proxy chain recorder keyed by operation (`query.<table>.findFirst|findMany`, `select`, `insert`, `update`, `delete`), `queue(op, ...results)`, `calls(op?)`, `reset()`, rejection naming the operation when nothing is queued, and `db` typed as the real `Db` through the single documented cast
- [x] 1.2 Add the `"./testing"` export to `packages/db/package.json` ahead of the `"./*"` pattern and confirm `bun run --filter @nonete/db check-types` and Biome cover `testing/`
- [x] 1.3 Add a small self-test for the fake (queued result returned, calls recorded, empty queue rejects) under `packages/api/tests/fixtures/` or `packages/cron/tests/`, whichever lands first

## 2. `packages/api` harness

- [x] 2.1 Mock `@nonete/db` once in `packages/api/tests/setup.ts` with the shared fake (`db`, inert `createDb`/`closeDb`) and check the existing 48 tests still pass
- [x] 2.2 Add `tests/fixtures/fake-cron-service.ts` (`CronService` of `mock()` methods bound through `bindCronService`) and move `tests/v1/cron/watch-runs.test.ts` onto it
- [x] 2.3 Add `tests/fixtures/auth.ts` (Better Auth API key shapes; tests `spyOn(auth.api, …)`) and verify `tests/index.test.ts` is unaffected

## 3. `packages/api` handler tests

- [x] 3.1 `tests/v1/comment/handler.test.ts`: tree nesting and soft-deleted roots, `counts` zero-fill, `create` parent `NOT_FOUND`/`BAD_REQUEST`, `update`/`delete` `FORBIDDEN` for non-authors, idempotent delete without write
- [x] 3.2 `tests/v1/entity-icon/handler.test.ts`: unregistered type `BAD_REQUEST`, non-writable `NOT_FOUND`, `getMany` filtered by readable and no query when none, `deleteEntityIcons` no-op on empty ids (fake target registered in `beforeEach`)
- [x] 3.3 `tests/v1/organization/handler.test.ts`: unknown role `BAD_REQUEST` with no insert, existing member `CONFLICT`, missing organization/member/team `NOT_FOUND`
- [x] 3.4 `tests/v1/session-history/handler.test.ts`: page size, `nextCursor` only when more rows and decodes to the last row, sessions without user skipped
- [x] 3.5 `tests/v1/api-key/handler.test.ts`: Better Auth dates serialized to ISO strings or `null`
- [x] 3.6 `tests/v1/logs/handler.test.ts`: LogQL filters escaped, `fetch` rejection and non-OK response → `BAD_GATEWAY`, unparsable lines skipped, numeric pino levels mapped (`fetch` spied, `@nonete/env/server` mocked with `LOKI_URL`)
- [x] 3.7 `tests/v1/cron/handler.test.ts`: cron error mapping to `NOT_FOUND`/`CONFLICT`/`BAD_REQUEST`, `create` `userId` binding (omitted vs `null`), `listRuns` keyset paging
- [x] 3.8 Run `bun run --filter @nonete/api check-types`, `bunx biome check packages/api packages/db` and `turbo run test --filter=@nonete/api`

## 4. `packages/cron` suite

- [x] 4.1 Add `packages/cron/bunfig.toml` (`root = "./tests"`), a `"test": "bun test"` script and `pino` (catalog) as devDependency
- [x] 4.2 Add `tests/fixtures/logger.ts` (`pino({ level: "silent" })`) and `tests/fixtures/bun-cron.ts` (spy recording expression and handler, `stop` mocks, real `parse` kept, original restored)
- [x] 4.3 `tests/cron-expression.test.ts` and `tests/errors.test.ts`: valid/invalid expressions, non-UTC timezone, `nextRunAt` from a given date, `isUniqueViolation` on error and `cause`
- [x] 4.4 `tests/declared.test.ts`: insert new, update changed or disabled, skip identical, soft-delete undeclared, disable on invalid expression, continue past unique violation
- [x] 4.5 `tests/service.test.ts`: validation before writes, duplicate name → `CronValidationError`, missing → `CronNotFoundError`, `code` jobs → `CronReadOnlyError` with no writes, `onChange` called on success
- [x] 4.6 `tests/scheduler.test.ts`: idempotent `start`, `refresh` reschedules changed and unschedules disabled, `stop` stops all, `runNow` not-found/in-progress errors, success and failure runs, listener failure isolated, `recoverOrphanedRuns`
- [x] 4.7 Run `bun run --filter @nonete/cron check-types`, `bunx biome check packages/cron` and `turbo run test --filter=@nonete/cron`

## 5. `apps/frontend` suite setup

- [x] 5.1 Add devDependencies `@happy-dom/global-registrator`, `@testing-library/react`, `@testing-library/dom` and `@types/bun` (catalog), and a `"test": "bun test"` script
- [x] 5.2 Add `apps/frontend/bunfig.toml` (`root = "./tests"`, preload) and `tests/setup.ts` registering happy-dom and pinning `TZ=UTC`
- [x] 5.3 Confirm `@/` imports resolve under `bun test` and `bun run --filter frontend check-types` type-checks `tests/`

## 6. `apps/frontend` tests

- [x] 6.1 `tests/lib/format.test.ts` (fixed clock with `setSystemTime`), `fold-text.test.ts`, `deterministic-id.test.ts`, `user-display.test.ts`
- [x] 6.2 `tests/lib/app-surfaces.test.ts` and `site-nav.test.ts`: path matching, admin-only filtering, current-item detection, sidebar section
- [x] 6.3 `tests/lib/recent-surfaces.test.ts`, `icon-registry.test.ts`, `theme.test.ts`
- [x] 6.4 `tests/hooks/`: `use-debounced-value`, `use-on-open`, `use-dialog-form`, `use-edit-dialog`, `use-target-dialog`, `use-query-param`, `use-copy-to-clipboard` (stubbed `navigator.clipboard`), `use-hydrated`, with fake timers where they wait
- [x] 6.5 `tests/components/form/`: `ip-input`, `cidr-input`, `number-stepper` (wrap at bounds), `segmented-picker`
- [x] 6.6 `tests/components/`: `resource/filter-chips` and `feedback/query-state` (error, pending, empty, filtered-empty and success branches)
- [x] 6.7 Run `bun run --filter frontend check-types`, `bunx biome check apps/frontend` and `turbo run test --filter=frontend`

## 7. Docs and final validation

- [x] 7.1 Update `.agents/skills/stack/references/testing.md`: three suites, `@nonete/db/testing`, the preload `@nonete/db` mock and shared fakes, frontend DOM/timers setup, and the "Not present" section
- [x] 7.2 Update the `bun run test` line in `.agents/skills/stack/references/commands.md` and the testing row or rule in `stack/SKILL.md` that says only `packages/api` has a suite
- [x] 7.3 Run `bun run check-types`, `bun run check` and `bun run test` from the root and confirm all three suites pass with no `.env` and nothing running
