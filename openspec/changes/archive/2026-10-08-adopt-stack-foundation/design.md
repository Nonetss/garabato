## Context

`better` se generó con Better-T-Stack (`bts.jsonc`): `apps/web` (Astro, Tailwind, sin React), `apps/server` (Hono + oRPC 1.x), `packages/{api,auth,db,config}` con factorías (`createDb(env)`, `createAuth(env, db)`), varlock para env (un `.env.schema` por workspace + `env.ts` generado) y evlog para logs. Docker se limita a un `docker-compose.yml` con Dockerfiles de un solo stage que copian el repo entero y usan BuildKit secrets.

`/opt/dev/stack` es el proyecto de referencia del mismo autor, ya maduro: `apps/frontend`, `apps/backend`, `apps/gateway` (Caddy), `packages/{api,auth,cron,db,env,logger,config}` más piezas que aquí no interesan (worker y deepagents en Python, gRPC, picker CLI, site de docs). Tiene 34 specs en `openspec/specs/` y una convención de código documentada en su `openspec/config.yaml`.

El usuario quiere que las apps de `better` queden "prácticamente iguales" a las de `stack`, con todas las features salvo las del agente/worker, incluidos los crons, el gateway Caddy y la PWA. El repo solo tiene el commit inicial: no hay datos ni código de producto que preservar.

## Goals / Non-Goals

**Goals:**

- `apps/frontend` y `apps/backend` copiadas de `stack` con el mínimo de diferencias: mismo scope `@nonete/*`, marca "Better", y la eliminación de lo que depende del agente/gRPC.
- La misma convención de imports que `stack`: `@nonete/<pkg>` entre workspaces, `#…` (subpath imports) dentro de cada package y `@/…` dentro de cada app.
- Las skills de agente de `stack` que aplican a este repo, incluida la skill `stack` adaptada.
- Los packages compartidos (`env`, `logger`, `api`, `auth`, `db`, `cron`, `config`) con la misma API pública que en `stack`, para que copiar código futuro entre ambos repos sea trivial.
- shadcn instalado y configurado igual que en `stack` (`components.json`, `components/ui`, `cn`).
- Docker de desarrollo (`Dockerfile.dev` + `compose.dev.yml` con watch) y de producción (`Dockerfile` multi-stage + `compose.prod.yml` + CI + bootstrap) funcionando de extremo a extremo.
- Configuración raíz (turbo, biome, bunfig, tsconfig, catálogo, scripts, `.env.example`) y la convención de OpenSpec/agentes alineadas con `stack`.

**Non-Goals:**

- `apps/worker`, `apps/deepagents`, `apps/site`, `packages/grpc`, `packages/pick`, `proto/`, `python/`.
- Servidor gRPC del backend, router gRPC del gateway (`:50050`), `SERVICE_TOKEN`, `GRPC_TARGET`.
- Features `agent`, `grpc-demo`, `mcp`, `frontend-routes`; ruta `/meta/routes.json`; chat y widget del asistente; tabla `agent_thread`.
- Ladle (stories) y Playwright (e2e). Se pueden añadir después como changes propios.
- Rediseñar nada: si algo de `stack` tiene un defecto, se copia tal cual salvo que bloquee el build; las mejoras van en changes posteriores.

## Decisions

### 1. Copiar desde `stack` y recortar, en vez de reconstruir sobre `better`

Se copian los árboles `apps/frontend`, `apps/backend`, `apps/gateway` y los packages, se conserva el scope `@nonete/*` (decisión del usuario: los imports entre repos quedan idénticos) y se eliminan los módulos excluidos siguiendo el grafo de imports hasta que `check-types` pase. Los ficheros actuales de `apps/web`, `apps/server` y de los packages se borran.

*Alternativa:* adaptar incrementalmente el código de Better-T-Stack. Descartada: el usuario pide apps casi idénticas, y casi todos los ficheros acabarían reescritos igualmente, con más riesgo de divergencias sutiles.

### 2. `@nonete/env` + `@nonete/logger` en lugar de varlock + evlog

Decidido con el usuario. `@nonete/env/server` (t3-env + zod, lee `../../.env` desde el cwd del workspace) y `@nonete/env/web`; `@nonete/logger` con pino, `pino-pretty` en desarrollo, JSON en producción y stream opcional a Loki. El backend usa `@orpc/pino` para enlazar el logger de petición con los errores de procedimientos. Desaparecen `.env.schema`, los `env.ts` generados, el `postinstall`/`env:generate` de varlock, `bts.jsonc` y las dependencias `varlock`, `@varlock/astro-integration` y `evlog`.

Consecuencia: las skills de evlog instaladas (`analyze-logs`, `build-audit-logs`, `review-logging-patterns`) dejan de aplicar; se eliminan de `skills-lock.json`, `.agents/skills` y `.claude/skills`.

*Alternativa:* conservar varlock/evlog adaptando el código. Descartada por el usuario; además, `env` y `logger` son dependencias de casi todos los packages de `stack`.

### 3. Singletons en `@nonete/db` y `@nonete/auth`

Se adopta el patrón de `stack`: `db` y `auth` se instancian al importar el módulo a partir de `@nonete/env/server`. El backend, el scheduler y los tests importan las instancias. Se pierde la inyección por parámetro de Better-T-Stack, pero es lo que hace posible que `packages/api` importe `auth` directamente y que `@nonete/cron` reciba `db` sin cableado extra.

### 4. Sin gRPC: el backend es solo HTTP

Se elimina `apps/backend/src/grpc/**` y las partes de `index.ts` que arrancan/paran el servidor gRPC y cierran clientes. El apagado ordenado queda: eventos de cron → HTTP → scheduler → pool de DB. El Caddyfile conserva solo el sitio HTTP (`:{$GATEWAY_HTTP_PORT:80}`); su healthcheck pasa a una ruta `/health` servida por ese sitio (antes vivía en `:50050`). `SERVICE_TOKEN`, `GRPC_TARGET`, `FRONTEND_URL` (solo lo usaba `frontend-routes`) y las variables de upstream gRPC salen de `@nonete/env` y de `.env.example`.

### 5. Schema de DB y migraciones desde cero

Se copian los esquemas `auth`, `collection`, `comment`, `cron` y `entity-icon` (sin `agent`, y sin la relación `agentThreads` en `relations.ts`) y se borran las migraciones de ambos repos para generar una migración inicial nueva con `drizzle-kit generate`. Copiar las migraciones de `stack` arrastraría la creación y posterior borrado de `agent_thread` y snapshots con referencias a esa tabla. `runMigrations()` al arrancar y el seed del admin se mantienen.

### 6. Frontend: Astro + React islands, shadcn `base-nova`

Se copia `components.json` tal cual (estilo `base-nova` sobre `@base-ui/react`, `baseColor: neutral`, iconos lucide, alias `@/…`) junto con los 41 componentes de `components/ui` ya generados y personalizados en `stack`, en vez de ejecutar `shadcn init` y regenerarlos: varios están modificados (p. ej. `cn` con roles tipográficos, `confirm-dialog`, `searchable-combobox`, `message`) y regenerarlos perdería esos cambios. `shadcn` queda como devDependency para `shadcn add` futuros.

Se eliminan los `stories/` de `components/**` y `features/**`, `.ladle/`, `playwright.config.ts`, `tests/`, las dependencias `@ladle/react`, `@playwright/test`, `pg`/`@types/pg` (solo las usaba el helper e2e) y las dependencias exclusivas del chat (`react-markdown`, `remark-*`, `rehype-katex`, `katex`, `@tanstack/highlight`) si tras borrar `features/chat` no queda ningún consumidor. En `Layout.astro`, `Admin.astro`, `app-surfaces.ts` e `icon-registry.ts` se quitan las entradas del chat/agente (incluido el campo `agentDescription`, cuyo único consumidor era `/meta/routes.json`).

### 7. Gateway como origen único también en desarrollo

El frontend llama a `/rpc` y `/api/auth` con rutas relativas. En producción Caddy enruta por path; en desarrollo nativo el proxy de Vite (`astro.config.mjs`) hace lo mismo, por lo que el gateway es opcional en local (`bun run gateway`). Se eliminan `PUBLIC_SERVER_URL` como origen del cliente y el `SERVER_URL` de SSR de Better-T-Stack; el SSR usa `BACKEND_URL`.

### 8. Postgres en el stack de desarrollo

`stack` asume un Postgres ya disponible en `localhost:5432`. `better` hoy lo levanta con `bun run db:start`. Se mantiene esa comodidad: `compose.dev.yml` incluye un servicio `db` (postgres:17, red host, DB `better`, volumen persistente) y los scripts `db:start`/`db:stop`/`db:down` apuntan a él. `compose.yml` (prod en local, imágenes construidas desde el repo) también incluye `db` para que `bun run docker:up` funcione sin dependencias externas.

### 9. Docker e imágenes

Se copian los Dockerfiles de `stack` con dos ajustes: la lista de `COPY <workspace>/package.json` refleja los workspaces de `better` (`apps/{backend,frontend}`, `packages/{api,auth,config,cron,db,env,logger}`), y el backend no ejecuta `generate-grpc`. Las imágenes de producción se publican como `better-{backend,frontend,gateway}` en el mismo registry que `stack` mediante el workflow de CI adaptado (matriz solo con esas tres imágenes y la rama `main`). `scripts/bootstrap.sh` y `scripts/setup-dev.sh` se adaptan quitando las preguntas de Anthropic/Jev y los secretos de servicio.

### 10. Versiones alineadas con `stack`

Se adopta el catálogo de `stack`: oRPC `2.0.0-beta.42` (incluye `@orpc/contract`, `json-schema`, `pino`, `publisher`, `tanstack-query`), `better-auth` y `@better-auth/{api-key,core}` en la misma versión con `overrides` para `@better-auth/core`, Astro 7.3.2, Tailwind 4.3, zod 4.6, TypeScript 6, Bun `1.4.2` en `packageManager` y en los `ARG BUN_VERSION`. Biome pasa a la configuración de `stack` (2 espacios, sin punto y coma, comillas dobles, `useImportType`). Se mantiene `bunfig.toml` con `linker = "isolated"`.

### 11. Scope `@nonete/*` y convención de imports `@` / `#`

Decidido con el usuario: los packages se siguen llamando `@nonete/{api,auth,config,cron,db,env,logger}`, igual que en `stack`, para que el código se pueda mover entre ambos repos sin reescribir imports. El cambio afecta al scope actual `@better/*`, y la raíz del monorepo pasa a llamarse según el nombre del proyecto (`better`).

Se copian los dos esquemas de alias de `stack`:

- **Apps** (`apps/backend`, `apps/frontend`): `@/*` → `./src/*` mediante `paths` en `tsconfig.json` (y alias de Vite en el frontend). Solo dentro de la app, nunca entre packages. El alias `@test/*` del frontend desaparece junto con Playwright.
- **Packages compartidos**: subpath imports de Node con el prefijo `#`, declarados en el campo `imports` del `package.json` de cada package: `"#*": "./src/*.ts"` en `api`, `cron` y `logger`; en `db`, entradas explícitas `#schema`, `#schema/*` (→ `./src/schema/*/index.ts`), `#seed` y `#seed/*` antes del comodín; en `auth`, `#auth/*` (con su `paths` en tsconfig). `env` y `config` no usan alias. No se usa `@/` en packages porque exportan TS sin compilar consumido por otros workspaces, y colisionaría.
- **Entre workspaces**: siempre el nombre del package (`@nonete/db`, `@nonete/api/v1/cron/events`), declarado en las dependencias del consumidor (con `linker = "isolated"`, un workspace solo puede importar lo que declara). Las dependencias usadas por dos o más workspaces van como `catalog:`.

*Alternativa:* `paths` de tsconfig también en los packages. Descartada: los subpath imports se resuelven igual en tsc, Bun, Vite y rolldown sin plugins, y son por package.

### 12. Skills de agente y convenciones de OpenSpec

Se traen las skills de `stack` que afectan a este repo:

- **Skill `stack`** (`.agents/skills/stack`, enlazada desde `.claude/skills/stack`), reescrita para `better`: diagrama mental sin worker, deepagents ni router gRPC; `workspaces.md`, `commands.md`, `env.md`, `docker.md`, `aliases-and-deps.md`, `testing.md` y `code-style.md` alineados con los workspaces, comandos y variables reales; `api/*`, `frontend/*` (salvo `stories.md`) y `cron-and-mcp/cron.md` (renombrada a `cron.md`). Se eliminan `proto.md`, `site.md`, `pickers.md`, `frontend/stories.md` y `cron-and-mcp/mcp.md`, y todas las referencias a ellas desde `SKILL.md`.
- **Skills de terceros** relevantes para Astro + React + Hono + oRPC + Better Auth + Drizzle + Tailwind/shadcn + Bun: `accessibility`, `astro`, `bash-defensive-patterns`, `best-practices`, `bun`, `composition-patterns`, `drizzle`, `emailAndPassword`, `frontend-design`, `organization`, `orpc`, `orpc-contract`, `orpc-migrate`, `orpc-openapi`, `react-best-practices`, `seo`, `shadcn`, `tailwind-css-patterns`, `tailwind-v4-shadcn`, `twoFactor`, `typescript-advanced-types`, `zod`, `impeccable` (con `.impeccable/` y `DESIGN.md`, porque el sistema visual del frontend es el mismo). Se mantienen las que ya hay (`turborepo`, `hono`, `better-auth-*`, `email-and-password-best-practices`) y se registran todas en `skills-lock.json`. Como en `stack`, solo se versionan la skill `stack` y las de OpenSpec: el resto de `.agents/skills/*` y `.claude/skills/*` va al `.gitignore` (`impeccable` sola son 3,5 MB de scripts) y se reinstala desde `skills-lock.json`.
- **No se traen**: `deep-agents-*`, `deepagents-*`, `langchain-*`, `langgraph-*`, `langsmith-*`, `managed-deep-agents`, `ecosystem-primer`, `eval-engineering`, `swarm` (son del agente) ni `playwright-best-practices` (sin e2e). Se eliminan las de evlog (decisión 2).

También se trae el bloque `context` de `stack/openspec/config.yaml` (convención de features del frontend, de la API y estilo de TypeScript) sin las menciones a MCP/stories, junto con `AGENTS.md`/`CLAUDE.md` adaptados y los comandos `.claude/commands/{commit,tag,worktree}.md`.

## Risks / Trade-offs

- [El recorte deja imports colgando hacia módulos eliminados] → Borrar por grafo de imports y usar `bun run check-types` (tsc + `astro check`) como puerta tras cada bloque de tareas; `rg 'grpc|deepagents|SERVICE_TOKEN|features/chat|mcpMeta'` debe quedar vacío salvo falsos positivos (`userAgent`).
- [oRPC 2.0 es beta] → Es la versión que ya corre en `stack`; fijarla exacta en el catálogo evita saltos implícitos.
- [Bun 1.4.2 puede no estar instalado en local] → Documentar en el README; las imágenes Docker ya fijan la versión.
- [Copiar 500+ ficheros del frontend arrastra deuda de `stack`] → Aceptado a cambio de mantener ambos repos sincronizables; cualquier refactor se hace en changes posteriores.
- [Migración inicial regenerada difiere de la de `stack`] → Ningún entorno de `better` tiene datos; se documenta que `better` no comparte historial de migraciones con `stack`.
- [El seed del admin y los crons declarados en código dependen de `ADMIN_EMAIL`] → `setup-dev.sh` y `bootstrap.sh` lo rellenan; el scheduler ya avisa en logs si falta.
- [La PWA cachea assets y puede servir versiones viejas tras un deploy] → Se copia el `sw.js` de `stack` tal cual; revisar su estrategia de caché es trabajo aparte.

## Migration Plan

1. Rama de trabajo desde `master`. Copiar raíz, packages y apps; renombrar scope; recortar exclusiones.
2. `bun install`, generar migración inicial, `bun run check-types` y `bun run build` en verde.
3. Validar desarrollo nativo (`bun run db:start`, `bun run dev:local`, login con el admin sembrado) y en Docker (`bun run dev`).
4. Validar producción en local (`bun run docker:up`, acceso por el puerto del gateway) y la build de las tres imágenes.
5. Rollback: el cambio vive en una rama; descartarla devuelve el repo al andamiaje de Better-T-Stack.

## Open Questions

- Registry y nombre de imágenes: se asume el registry de `stack` con imágenes `better-*` y CI en Gitea Actions con runner `amd64` como en `stack`. Confirmar antes de activar el workflow.
- Rama por defecto: el repo está en `master` y el contexto indica `main` para PRs; el workflow de CI se configura para `main`.
- Marca/logo: se reutilizan temporalmente los assets de `stack` (logo, iconos PWA, `theme-color`) con el nombre "Better" hasta que haya identidad propia.
