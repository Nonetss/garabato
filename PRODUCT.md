# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

better es un proyecto nuevo arrancado sobre la base de la plantilla personal del usuario (`stack`). Por ahora el único visitante es el propio usuario operando su scaffold: revisando crons, gestionando organizaciones / usuarios / API keys, colecciones y comentarios, y leyendo logs y docs. Cuando el producto tenga usuarios externos, este fichero se actualiza para describirlos.

## Product Purpose

better arranca con el stack ya cableado (Astro + Hono/oRPC + Better Auth + Drizzle/Postgres + OpenSpec + Docker) para que el trabajo de producto empiece con auth, RPC tipado, cron scheduling, colecciones, comentarios y documentación de capacidades ya resueltos. Comparte paquetes (`@nonete/*`), convenciones y sistema visual con `stack`, de modo que el código se pueda mover entre ambos repos sin reescribirlo.

## Operating Context

better se opera como **consola técnica** corriendo en local o en un servidor propio vía Docker Compose. Quien la usa vive en la CLI (`bun run dev`, `bun run dev:local`, `bun run db:generate`, `bun run docker:up`, `openspec validate --strict`) y en el navegador en `localhost:4321` (dev) o en el puerto del gateway (producción). Los artefactos vivos son: páginas Astro en `apps/frontend/src/pages` (404, inicio, admin, collections, config, crons, login, me, signup), la documentación de capacidades en `openspec/specs/` y la guía de estilo visual en `DESIGN.md` (raíz). `BETTER_AUTH_SECRET` y el admin inicial se generan con `scripts/setup-dev.sh`.

## Capabilities and Constraints

Capacidades confirmadas (con spec en `openspec/specs/` una vez archivado el change inicial):

- **Autenticación** con email/password (y OIDC opcional) vía Better Auth, sesiones, roles (admin) y protección por rol en `/admin`.
- **Organizaciones, equipos, miembros e invitaciones** vía el plugin `organization` de Better Auth, con control de acceso dinámico.
- **API keys** como método de autenticación machine-to-machine (`@better-auth/api-key`).
- **Cron scheduling y management** (`/crons`, `/crons/[id]`) con un scheduler en el propio backend que ejecuta procedimientos de la API marcados como elegibles.
- **RPC tipado** vía oRPC en `packages/api`, versionado (`src/<version>/`) por feature.
- **Colecciones y comentarios** sobre cualquier recurso; **iconos de entidad** personalizables.
- **Registro de actividad** (`/admin/logs`) sobre Loki.
- **Documentación HTTP** en `/scalar` y `/openapi.json`, protegida por sesión admin.
- **Tema claro/oscuro/sistema** y **PWA** instalable.
- **Structured logging** con pino.

Restricciones técnicas: Bun 1.4.2 (`bunfig.toml` con `linker = "isolated"`), versiones fijadas en el `workspaces.catalog` raíz, Biome 2.5.13, `apps/backend` construido con `tsdown`, scripts de Drizzle solo en `packages/db`, migraciones aplicadas por el backend al arrancar, un único `.env` en la raíz, `BETTER_AUTH_SECRET` de al menos 32 caracteres.

Producto sin decidir (no inventar): identidad de marca propia (logo, dominio, nombre público). Mientras tanto se reutilizan los assets de `stack` con el nombre "Better".

## Brand Commitments

**Estilo visual "quiet editorial", heredado de `stack`.** Las reglas de `DESIGN.md` son obligaciones vigentes: monocromo con un único acento naranja (`primary`) reservado a icono de hero, CTA principal y punto de estado activo; `destructive` solo para fallos o acciones irreversibles; nunca verde/azul/ámbar semánticos. Tipografía: **Space Grotesk Variable** (UI) y **Space Mono** (código, `tabular-nums`). Anatomía: `PageShell maxWidth="6xl"` para listas, `Detail.astro` para detalle, cabeceras con `PageHero`, listas en `divide-y`, hechos en una franja `border-y` con `<dl>`, estados con `StateCard` y formularios en `FormDialog`. Excepciones: `components/ui/**` (shadcn base), el chrome de `features/app-shell` y los formularios de login/signup.

Voz: consola técnica, clara, sin ornamento.

## Evidence on Hand

- **Capacidades**: specs del change `adopt-stack-foundation` (pasan a `openspec/specs/` al archivarlo).
- **Estilo visual**: `DESIGN.md` (raíz).
- **Estructura**: `README.md` y `AGENTS.md`; la skill `stack` en `.agents/skills/stack`.
- **APIs**: `apps/backend` expone `GET /` (`OK`), `/rpc/<version>/<feature>/<method>`, `/api/<version>/<feature>/<method>`, `/scalar` y `/openapi.json`.
- **Sin clientes externos, sin testimonios, sin métricas** — no fabricar ninguno.

## Product Principles

1. **Specs primero, código después.** Toda capacidad nueva abre un change de OpenSpec antes de tocar código.
2. **Sincronizable con `stack`.** Mismos nombres de paquetes, convenciones e imports, salvo que se decida divergir por escrito.
3. **Calma sobre ornamento.** La jerarquía la llevan el tamaño de tipo, el tracking y `tabular-nums`, no el color.
4. **Cableado, no demo.** Auth con admin, organizaciones y API keys es cableado de base; las features de producto lo activan según necesiten.

## Accessibility & Inclusion

Sin requisito externo confirmado. Por defecto el frontend Astro y shadcn/ui son accesibles por construcción (foco visible, `prefers-reduced-motion` respetado, contraste monocromo). Si aparece un requisito WCAG concreto, se documenta aquí.

## Stack

Monorepo Bun + Turborepo. Frontend Astro 7 SSR (`@astrojs/node` standalone) con React islands + Tailwind v4 + shadcn/ui (`base-nova` sobre Base UI, neutral, lucide). Backend Hono 4 + oRPC, construido con `tsdown` a `dist/index.mjs`. Gateway Caddy (`apps/gateway`). Paquetes compartidos: `@nonete/api`, `@nonete/auth`, `@nonete/cron`, `@nonete/db`, `@nonete/env`, `@nonete/logger`, `@nonete/config`. Lint/format: Biome 2.5.13.
