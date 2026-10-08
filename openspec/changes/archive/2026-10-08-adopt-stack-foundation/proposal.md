## Why

`better` es el andamiaje genérico de Better-T-Stack (apps `web`/`server`, varlock, evlog, Dockerfiles de un solo stage sin modo dev). El proyecto de referencia `/opt/dev/stack` ya resolvió todo lo que este repo necesita para arrancar en serio: frontend Astro + React con shadcn y un sistema de componentes, backend Hono + oRPC versionado, Better Auth con admin/organizaciones/API keys, crons, logging estructurado, un único `.env` y Docker para desarrollo y producción detrás de un gateway. Traerlo ahora, antes de que exista código de producto, evita divergir y tener que migrar más tarde.

## What Changes

- **BREAKING** Renombrar `apps/web` → `apps/frontend` y `apps/server` → `apps/backend`, dejándolas prácticamente idénticas a las de `stack` (estructura, configuración, middlewares, routers, layouts, features).
- **BREAKING** Renombrar el scope de los packages de `@better/*` a `@nonete/*`, el mismo que usa `stack`, y adoptar su convención de imports: `@nonete/<pkg>` entre workspaces, subpath imports `#…` (campo `imports` del `package.json`) dentro de cada package y `@/…` dentro de cada app.
- **BREAKING** Sustituir varlock y evlog por los packages de `stack`: `@nonete/env` (t3-env + zod, un único `.env` en la raíz) y `@nonete/logger` (pino + pino-pretty, envío opcional a Loki). Se eliminan los `.env.schema` por app, `env.ts` generados, `bts.jsonc` y el addon evlog.
- **BREAKING** Reestructurar `@nonete/api` como en `stack`: `context.ts`, `errors.ts` y builders en la raíz, routers versionados en `src/v1/<feature>/{input,output,handler,router}.ts`, montados como `v1` (`/rpc/v1/...`, `/api/v1/...`). Se actualiza oRPC a la línea 2.0 beta que usa `stack`.
- **BREAKING** `@nonete/auth` y `@nonete/db` pasan a exponer instancias singleton (`auth`, `db`) configuradas desde `@nonete/env`, con los plugins admin, organization (teams + control de acceso dinámico), api-key y OIDC genérico opcional; seed del admin y migraciones al arrancar.
- Nuevo package `@nonete/cron` (scheduler en proceso, jobs declarados en código y manuales, ejecución con impersonación del usuario) y su feature de API/UI.
- Features de API y frontend traídas de `stack`: health, private, auth-config, api-key, organization, plugins, session-history, logs (activity log vía Loki), cron, collection (favoritos y colecciones), comment y entity-icon.
- Frontend: shadcn (`components.json`, estilo `base-nova`, Base UI), `components/ui`, `components/shared`, hooks, `lib`, providers de TanStack Query, layouts (`Layout`, `WithSidebar`, `Detail`, `Admin`), app-shell (navbar autenticada/invitado, sidebar, búsqueda de superficies), tema claro/oscuro/sistema, tipografía y estilos globales, páginas de login, signup, home, perfil, configuración, admin, crons y colecciones, y PWA (manifest, service worker, iconos).
- Docker: `Dockerfile` (producción, multi-stage, bundle sin `node_modules`) y `Dockerfile.dev` (hot reload) por app; `compose.yml`, `compose.dev.yml` (con `docker compose watch`) y `compose.prod.yml` (imágenes de registry, Postgres, Loki); `apps/gateway` con Caddy (solo el sitio HTTP, sin router gRPC); `.dockerignore`; scripts `setup-dev.sh` y `bootstrap.sh`; workflow de CI que construye las imágenes.
- Skills de agente traídas de `stack`: la skill `stack` reescrita para este repo (sin worker, deepagents, gRPC, proto, site, pickers ni stories) y las skills de terceros que aplican a este stack (astro, bun, drizzle, orpc, shadcn, tailwind, react, better-auth, zod, impeccable…); se descartan las del agente (langchain, langgraph, deepagents), las de playwright y las de evlog.
- Configuración raíz alineada con `stack`: `package.json` (catálogo, scripts), `turbo.json`, `biome.json` (2 espacios, sin punto y coma), `bunfig.toml` (linker aislado), `tsconfig`, `.env.example`, `.gitignore`, contexto de `openspec/config.yaml` y `AGENTS.md`/`CLAUDE.md`.
- Fuera de alcance (no se traen): `apps/worker`, `apps/deepagents`, `apps/site`, `packages/grpc`, `packages/pick`, `proto/`, `python/`, el servidor gRPC del backend, las features `agent`, `grpc-demo`, `mcp` y `frontend-routes` (y la ruta `/meta`), el chat/asistente del frontend, Ladle (stories) y Playwright.

## Capabilities

### New Capabilities

- `environment-configuration`: un único `.env` en la raíz validado por `@nonete/env`, `.env.example` como documentación y scripts que lo generan.
- `structured-logging`: logger pino compartido, logs por petición con request id, formato JSON en producción y envío opcional a Loki.
- `http-server`: backend Hono sobre Bun con CORS, sesión, logger de peticiones, handlers RPC/OpenAPI endurecidos y apagado ordenado.
- `http-gateway`: Caddy como único punto de entrada HTTP que sirve backend y frontend en el mismo origen.
- `docker-dev-environment`: stack de desarrollo en Docker con hot reload vía `docker compose watch`, coexistiendo con el modo nativo.
- `docker-production-deployment`: imágenes de producción multi-stage, `compose.prod.yml`, CI de imágenes y bootstrap del despliegue.
- `authentication`: Better Auth con email/contraseña, OIDC opcional, cookies seguras, seed del admin y protección de rutas del frontend.
- `rpc-api`: API oRPC versionada con convención por feature, errores tipados y lecturas por método `QUERY`.
- `api-documentation`: OpenAPI y Scalar generados desde el router, solo para administradores.
- `api-key-management`: gestión de API keys de Better Auth y autenticación por `x-api-key`.
- `admin`: panel de administración (usuarios, sesiones, plugins, resumen).
- `organization-management`: organizaciones, miembros y equipos desde el admin.
- `organization-access-control`: roles y permisos de organización con control de acceso dinámico.
- `activity-log`: registro de llamadas a la API y vistas de página consultable desde el admin.
- `cron-management`: CRUD de crons, historial de ejecuciones y seguimiento en vivo.
- `cron-scheduling`: scheduler en proceso, jobs declarados en código y ejecución como usuario.
- `collections`: favoritos y colecciones personalizadas de recursos.
- `comments`: hilos de comentarios sobre recursos.
- `entity-icons`: iconos y colores personalizables por entidad con catálogo generado.
- `keyset-pagination`: paginación por cursor compartida en DB y API.
- `list-filter-experience`: listas con búsqueda, filtros, chips y scroll infinito.
- `unit-testing`: tests unitarios con `bun test` en `@nonete/api`.
- `workspace-module-resolution`: scope `@nonete/*`, subpath imports `#…` en packages, alias `@/…` en apps y reglas de dependencias del monorepo.
- `frontend-code-organization`: convención de features por dominio/slice y límites de importación.
- `frontend-component-system`: shadcn + Base UI, `components/ui` y `components/shared`, tipografía y tokens de diseño.
- `theme-switching`: tema claro, oscuro y sistema sin parpadeo entre navegaciones.
- `web-navigation`: navbar, sidebar, layouts, búsqueda de superficies y transiciones de vista.
- `pwa`: manifest, iconos y service worker instalables.

### Modified Capabilities

Ninguna: `openspec/specs/` está vacío en este repo.

## Impact

- Código: se reemplazan por completo `apps/web`, `apps/server`, `packages/api`, `packages/auth`, `packages/db`; se crean `apps/frontend`, `apps/backend`, `apps/gateway`, `packages/env`, `packages/logger`, `packages/cron`; todos los packages pasan al scope `@nonete/*`.
- Base de datos: nuevo esquema (auth con plugins admin/organization/api-key, cron, collection, comment, entity-icon) y migraciones regeneradas desde cero; el esquema actual se descarta (no hay datos que conservar).
- Dependencias: se eliminan `varlock`, `@varlock/astro-integration` y `evlog`; se añaden pino, t3-env, dotenv, React 19, TanStack Query, shadcn/Base UI, lucide, sonner, date-fns, etc.; oRPC sube a 2.0 beta y Bun a la versión de `stack`.
- Infraestructura: los comandos cambian (`bun run dev` arranca Docker dev; `bun run dev:local` el modo nativo); los puertos pasan a frontend `4321`, backend `3000` y gateway como único puerto publicado.
- Skills/docs: se eliminan las skills de evlog; se añaden la skill `stack` adaptada y las skills de terceros relevantes en `.agents/skills` (enlazadas desde `.claude/skills` y registradas en `skills-lock.json`); se actualizan README, `AGENTS.md`/`CLAUDE.md` y el contexto de OpenSpec.
- Imports: todo el código que hoy importa `@better/*` pasa a `@nonete/*` (se reescribe igualmente al copiarse desde `stack`).
