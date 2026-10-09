# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Garabato (sobre la base del template `stack`) lo usa por ahora el propio usuario para firmar sus PDF con sus certificados digitales: sube un documento, coloca la firma visible, firma y descarga. No le interesan paneles de pendientes ni recientes; le interesa ir del archivo al PDF firmado rápido y saber con qué certificado va a firmar. Cuando el producto tenga usuarios externos, este fichero se actualiza para describirlos.

## Product Purpose

stack arranca con todo ya cableado (Astro + Hono/oRPC + Better Auth + Drizzle/Postgres + OpenSpec + Docker) para que el trabajo de producto empiece con auth, RPC tipado, cron scheduling, comentarios y documentación de capacidades ya resueltos. Comparte paquetes (`@nonete/*`), convenciones y sistema visual con el `stack` original, de modo que el código se pueda mover entre ambos repos sin reescribirlo.

## Operating Context

stack se opera como **consola técnica** corriendo en local o en un servidor propio vía Docker Compose. Quien la usa vive en la CLI (`bun run dev`, `bun run dev:local`, `bun run db:generate`, `bun run docker:up`, `openspec validate --strict`) y en el navegador en `localhost:4321` (dev) o en el puerto del gateway (producción). Los artefactos vivos son: páginas Astro en `apps/frontend/src/pages` (404, inicio, admin, config, crons, login, me, signup), la documentación de capacidades en `openspec/specs/` y la guía de estilo visual en `DESIGN.md` (raíz). `BETTER_AUTH_SECRET` y el admin inicial se generan con `scripts/setup-dev.sh`.

## Capabilities and Constraints

Capacidades confirmadas (todas con spec en `openspec/specs/`):

- **Autenticación** con email/password (y OIDC opcional) vía Better Auth, sesiones, roles (admin) y protección por rol en `/admin`.
- **Organizaciones, equipos, miembros e invitaciones** vía el plugin `organization` de Better Auth, con control de acceso dinámico.
- **API keys** como método de autenticación machine-to-machine (`@better-auth/api-key`).
- **Firma de documentos**: biblioteca de PDF con miniaturas (`/documents`), organizada en carpetas anidadas (con icono propio), etiquetas de color y documentos fijados, con búsqueda y filtros sobre toda la biblioteca, selección múltiple y arrastrar para mover; visor con colocación de la firma visible, versiones (cada una dice qué la produjo: original, unión, páginas editadas o firma) e historial de firmas (`/documents/[id]`); antes de firmar, el editor de páginas reordena, gira y quita páginas guardando una versión nueva, y la barra de selección une de 2 a 20 documentos en un PDF nuevo sin tocar los originales; ninguna de las dos operaciones acepta documentos con firmas (hechas en Garabato o incrustadas en el PDF), porque reescribirlos las invalidaría; las firmas son PAdES B-B, o B-T con sello de tiempo cuando hay una autoridad de sellado configurada (`TSA_URL`); la página del documento comprueba además todas las firmas incrustadas en el PDF, también las hechas fuera de Garabato (integridad, firma, alcance, vigencia del certificado y confianza en el emisor; sin revocación), certificados digitales guardados cifrados (`/certificates`) y las trazas de todo lo hecho con documentos y certificados (firmas, importaciones, subidas, uniones, ediciones de páginas, descargas, renombrados, movimientos y borrados), filtrables por tipo, certificado, nombre y fechas, con el detalle de cada una (`/traces`). El inicio (`/`) es una zona para soltar un PDF que abre el documento listo para firmar.
- **Cron scheduling y management** (`/crons`, `/crons/[id]`) con un scheduler en el propio backend que ejecuta procedimientos de la API marcados como elegibles. Se conserva por si se usa en el futuro, pero está fuera de la navegación, del inicio y del buscador.
- **RPC tipado** vía oRPC en `packages/api`, versionado (`src/<version>/`) por feature.
- **Comentarios** sobre cualquier recurso; **iconos de entidad** personalizables.
- **Registro de actividad** (`/admin/logs`) sobre Loki.
- **Documentación HTTP** en `/scalar` y `/openapi.json`, protegida por sesión admin.
- **Tema claro/oscuro/sistema** y **PWA** instalable.
- **Structured logging** con pino.

Restricciones técnicas: Bun 1.4.2 (`bunfig.toml` con `linker = "isolated"`), versiones fijadas en el `workspaces.catalog` raíz, Biome 2.5.15, `apps/backend` construido con `tsdown`, scripts de Drizzle solo en `packages/db`, migraciones aplicadas por el backend al arrancar, un único `.env` en la raíz, `BETTER_AUTH_SECRET` de al menos 32 caracteres.

Logo propio: una firma de un solo trazo sobre línea base, estilo Lucide (trazo 2 en rejilla 24, puntas redondeadas), toda en terracota (`apps/frontend/src/assets/logo.svg`, que sirve de favicon vía `/logo.svg` y de logo del footer, y del que salen `logo.png`/`logo.webp` transparentes, el `apple-touch-icon` y los iconos de `public/pwa/` sobre el fondo oscuro del tema `#262624`); sustituye a la pieza S del Tetris anterior. Nombre público: **Garabato** (manifest de la PWA, `nameApp` de los layouts, footer, login y título de la documentación OpenAPI); los paquetes `@nonete/*` y las referencias al template `stack` no cambian. Sin decidir (no inventar): dominio.

## Brand Commitments

**Estilo visual "quiet editorial", heredado del `stack` original.** Las reglas de `DESIGN.md` son obligaciones vigentes: monocromo con un único acento naranja (`primary`) reservado a icono de hero, CTA principal y punto de estado activo; `destructive` solo para fallos o acciones irreversibles; nunca verde/azul/ámbar semánticos. La paleta de color actual es una decisión del usuario y no se cambia sin que lo pida. Tipografía: **Schibsted Grotesk Variable** (UI) y **JetBrains Mono Variable** (datos, `tabular-nums`). Superficies de firma: la hoja (`shadow-sheet` sobre `bg-desk`) y la rúbrica del logo como único momento de movimiento (ver `DESIGN.md`, "Signing surfaces"). Anatomía: `PageShell maxWidth="6xl"` para listas, `Detail.astro` para detalle, cabeceras con `PageHero`, listas en `divide-y`, hechos en una franja `border-y` con `<dl>`, estados con `StateCard` y formularios en `FormDialog`. Excepciones: `components/ui/**` (shadcn base), el chrome de `features/app-shell` y los formularios de login/signup.

Voz: consola técnica, clara, sin ornamento.

## Evidence on Hand

- **Capacidades**: una spec por capacidad en `openspec/specs/` (el change inicial está en `openspec/changes/archive/2026-10-08-adopt-stack-foundation`).
- **Estilo visual**: `DESIGN.md` (raíz).
- **Estructura**: `README.md` y `AGENTS.md`; la skill `stack` en `.agents/skills/stack`.
- **APIs**: `apps/backend` expone `GET /` (`OK`), `/rpc/<version>/<feature>/<method>`, `/api/<version>/<feature>/<method>`, `/scalar` y `/openapi.json`.
- **Sin clientes externos, sin testimonios, sin métricas** — no fabricar ninguno.

## Product Principles

1. **Specs primero, código después.** Toda capacidad nueva abre un change de OpenSpec antes de tocar código.
2. **Sincronizable con el `stack` original.** Mismos nombres de paquetes, convenciones e imports, salvo que se decida divergir por escrito.
3. **Calma sobre ornamento.** La jerarquía la llevan el tamaño de tipo, el tracking y `tabular-nums`, no el color.
4. **Cableado, no demo.** Auth con admin, organizaciones y API keys es cableado de base; las features de producto lo activan según necesiten.

## Accessibility & Inclusion

Sin requisito externo confirmado. Por defecto el frontend Astro y shadcn/ui son accesibles por construcción (foco visible, `prefers-reduced-motion` respetado, contraste monocromo). Si aparece un requisito WCAG concreto, se documenta aquí.

## Stack

Monorepo Bun + Turborepo. Frontend Astro 7 SSR (`@astrojs/node` standalone) con React islands + Tailwind v4 + shadcn/ui (`base-nova` sobre Base UI, neutral, lucide). Backend Hono 4 + oRPC, construido con `tsdown` a `dist/index.mjs`. Gateway Caddy (`apps/gateway`). Paquetes compartidos: `@nonete/api`, `@nonete/auth`, `@nonete/cron`, `@nonete/db`, `@nonete/env`, `@nonete/logger`, `@nonete/config`. Lint/format: Biome 2.5.15.
