# Testing and validation

## What an agent runs

1. `bun run --filter <workspace> check-types` for the workspaces touched (or `bun run check-types`).
2. `bunx biome check <paths>` (or `bun run check`).
3. `bun run test` when `packages/api` changed (or anything it imports: `packages/auth`, `cron`, `db`, `env`). `turbo run test --filter=@nonete/api` runs it alone.

Live checks of `/scalar`, `/openapi.json`, `/rpc` or the UI happen only when the user explicitly asks. If runtime confirmation is needed, ask the user for a screenshot or a pasted response.

## Unit suite — `bun run test`

`turbo test` runs every workspace `test` script and exits non-zero on any failure. Today the only one is `packages/api`. Every suite follows the same rules:

- **Hermetic.** No database connection, network call or running service (backend, gateway, Postgres, Loki). A suite passes with nothing running and no `.env`.
- **Tests live in `tests/` at the workspace root**, outside the runtime source (`src/`). They are type-checked and linted with the rest of the workspace.

### `packages/api` — `bun test`

- `packages/api/bunfig.toml` limits discovery to `tests/` and preloads `tests/setup.ts`. That preload *overwrites* the server env with placeholders: `DATABASE_URL` points at a closed loopback port, and the optional integration vars (`LOKI_URL`, `ADMIN_*`, `OIDC_*`, `SKIP_ENV_VALIDATION`) are cleared. This way importing `@nonete/auth`/`@nonete/db` passes env validation and never reaches the shell's real database. When `packages/env/src/server.ts` gains a required var, add a placeholder there. Turbo passes the shell's env through to the task (`passThroughEnv` in `turbo.json`), which is why the preload overwrites instead of defaulting.
- Layout mirrors `src/`: `tests/index.test.ts` covers the procedure builders, `tests/shared/<helper>.test.ts` covers the helpers, `tests/v1/<feature>/<topic>.test.ts` covers feature handlers (`tests/v1/cron/watch-runs.test.ts`). Test files never go under `src/`.
- Call procedures with `call(procedure, input, { context })` from `@orpc/server`, which runs the middleware chain as the router does. Assert a failure by its `ORPCError` `code`. Build contexts with `tests/fixtures/context.ts`.
- Mock a module boundary with `mock.module("#…", …)` *before* dynamically importing the code under test (see how `tests/index.test.ts` replaces `#lib/permissions`, and `tests/v1/cron/watch-runs.test.ts` replaces `#v1/cron/runtime`). A handler test that touches the database mocks `@nonete/db` the same way. It never runs a query.

## Not present

No unit suite in `apps/backend`, `apps/frontend` or the other `packages/*`, and no end-to-end suite. To add a unit suite, copy the `packages/api` setup: a `bunfig.toml`, a preload if the package imports `@nonete/env/server`, `tests/`, and a `"test": "bun test"` script.
