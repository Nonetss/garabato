# Keyset Pagination

## Purpose

Provides a shared Drizzle keyset pagination helper used by every `(timestamp, id)` cursor-paginated list, consumable by `packages/cron` without oRPC dependencies.

## Requirements

### Requirement: Shared keyset pagination builder

Any backend list endpoint that paginates by a `(timestamp, id)` keyset cursor SHALL build its query through the shared `withKeysetPagination` Drizzle helper (`@nonete/db/keyset-pagination`) instead of hand-rolling its own `SQL[]` filter accumulation, cursor condition and `orderBy`/`limit` chain. The helper SHALL combine the defined filters, add the cursor condition `timestamp < cursor.timestamp OR (timestamp = cursor.timestamp AND id < cursor.id)` when a cursor is given, order by the timestamp and then the id descending, and apply the requested limit.

#### Scenario: Cron runs are paginated through the shared builder

- **WHEN** `cron.listRuns` is called with filters, a cursor and a limit
- **THEN** its query SHALL be built with `withKeysetPagination` over `(cron_run.started_at, cron_run.id)`, returning only rows that match the filters and come strictly after the cursor, newest first, capped at the limit

#### Scenario: Cursor ordering is stable across duplicate timestamps

- **WHEN** two or more rows share the exact same ordering timestamp (`cron_run.started_at`)
- **THEN** the query builder breaks ties using `id` descending, so no row is skipped or duplicated across pages

### Requirement: `packages/cron` stays oRPC-agnostic

The shared keyset pagination helper SHALL be consumable by `packages/cron` without introducing a dependency from `packages/cron` on `packages/api` or on any oRPC/zod-specific module.

#### Scenario: Cron service builds a paginated query with no API-layer import

- **WHEN** `packages/cron/src/service.ts` calls the shared keyset pagination helper to implement `listRuns`
- **THEN** `packages/cron/package.json` still declares no dependency on `@nonete/api`, and the helper it imports lives in `@nonete/db`
