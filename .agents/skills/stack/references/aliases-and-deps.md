# Path aliases and dependencies

## Two aliasing schemes

**Apps** use `@/` → their own `./src/*` (tsconfig `paths` in `apps/backend`; tsconfig `paths` + Vite `resolve.alias` in `apps/frontend`). App-internal only — never cross-package.

**Shared packages** (`packages/api`, `cron`, `db`, `logger`) use Node **subpath imports** (`#` prefix) declared in their own `package.json` `imports`. They resolve per-package in tsc, Bun, Vite and tsdown with no plugins. A shared `@/` would collide because these packages export raw TS consumed by other workspaces.

`packages/auth` uses `#auth/*` → `./src/*.ts` (plus one relative import, `./oauth`); `packages/env` and `packages/config` use neither.

### `imports` field rules

- General pattern: `"#*": "./src/*.ts"`. Resolvers don't search extensions on the target, so the `.ts` is load-bearing.
- `packages/db` adds explicit entries before the wildcard: `#schema`, `#schema/*` (→ `./src/schema/*/index.ts`), `#seed`, `#seed/*`. Add any new directory that needs an `index.ts` target the same way (and mirror it in `exports` if other workspaces import it).
- In `packages/api`, the single `#*` also covers versioned paths (`#v1/health/handler` → `./src/v1/health/handler.ts`); no separate `#v1/*` entry is needed.

### In practice

```ts
// apps/frontend
import { PageShell } from "@/components/shared/layout/page-shell"

// packages/api, inside a feature
import { apiKeyInput } from "#v1/api-key/input"
import type { Context } from "#context"

// across packages: the package name (the @nonete scope is kept on purpose)
import { db } from "@nonete/db"
```

## Dependencies

- Versions are pinned in root `workspaces.catalog`. A dependency declared by **two or more** workspaces is `catalog:` in each of them.
- Bun 1.4.2, `linker = "isolated"` (`bunfig.toml`): a workspace can only import what its own `package.json` declares.
- The backend build inlines every dependency (`tsdown` `deps.alwaysBundle`) and the frontend build bundles them into `dist/server` (`vite.ssr.noExternal`); runtime images ship no `node_modules`.
- **Adding a Bun workspace** means adding its `package.json` `COPY` line to `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` and their `Dockerfile.dev` twins, a `sync` entry for its `src` in `compose.dev.yml` for each service that imports it, and updating `references/workspaces.md`.
