# TypeScript code style: no casts, no fallback chains

The user does not accept code that forces types or packs logic into chained operators. It hides what the code decides and lets type errors through. This applies to every TypeScript file in the repo (`apps/*`, `packages/*`), new code and code you touch.

## Not allowed

| Pattern | Example |
|---|---|
| Casts that silence the type checker | `value as Target`, `value as unknown as Target`, non-null `value!` |
| Generic defaults or shapes made up so a type fits | `TData = unknown` that nothing needs, `(...args: never[]) => unknown` in a `satisfies` |
| `??` chains (two or more) | `schedule.description ?? docs.description ?? docs.summary ?? null` |
| `??` with a non-literal default | `job.description ?? job.cronExpression` |
| Ternaries that are nested or inside an expression | `list.flatMap((x) => (x.ok ? [x.id] : []))`, `{ placeholderData: ok ? keep : undefined }`, `return missing ? null : filled` |
| Memoization with `let` + `??=` (and a `.catch` to undo it) | `let spec; const get = () => (spec ??= build())` |

## Allowed

- One `??` with a **literal** default: `user.name ?? ""`, `value ?? ""`, `x ?? undefined`.
- One simple ternary as the value of an assignment: `const mode = enabled ? "on" : "off"`.
- Optional chaining used for reading (`user?.role === "admin"`), as long as it doesn't feed a `??` chain.
- Import aliases (`import { appRouter as v1Router }`) are not casts.

## What to write instead

- **Type erasure.** Keep the real type instead of erasing it. A registry of entries with different types is checked with `satisfies` against the common concrete shape, and its consumers get the real union (`apps/frontend/src/features/app-shell/authenticated/model/surface-search-sources.ts`, `satisfies Record<SurfaceSearchSourceId, SurfaceSearchSourceShape>`).
- **Values that may be of another kind.** Narrow with a guard, never with `as`: `if (typeof jsonSchema === "boolean") return null` (`packages/api/src/shared/procedure-docs.ts`).
- **Checks that are repeated afterwards** (`meta?.x` after confirming `meta`). Turn the check into a type guard: `function isDeclaredSchedule(meta: CronMeta | undefined): meta is DeclaredSchedule` (`packages/api/src/v1/cron/discovery.ts`).
- **Defaults with several fallbacks.** A function with a name and early returns. Compare with `!== undefined` / `!== null` to keep the semantics of `??`, because an empty string still counts as a value (`declaredJobDescription` in the same file):

  ```ts
  function declaredJobDescription(schedule: DeclaredSchedule, docs: ProcedureDocs): string | null {
    if (schedule.description !== undefined) return schedule.description
    if (docs.description !== undefined) return docs.description
    if (docs.summary !== undefined) return docs.summary
    return null
  }
  ```

- **Filtering and transforming.** Use `.filter().map()`, or a `for` loop that `push`es. Never `flatMap` with a ternary that returns `[]`.
- **Objects that depend on a condition.** Use two explicit returns, not a ternary inside a property.
- **Caches.** Before memoizing, check whether the work is worth it: the docs spec is generated per request (`apps/backend/src/routers/docs.ts`). The lazy cache with `let` in `packages/api/src/v1/cron/discovery.ts` stays, because every cron handler lookup reads it and it can't be a top-level `const` (discovery and the routers import each other).

## When a type doesn't fit

Don't force it. Find the type the library exposes (`AnyProcedureContract`, what `convert()` returns…), narrow with guards, or rethink the design. If there's still no clean way, stop and ask the user before writing a cast.
