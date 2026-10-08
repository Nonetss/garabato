# Arquitectura

stack es un monorepo de TypeScript que corre sobre Bun. Tiene tres
aplicaciones y siete librerías compartidas, y todo se coordina con Turborepo.

## Las piezas

![El navegador solo habla con el gateway, que envía la API al backend y el resto al frontend](diagrams/arquitectura.svg)

### Aplicaciones (`apps/`)

- **`apps/frontend`**: la web. Astro 7 renderiza las páginas en el servidor
  (SSR) y monta componentes React 19 como islas para la parte interactiva. Usa
  Tailwind v4 y componentes shadcn/ui sobre Base UI. Habla con la API mediante
  un cliente oRPC tipado y TanStack Query.
- **`apps/backend`**: la API. Un servidor Hono sobre Bun que monta los
  procedimientos de `packages/api`. Al arrancar aplica las migraciones, crea el
  usuario administrador y pone en marcha el planificador de crons.
- **`apps/gateway`**: un Caddy que recibe todas las peticiones públicas y las
  reparte. No es un workspace (no tiene `package.json`); solo contiene las
  rutas (`routes.caddy`), el `Caddyfile` de producción, el `Caddyfile.dev` de
  desarrollo y su `Dockerfile`.

### Librerías (`packages/`)

| Paquete | Para qué sirve |
| --- | --- |
| `@nonete/api` | Todos los procedimientos de la API: validación de entrada y salida, lógica y permisos. |
| `@nonete/auth` | La configuración de Better Auth (plugins, roles, permisos de organización). |
| `@nonete/db` | El esquema de la base de datos con Drizzle, las migraciones y el seed del admin. |
| `@nonete/cron` | El planificador que ejecuta tareas programadas dentro del backend. |
| `@nonete/logger` | El logger compartido (pino), con envío opcional a Loki. |
| `@nonete/env` | La lectura y validación de variables de entorno. |
| `@nonete/config` | El `tsconfig` base que heredan todos. |

Los paquetes no se compilan. Se publican como código TypeScript tal cual y
cada app los importa directamente (su script `build` es literalmente `true`).
Así se evitan pasos intermedios y cualquier cambio se ve al momento.

## El camino de una petición

Ejemplo: abres `/crons` en el navegador.

1. **El gateway** recibe `GET /crons`. Como no empieza por `/rpc`, `/api`,
   `/scalar` ni `/openapi.json`, lo envía al frontend.
2. **El middleware del frontend** (`apps/frontend/src/middleware.ts`) pregunta
   al backend por la sesión usando la cookie. Si no hay sesión, redirige a
   `/login`. Si la página es de `/admin` y el usuario no es admin, lo manda a
   `/`. Si todo va bien, registra la visita para el registro de actividad.
3. **Astro renderiza** la página. La parte interactiva es una isla React que
   se monta solo en el navegador (`client:only="react"`).
4. **La isla pide los datos** con `orpc.v1.cron.list`, que sale como
   `QUERY /rpc/v1/cron/list` hacia el mismo origen.
5. **El gateway** ve `/rpc/...` y lo pasa al backend.
6. **El backend** identifica al usuario por la cookie, le asigna un id de
   petición, ejecuta el procedimiento y devuelve el resultado.

En desarrollo pasa lo mismo: el gateway de desarrollo sirve
`https://localhost:4321` (HTTPS con HTTP/2 y un certificado local) con las
mismas rutas, delante de `astro dev`, que escucha en `:4320`.

### ¿Por qué un solo origen?

Como el navegador lo ve todo bajo el mismo dominio, no hay peticiones
cross-origin: no hace falta configurar CORS en el cliente y las cookies de
sesión funcionan sin trucos. Por eso el gateway es **el único sitio** que
decide qué app sirve cada ruta. Una ruta pública nueva se añade en
`apps/gateway/routes.caddy`, nunca publicando el puerto de otro servicio.

## Arranque y apagado del backend

Al arrancar (`apps/backend/src/index.ts`):

1. Aplica las migraciones pendientes de `packages/db/src/migrations/`.
2. Crea el usuario administrador si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están
   definidos y todavía no existe.
3. Arranca el planificador de crons y sincroniza los jobs declarados en código.
4. Empieza a servir HTTP en el puerto 3000.

Al recibir `SIGINT` o `SIGTERM` se apaga en orden: cierra los streams de
eventos de crons, deja 5 segundos a las peticiones HTTP en curso, para el
planificador y cierra la conexión a la base de datos. Si algo se cuelga, a los
8 segundos sale igualmente.

En desarrollo, `bun --hot` vuelve a ejecutar el fichero de entrada con cada
cambio. Por eso el arranque, los manejadores de señales y el servidor se
guardan en `globalThis`: así no se duplican en cada recarga.

## Cómo se importan las cosas

Hay dos sistemas de alias:

- **Dentro de una app**, `@/` apunta a su propia carpeta `src/`
  (`import { PageShell } from "@/components/shared/layout/page-shell"`).
- **Dentro de un paquete**, se usan los *subpath imports* de Node, que empiezan
  por `#` y se declaran en el campo `imports` del `package.json` del paquete
  (`import type { Context } from "#context"`).
- **Entre workspaces**, se usa el nombre del paquete
  (`import { db } from "@nonete/db"`).

¿Por qué dos sistemas? Los paquetes se consumen como código fuente desde otros
workspaces. Si también usaran `@/`, el `@/` de un paquete chocaría con el de la
app que lo importa. Los `#` se resuelven siempre respecto al paquete que los
declara.

Las versiones de las dependencias están fijadas en el `catalog` del
`package.json` raíz. Una dependencia que usan dos o más workspaces se declara
como `catalog:` en cada uno. Bun usa el *linker* aislado, así que un workspace
solo puede importar lo que declara en su propio `package.json`.

## Logs

Todos los workspaces usan el mismo logger (`packages/logger`, sobre pino):

- En desarrollo se ve formateado y con colores; en producción
  (`NODE_ENV=production`) sale como JSON, una línea por evento.
- Cada petición HTTP recibe un **id generado por el servidor** (nunca se
  acepta uno que venga del cliente). Todas las líneas de log de esa petición
  lo llevan, así que puedes seguir una petición de principio a fin.
- Los errores de los procedimientos se registran una sola vez, con un nivel
  según la causa: `warn` si es un rechazo deliberado (un 4xx), `error` si es un
  fallo del servidor (5xx o una excepción inesperada) e `info` si el cliente
  canceló la petición.
- Si `LOKI_URL` está definido, los logs también se envían a Loki y alimentan
  el registro de actividad de `/admin/logs` (ver
  [Funcionalidades transversales](08-transversales.md)).
