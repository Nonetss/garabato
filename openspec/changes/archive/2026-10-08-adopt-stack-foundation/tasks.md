## 1. Preparación

- [x] 1.1 Crear una rama de trabajo desde `master` y confirmar que `/opt/dev/stack` está en el commit de referencia (anotar el hash en el PR)
- [x] 1.2 Eliminar el andamiaje de Better-T-Stack que se sustituye: `apps/web`, `apps/server`, `packages/api`, `packages/auth`, `packages/db`, `docker-compose.yml`, `bts.jsonc` y todos los `.env.schema` y `env.ts` generados por varlock

## 2. Configuración raíz

- [x] 2.1 Reemplazar el `package.json` raíz por el de `stack`: nombre `better`, workspaces `apps/*` y `packages/*`, catálogo con las versiones de `stack` (oRPC 2.0 beta, better-auth, Astro, Tailwind, pino, fuentes…), `overrides` de `@better-auth/core`, `packageManager: bun@1.4.2` y scripts sin worker, deepagents, gRPC, pickers, stories, site ni e2e; añadir `db:start`/`db:stop`/`db:down` contra el servicio `db` de `compose.dev.yml`
- [x] 2.2 Copiar `turbo.json` de `stack` sin las tareas y dependencias `generate-grpc`, `deepagents#*`, `worker#*`, `@nonete/grpc#*`, `stories*` ni `test:e2e*`
- [x] 2.3 Copiar `biome.json`, `bunfig.toml` (linker aislado) y `tsconfig.json` de `stack`, y `packages/config` (`@nonete/config` con `tsconfig.base.json`)
- [x] 2.4 Copiar `.gitignore` y `.dockerignore` de `stack` quitando las entradas de Python
- [x] 2.5 Escribir `.env.example` a partir del de `stack` con solo las variables de la spec `environment-configuration` (sin SERVICE_TOKEN, GRPC_TARGET, FRONTEND_URL, LLM, TypeSafe ni tracing) y con `DATABASE_URL` apuntando a la DB `better`
- [x] 2.6 Copiar `scripts/setup-dev.sh` adaptado (sin secretos de servicio ni claves de LLM)

## 3. Packages base: env, logger, db

- [x] 3.1 Copiar `packages/env` (`@nonete/env`) y quitar `FRONTEND_URL`, `SERVICE_TOKEN` y `GRPC_TARGET` de `src/server.ts`
- [x] 3.2 Copiar `packages/logger` (`@nonete/logger`) con `factory.ts` y `loki-stream.ts`; nombre de servicio por defecto `better-backend`
- [x] 3.3 Copiar `packages/db` (`@nonete/db`) con su campo `imports` (`#schema`, `#schema/*`, `#seed`, `#seed/*`, `#*`), `drizzle.config.ts`, `keyset-pagination.ts`, seed (`admin.ts`, `migrate.ts`) y los esquemas `auth`, `collection`, `comment`, `cron` y `entity-icon`; no copiar `schema/agent` y quitar `agentThreads`/`agentThread` de `relations.ts` y de `schema/index.ts`
- [x] 3.4 Con Postgres levantado (`bun run db:start`), borrar cualquier migración previa y generar la migración inicial con `bun run db:generate`; comprobar que no contiene `agent_thread`

## 4. Packages de dominio: auth, cron, api

- [x] 4.1 Copiar `packages/auth` (`@nonete/auth`, `#auth/*` en `imports` y en `paths`) con `index.ts`, `oauth.ts`, `permissions.ts` y `session.ts`
- [x] 4.2 Copiar `packages/cron` (`@nonete/cron`) completo
- [x] 4.3 Copiar `packages/api` (`@nonete/api`, `"#*": "./src/*.ts"`) con `context.ts`, `errors.ts`, `index.ts`, `router.ts`, `lib/`, `shared/` y los features v1 health, private, auth-config, api-key, organization, plugins, session-history, logs, cron, collection, comment y entity-icon
- [x] 4.4 No copiar los features `agent`, `grpc-demo`, `mcp` ni `frontend-routes`; quitarlos de `src/v1/router.ts`, eliminar `mcpMeta()` y la discovery de MCP de `shared/procedure-docs.ts` y de los routers que lo usan, y quitar `@nonete/grpc` de las dependencias
- [x] 4.5 Copiar `packages/api/tests` sin los tests de features excluidos y ajustar `tests/setup.ts` a las variables de env que quedan
- [x] 4.6 Ejecutar `bun install` y `bun run check-types` filtrado a los packages; corregir hasta que pasen

## 5. Backend (`apps/backend`)

- [x] 5.1 Copiar `apps/backend` de `stack` (package `backend`, `@/*` en tsconfig, `tsdown.config.ts`, `turbo.json`, `middlewares/`, `routers/`, `cron/`)
- [x] 5.2 Eliminar `src/grpc/**` y en `src/index.ts` el arranque y parada del servidor gRPC y `closeClients()`; el apagado queda: eventos de cron → HTTP → scheduler → DB
- [x] 5.3 Cambiar el título de OpenAPI a "Better API" en `routers/docs.ts` y quitar `/rpc/v1/mcp` u otras rutas excluidas de la lista del logger de actividad si aparecen
- [x] 5.4 Verificar con `bun run dev:backend` contra la DB local: `GET /` responde `OK`, se aplican migraciones, se siembra el admin de `ADMIN_EMAIL` y arranca el scheduler sin errores

## 6. Frontend: base, shadcn y estilos

- [x] 6.1 Copiar `apps/frontend` de `stack`: `package.json` (sin Ladle, Playwright, `pg`), `astro.config.mjs` (sin `SERVICE_TOKEN` en el esquema de env ni el alias `@test`), `tsconfig.json` (sin `@test/*`), `components.json` y `public/` (logo, PWA, `sw.js`, `manifest.webmanifest` con nombre "Better")
- [x] 6.2 Copiar `src/components/ui` (componentes shadcn `base-nova`), `src/components/shared`, `src/hooks`, `src/lib`, `src/providers`, `src/styles` (`global.css`, `typeset.css`) y `src/assets`
- [x] 6.3 Eliminar todas las carpetas `stories/`, `.ladle/`, `playwright.config.ts` y `tests/`
- [x] 6.4 Comprobar que `bunx shadcn add <componente>` funciona con `components.json` (añadir y descartar un componente de prueba)

## 7. Frontend: layouts, middleware, features y páginas

- [x] 7.1 Copiar `src/layouts` y `src/middleware.ts`; quitar del middleware la ruta interna `/meta` y la comprobación de `SERVICE_TOKEN`
- [x] 7.2 Quitar de `Layout.astro` y `Admin.astro` `AssistantRestore`, `AssistantWidget` y su contenedor; usar "BETTER" como `nameApp`
- [x] 7.3 Copiar `src/features` sin `chat`: admin, app-shell, auth, collections, comments, config, crons, entity-icons, home y profile; incluir `scripts/generate-icon-catalog.ts`
- [x] 7.4 Quitar la superficie `chat`, el campo `agentDescription` y los textos que mencionan al agente de `lib/app-surfaces.ts`; quitar las entradas `chat`/`agent` de `lib/icon-registry.ts` y de `lib/site-nav.ts` si aparecen
- [x] 7.5 Copiar `src/pages` sin `chat/` ni `meta/`: index, 404, login, signup, me, config, admin/*, crons/*, collections/* y `logo.svg.ts`
- [x] 7.6 Eliminar las dependencias que solo usaba el chat (`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `katex`, `@tanstack/highlight`) si ya no las importa nada, y sus `@import` en `global.css`
- [x] 7.7 Ejecutar `bun run check-types` (incluye `astro check`) y `bun run build` hasta que pasen; `rg 'grpc|deepagents|SERVICE_TOKEN|features/chat|mcpMeta|@better/'` en `apps/` y `packages/` debe quedar vacío

## 8. Gateway y Docker de desarrollo

- [x] 8.1 Copiar `apps/gateway` (Caddyfile, Dockerfile, compose.yml) conservando solo el sitio HTTP y añadiendo `handle /health` en ese sitio; quitar el puerto 50050 y los upstreams gRPC
- [x] 8.2 Copiar `apps/backend/Dockerfile.dev` y `apps/frontend/Dockerfile.dev` con `COPY` solo de los workspaces de este repo y sin `generate-grpc`
- [x] 8.3 Escribir `compose.dev.yml` (proyecto `better-dev`) con frontend, backend, gateway (`GATEWAY_HTTP_PORT=8080`) y `db` (postgres:17, red host, volumen), con las reglas de `develop.watch` de `stack` limitadas a los packages existentes
- [x] 8.4 Verificar `bun run dev`: editar un fichero de `apps/frontend/src` y de `packages/api/src` recarga sin reconstruir la imagen; `bun run dev:down` limpia

## 9. Docker de producción y despliegue

- [x] 9.1 Copiar `apps/backend/Dockerfile` y `apps/frontend/Dockerfile` (multi-stage, `BUN_VERSION=1.4.2`, install con manifiestos primero, runtime sin `node_modules`, migraciones en la imagen del backend) con los `COPY` de los workspaces de este repo
- [x] 9.2 Escribir `compose.yml` (proyecto `better`, construido desde el repo) con frontend, backend, gateway, db y loki, y `compose.prod.yml` con imágenes `better-{frontend,backend,gateway}:main` del registry, `db`, `loki`, red `better`, healthchecks y `FRONTEND_PORT`
- [x] 9.3 Copiar `.github/workflows/docker-build.yml` con la matriz reducida a backend, frontend y gateway y la rama `main`
- [x] 9.4 Copiar `scripts/bootstrap.sh` apuntando al repo de `better`, sin preguntas de Anthropic/Jev ni `SERVICE_TOKEN`
- [x] 9.5 Verificar `bun run docker:up`: los tres servicios de la app quedan healthy, solo el gateway publica puerto, el login funciona por el gateway y `/scalar` responde solo a admins

## 10. Skills, convenciones y documentación

- [x] 10.1 Copiar `.agents/skills/stack` y reescribir `SKILL.md` y sus referencias para `better` (sin worker, deepagents, gRPC, proto, site, pickers, stories ni MCP; `cron-and-mcp/cron.md` → `cron.md`); enlazarla en `.claude/skills/stack`
- [x] 10.2 Copiar las skills de terceros listadas en el design (astro, bun, drizzle, orpc*, shadcn, tailwind-*, react-best-practices, composition-patterns, zod, impeccable, etc.), enlazarlas en `.claude/skills`, registrarlas en `skills-lock.json` y dejarlas fuera de git vía `.gitignore` (solo se versionan `stack` y las de OpenSpec)
- [x] 10.3 Eliminar las skills de evlog (`analyze-logs`, `build-audit-logs`, `review-logging-patterns`) de `.agents/skills`, `.claude/skills` y `skills-lock.json`
- [x] 10.4 Copiar el bloque `context` de `stack/openspec/config.yaml` a `openspec/config.yaml` sin menciones a MCP ni stories
- [x] 10.5 Escribir `AGENTS.md`/`CLAUDE.md`, `DESIGN.md` y `.impeccable/` adaptados, copiar `.claude/commands/{commit,tag,worktree}.md` y actualizar el `README.md` (requisitos, `setup:dev`, comandos de dev nativo y Docker, despliegue)

## 11. Verificación final

- [x] 11.1 `bun install --frozen-lockfile`, `bun run check`, `bun run check-types`, `bun run test` y `bun run build` en verde desde un checkout limpio
- [x] 11.2 Recorrido manual en dev nativo: signup, login, home, perfil, apariencia (cambio de tema sin parpadeo), admin (usuarios, sesiones, organizaciones, equipos, API keys, plugins, logs), crons (crear, ejecutar y ver el historial en vivo), colecciones, favoritos, comentarios e iconos de entidad
- [x] 11.3 Comprobar que la PWA es instalable (manifest e iconos válidos y service worker registrado)
- [x] 11.4 `openspec validate adopt-stack-foundation` sin errores
