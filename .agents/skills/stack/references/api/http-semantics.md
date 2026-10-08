# HTTP methods, success statuses and error codes (`packages/api`)

Every procedure declares its HTTP contract in `.meta(openapi({ method, successStatus? }))` (`openapi` from `@orpc/openapi`) and signals failure with `errors.<CODE>()` from `#errors`. This file says which ones to pick. The normative version is the `api-documentation` OpenSpec capability ("Documented operation metadata", "Error codes reflect the failure cause"), today in `openspec/changes/adopt-stack-foundation/specs/api-documentation/spec.md`.

## The model: RPC paths, semantic verbs

No procedure declares a `path`. OpenAPI paths come from the router keys (`/api/v1/collection/updateItem`), and identifiers travel in the body (writes and `QUERY`) or the query string (`GET`/`DELETE`), never in the path. The API is RPC-style with HTTP verbs, not resource-oriented REST, so the procedure name carries the intent and the method states its **safety and idempotency**.

The declared method and status shape the OpenAPI surface (`/api/v1/...`, `/openapi.json`, Scalar), and changing them breaks external `/api` clients. On `/api`, a `GET` carries its input in the query string; `SmartCoercionHandlerPlugin` turns those strings into the types the input schema declares (`z.number()`, `z.boolean()`, arrays), so declare real types and never `z.coerce.*` for this. A `QUERY` carries its input as a JSON body, like `POST`, and needs OpenAPI 3.2 (already what `apps/backend/src/routers/docs.ts` generates).

On `/rpc` the declared status is ignored, and the method only matters for reads. The frontend's `RPCLink` (`apps/frontend/src/lib/orpc.ts`) sends a call as `QUERY` when it is a read and as `POST` otherwise. A call counts as a read when TanStack Query makes it as a `query` or `infinite` operation (`queryOptions`, `infiniteOptions`), or when a direct `.call()` passes `{ context: { read: true } }`. Any `.call()` that reads inside a custom `queryFn` (chunked batches, debounced searches) passes that context. The RPC handler (`apps/backend/src/routers/rpc.ts`) accepts `POST`/`PUT`/`PATCH`/`DELETE` on every procedure, `QUERY` only on procedures declared `GET` or `QUERY`, and never `GET`. So turning a read into a write also means removing its `read: true` marks, or the call answers 404. A read that isn't marked still works over `POST`.

A streamed read (an `eventIterator` output that only listens, like `cron.watchRuns`) is declared `GET` like any other read, and the frontend opens it with a direct call that passes `{ context: { read: true } }`. Don't consume it through TanStack Query's `liveOptions`/`streamedOptions`: their operation types (`live`/`streamed`) go out as `POST`. A stream that writes stays `POST`.

## Method

Decide by what the handler does, not by its name:

| The handler… | Method | Examples in this repo |
|---|---|---|
| Only reads, and its input fits a query string (scalars, optional filters, arrays of scalars) | `GET` | `collection.list`, `organization.search`, `logs.query` |
| Only reads, and its input does not fit a query string (arrays of objects, batches of entity refs) | `QUERY` | `collection.favoriteStatuses`, `comment.counts`, `entityIcon.getMany` |
| Creates a new resource whose id the server assigns | `POST` + `successStatus: 201` | `collection.create`, `comment.create`, `organization.createTeam`, `cron.create` |
| Runs an action that is neither CRUD nor idempotent | `POST` | `cron.runNow` |
| Sets the whole state of a target the caller identifies: full replacement, or an "ensure it exists" upsert keyed by a natural key | `PUT` | `entityIcon.set`, `collection.updateItem`, `collection.addItem`, `collection.addFavorite` |
| Changes some fields and leaves the rest untouched | `PATCH` | `collection.update`, `cron.update`, `cron.setEnabled`, `comment.update`, `organization.updateMemberRole` |
| Removes something, including soft deletes, cancellations and membership removals | `DELETE` | `cron.remove` (soft), `organization.cancelInvitation`, `collection.removeFavorite` |

Rules behind the table:

- **`GET` and `QUERY` are safe.** They never write, trigger a job or call a downstream service that writes. Lazy get-or-create of the caller's own defaults belongs in the write path (`addFavorite` creates the favorites collection, `listFavorites` doesn't).
- **`GET` vs `QUERY`.** `GET` is the default for reads: it works from an address bar, from `curl` without a body and from Scalar's "try it". Use `QUERY` only when the input does not fit a query string. Arrays of objects are the case today: bracket notation turns 100 entity refs into a URL of about 9 KB. A batch still caps its array in the zod schema (`.min(1).max(100)`, like `comment.counts`). Never switch a read to `POST` to fit its input. A CDN or WAF placed in front of a deployment must let `QUERY` through, as Caddy, Bun and Vite's proxy already do.
- **`PUT` vs `POST`.** If calling twice leaves the same state and returns the same row, it is `PUT`. Insert-with-`onConflictDoNothing()`/`onConflictDoUpdate()` on a natural key is a `PUT`. Return a `created` flag in the output when the caller needs to tell the outcomes apart.
- **`PUT` vs `PATCH`.** `PUT` replaces what it targets, so an omitted optional value is cleared (`updateItem` sets `metadata ?? null`). `PATCH` never resets what it does not receive. An optional field the caller omits keeps its value. Use `...(input.x !== undefined && { x: input.x })` in the `set()`, and use `null` to clear explicitly.
- **A `PATCH` may require fields.** A single-purpose update requires the field it exists to change (`comment.update` → `content`, `cron.setEnabled` → `enabled`). Toggles and status changes on an existing row are `PATCH`, not `POST`.
- **Actions are `POST` even when they store a record.** `cron.runNow` stores a run, but its purpose is to execute something, and repeating it executes it again.

## Success status

| Case | `successStatus` |
|---|---|
| The procedure exists to create a resource and creates one on every successful call | `201` |
| Everything else: reads, updates, idempotent upserts (which may return an existing row), actions, deletes | omit (default `200`) |

Never declare `204`. Every procedure has an `.output()` and returns a body (deletes return `{ id, success }`), and a `204` with a body is invalid HTTP. A status cannot vary per call (`successStatus` is static), which is one more reason an upsert is `PUT` + `200` rather than `POST` + `201`.

## Error codes

Throw the `errors.<CODE>()` whose status names the **cause**. User-facing messages are Spanish (`errors.CONFLICT({ message: "Ya existe una organización con ese slug" })`), and internal ones are English.

| Code | When | Examples |
|---|---|---|
| `BAD_REQUEST` 400 | The input itself is invalid or inconsistent beyond what zod checks | malformed pagination cursor, unknown custom role name, a reply whose parent belongs to another entity, an entity type that does not support icons, an invalid cron expression |
| `UNAUTHORIZED` 401 | No authenticated caller | the builders, `if (!context.user)` guards |
| `FORBIDDEN` 403 | Authenticated, but **this caller** lacks the role, permission or ownership. Another caller could do it | non-admin on an `adminProcedure`, editing someone else's visible comment, no active organization |
| `NOT_FOUND` 404 | The target does not exist **or is private to someone else** | another user's collection (filter by owner in the `where`, then `assertFound`) |
| `CONFLICT` 409 | Valid input, allowed caller, but the target's **state or kind** rules it out for every caller | duplicate slug, role or membership; a code-declared cron job; the built-in favorites collection |
| `INTERNAL_SERVER_ERROR` 500 | An invariant the server broke | an `insert().returning()` with no row |
| `BAD_GATEWAY` 502 / `SERVICE_UNAVAILABLE` 503 | A downstream service failed / is not configured | Loki unreachable or answering an error in `logs.query` (502) |

Two distinctions that are easy to get wrong:

- **403 vs 404 for ownership.** If the caller cannot even see the resource (private, owner-scoped), answer `404` so its existence does not leak. Use `403` only when the resource is visible to the caller but they may not change it.
- **403 vs 409.** Ask whether an admin or the owner could do it. If yes, it is `403`. If nobody can, because of what the target is or what state it is in, it is `409`. `400` is never right for a valid input that is refused because of the target.

zod validation failures already become `BAD_REQUEST` automatically. Don't re-validate the same rule by hand.

## Checklist for a new or changed procedure

- [ ] The method matches the handler: no writes under `GET` or `QUERY`, `QUERY` only for reads whose input is an array of objects, no reads under `POST`, idempotent target-setting writes are `PUT`, partial updates are `PATCH`.
- [ ] `successStatus: 201` only on procedures whose purpose is to create, and never `204`.
- [ ] A `PATCH` handler keeps omitted optional fields, and a `PUT` handler replaces them.
- [ ] Every `errors.<CODE>()` names the cause (input, identity, permission, existence, target state, server, downstream).
- [ ] The `description` states idempotency or the clear-on-omit behaviour when the method alone doesn't make it obvious.
