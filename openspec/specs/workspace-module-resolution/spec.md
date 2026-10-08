# Workspace Module Resolution

## Purpose

Defines how workspaces are named and resolve modules: `@nonete/*` packages with `#` subpath imports, the `@/` alias in apps, isolated declared dependencies, and registration of new workspaces in every image.

## Requirements

### Requirement: Shared packages use the @nonete scope

Every shared workspace under `packages/` SHALL be named `@nonete/<name>` (`@nonete/api`, `@nonete/auth`, `@nonete/config`, `@nonete/cron`, `@nonete/db`, `@nonete/env`, `@nonete/logger`) and SHALL be consumed as raw TypeScript source through its `package.json` `exports`, with no build step of its own. Apps SHALL be named after their folder (`backend`, `frontend`).

#### Scenario: Cross-package import

- **WHEN** code in `apps/backend` or in another package needs the database client
- **THEN** it SHALL import it as `import { db } from "@nonete/db"` (or a declared subpath export such as `@nonete/db/schema/auth`), never through a relative path into another workspace

#### Scenario: No leftover scope

- **WHEN** the repository is searched for `@better/`
- **THEN** no import, `package.json` dependency or tsconfig reference SHALL match

### Requirement: Packages resolve internal modules with # subpath imports

Inside a shared package, internal modules SHALL be imported through Node subpath imports declared in that package's own `package.json` `imports` field, never through `@/` or long relative chains. The general mapping SHALL be `"#*": "./src/*.ts"` (with the `.ts` extension in the target) for `api`, `cron` and `logger`. `@nonete/db` SHALL declare `#schema` → `./src/schema/index.ts`, `#schema/*` → `./src/schema/*/index.ts`, `#seed` → `./src/seed/index.ts` and `#seed/*` → `./src/seed/*.ts` before its `#*` wildcard. `@nonete/auth` SHALL declare `#auth/*` → `./src/*.ts` with a matching tsconfig `paths` entry. `@nonete/env` and `@nonete/config` SHALL declare no aliases.

#### Scenario: Versioned API module

- **WHEN** a file in `packages/api` imports the request context or a feature's input schema
- **THEN** it SHALL write `import type { Context } from "#context"` or `import { apiKeyInput } from "#v1/api-key/input"`, and the single `#*` mapping SHALL resolve it to `./src/context.ts` or `./src/v1/api-key/input.ts`

#### Scenario: Directory index in db

- **WHEN** `packages/db/src/schema/index.ts` re-exports a schema folder
- **THEN** it SHALL use `export * from "#schema/auth"`, which resolves to `./src/schema/auth/index.ts`

#### Scenario: Same resolution in every tool

- **WHEN** a package is type-checked with `tsc`, run with Bun, bundled by tsdown for the backend image, or bundled by Vite for the frontend
- **THEN** every `#` import SHALL resolve without bundler plugins or extra configuration

### Requirement: Apps resolve internal modules with the @/ alias

`apps/backend` and `apps/frontend` SHALL map `@/*` to `./src/*` through `compilerOptions.paths` in their `tsconfig.json`; the frontend SHALL also declare the same alias in `vite.resolve.alias` in `astro.config.mjs`. The `@/` alias SHALL only be used for files inside the same app and SHALL never be used by shared packages.

#### Scenario: App-internal import

- **WHEN** a frontend component needs a shared layout component
- **THEN** it SHALL import it as `import { PageShell } from "@/components/shared/layout/page-shell"`

#### Scenario: Backend router import

- **WHEN** `apps/backend/src/index.ts` mounts the RPC router
- **THEN** it SHALL import it as `import rpcRouter from "@/routers/rpc"`

### Requirement: Workspaces import only declared dependencies

The root `bunfig.toml` SHALL set `linker = "isolated"`, so a workspace can only import packages listed in its own `package.json`. A dependency declared by two or more workspaces SHALL be pinned once in the root `workspaces.catalog` and referenced as `catalog:` by each of them; workspace packages SHALL be referenced as `workspace:*`.

#### Scenario: Undeclared dependency

- **WHEN** a workspace imports a package that only another workspace declares
- **THEN** resolution SHALL fail until the importing workspace declares the dependency itself

#### Scenario: Shared version

- **WHEN** `zod` is used by `@nonete/api`, `@nonete/env` and `frontend`
- **THEN** each of them SHALL declare `"zod": "catalog:"` and the version SHALL live only in the root catalog

### Requirement: New workspaces are registered in every image

Adding a Bun workspace SHALL include adding its `package.json` `COPY` line to `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` and their `Dockerfile.dev` counterparts, because `bun install --frozen-lockfile` rejects an install where a workspace manifest is missing.

#### Scenario: Missing manifest in an image

- **WHEN** a new package is added to `packages/` without its `COPY` line in the Dockerfiles
- **THEN** the image build SHALL fail at the install step, and adding the line SHALL fix it
