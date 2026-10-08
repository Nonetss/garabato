# Backend API layering (`packages/api`)

The package root holds infrastructure shared by every API version:

- `context.ts` builds the oRPC `Context` (`{ user, session, headers, requestId }`) from the Hono context set by the auth session middleware and the request logger, plus the request's logger under `@orpc/pino`'s symbol. Read the logger with `getRequestLogger(context)`. The cron scheduler adds `cron: { jobId, jobName }`; HTTP contexts never carry it, and cron contexts have no `requestId` or logger.
- `errors.ts` defines one `errorMap` (every standard oRPC code, `BAD_REQUEST` … `GATEWAY_TIMEOUT`, each with its default message) wired once in `index.ts`, plus one `errors` constructor map (`createORPCErrorConstructorMap(errorMap)`, from `@orpc/contract`). The map declares no HTTP status: oRPC v2 maps codes to statuses in the handlers, whose default `COMMON_ERROR_STATUS_MAP` covers every code, and error bodies carry `code`, `message` and `data` but no `status`. Throw with `errors.UNAUTHORIZED()` etc. — never `new ORPCError(...)` directly. Messages the UI shows are Spanish (`errors.NOT_FOUND({ message: "Comentario no encontrado" })`). Which code to throw: `references/api/http-semantics.md`.
- `index.ts` exports the procedure builders and the meta plugins built with `defineMeta`: `cronMeta`/`getCronMeta` and `getAccessMeta` (its `accessMeta` stays private). Each builder stamps `access` — never set it by hand:

| Builder | Access |
|---|---|
| `publicProcedure` | no auth |
| `protectedProcedure` | any signed-in user; `UNAUTHORIZED` otherwise |
| `adminProcedure` | global `user.role === "admin"` (`UNAUTHORIZED` without session, `FORBIDDEN` otherwise) |
| `permissionProcedure(resource, action)` | organization-scoped permission via Better Auth `hasPermission` in the session's active organization; global admins bypass it. Resources/actions come from `appStatements` in `packages/auth/src/permissions.ts` |
| `cronProcedure` | reachable only from the in-process scheduler |

- `shared/` holds cross-feature helpers. Besides the generic ones below, the security and storage helpers shared by `certificate` and `document`: `vault.ts` (envelope AES-256-GCM, scoped `<kind>:<id>:<purpose>` AAD), `pkcs12.ts` (`readPkcs12`, `openSigningKey`), `certificate-secrets.ts` (open a stored certificate's file and remembered password, Spanish PKCS#12 errors), `object-storage.ts` (`createObjectStorage` and the S3 error mapping), `caller.ts` (`requireUserId`) and `db-errors.ts` (`isUniqueViolation`). `lib/object-storage.ts` holds the real `Bun.S3Client` instance; `tests/setup.ts` replaces it with the in-memory fake from `tests/fixtures/object-storage.ts`, the way it installs the fake database.
- Generic helpers in `shared/`: `pagination.ts` (`paginate`, `paginateWithTotal`, keyset cursor codec, `paginationLimit`/`paginationCursor`), `search.ts` (inputs and `likePattern` for `search` procedures, see `references/api/free-text-search.md`), `dates.ts` (`toIso`, `toIsoOrNull`), `not-found.ts` (`assertFound`), `procedure-docs.ts` (a procedure's OpenAPI summary/description/tags and input JSON Schema, used by cron discovery). `lib/permissions.ts` wraps the organization permission check.
- `router.ts` assembles the top-level `appRouter` by nesting each version's router under its own key (`v1: v1Router`) — the only place a new version gets wired in.

Procedure metadata (`cron`): see `references/cron.md`.

## Before adding a procedure or helper

Search what exists first; don't add a near-duplicate.

- **Procedures**: `src/v1/router.ts` lists every feature; each `src/v1/<feature>/router.ts` lists its procedures with `.meta(openapi({ summary, description, tags }))`. `rg -n "summary:" packages/api/src/v1` gives a quick index. If one covers the need, call it from the client; if one is close, extend it (an optional filter, an extra output field) rather than adding a sibling, unless the method or access would differ.
- **Helpers**: reuse `src/shared/*` and `src/lib/*` (pagination, search inputs and `likePattern`, ISO dates, `assertFound`, the permission check) and the builders in `src/index.ts`. A helper only one feature uses stays in that feature's `handler.ts`; move it to `src/shared/` when a second feature needs it.
- **Where a new procedure goes**: the feature whose data it reads or writes (its `router.ts`, `input.ts`, `output.ts`, `handler.ts`), or a new feature folder wired into `src/v1/router.ts`. Model it on the closest existing procedure of the same kind (list, search, create, toggle…).

## Features

Everything version-specific lives under `src/<version>/` (currently only `src/v1/`). Every procedure belongs to a **feature**, colocated under `packages/api/src/<version>/<feature>/`, one file per concern:

- `<feature>/input.ts` — zod request schemas, exported as `<feature>Input` keyed by method (e.g. `apiKeyInput.create`). Only present when procedures take input.
- `<feature>/output.ts` — zod response schemas, exported as `<feature>Output` keyed by method.
- `<feature>/handler.ts` — business logic, exported as `<feature>Handler` keyed by method. Each method takes a single options object, `async ({ context, input }: { context: Context; input?: z.infer<typeof <feature>Input.<method>> }) => ...` (omit what it doesn't use) — no other param shapes. Calls into `@nonete/auth` / `@nonete/db` etc. live here, never in the router.
- `<feature>/router.ts` — oRPC wiring only, exported as `<feature>Router`: builder → `.meta(openapi({ summary, description, tags, method, successStatus? }), cronMeta(...)?)` → `.input(...)` (if any, called once: v2 stacks repeated `.input`/`.output` calls) → `.output(...)` → `.handler(({ context, input }) => featureHandler.method({ context, input }))`. Choosing `method` and `successStatus`: `references/api/http-semantics.md`.
- `src/<version>/router.ts` nests each feature's router under its own key (`apiKey: apiKeyRouter`, `health: healthRouter`).

Some features also carry feature-specific modules beside those four (`cron/discovery.ts`, `cron/events.ts`, `cron/runtime.ts`, `entity-icon/targets.ts`).

OpenAPI `summary`/`description`/`.describe()` texts are English.

## File uploads

A procedure that receives a file declares it in its zod input with `z.file().max(<bytes>)` (`certificate.import` is the reference). Over `/rpc` the frontend passes the `File` straight into `.call()` and oRPC sends the call as multipart; the OpenAPI document shows a `multipart/form-data` body with a binary field. Rules:

- Always cap the size in the schema. Small files (a PKCS#12) stay under the default 1 MiB body limit; a procedure that needs more (`document.upload`, 20 MiB) is added to `UPLOAD_PROCEDURE_PATHS` in `apps/backend/src/routers/handler-plugins.ts`, which serves it with the larger handler (`references/env.md`).
- Don't trust the MIME type (browsers send several or none for the same extension): parse the bytes and map a failed parse to `errors.BAD_REQUEST` with a Spanish message.
- Read it in the handler with `new Uint8Array(await input.file.arrayBuffer())`. Never log the file or any secret that travels with it (a password).

## Tests

Every new or changed handler method gets its tests in `packages/api/tests/v1/<feature>/handler.test.ts` in the same change: happy path, each error code it throws, and the rows it writes. A new `src/shared` helper gets `tests/shared/<helper>.test.ts`. Recipe and fake database: `references/testing.md`.

## Wiring rules

- Intra-feature imports use the version-scoped path (`import { apiKeyInput } from "#v1/api-key/input"`).
- Shared modules (`context.ts`, `errors.ts`, `index.ts`, `shared/*`, `lib/*`) are reached via the unversioned `#*` alias (`import type { Context } from "#context"`), never copied into a version folder.
- Client calls and HTTP paths always carry the version: `orpc.<version>.<feature>.<method>()`, `/rpc/<version>/<feature>/<method>`, `/api/<version>/<feature>/<method>` — the segment comes from the top-level `appRouter`'s nesting, not a hardcoded prefix in `apps/backend`. A new version is a new `src/<version>/` folder plus one key in the package-root `router.ts`; existing versions are never touched.
