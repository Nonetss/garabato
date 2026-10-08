# Desarrollo local

## Requisitos

- [Bun](https://bun.sh) 1.4.2 (es a la vez runtime, gestor de paquetes y test runner).
- Docker con Compose 2.22 o superior (para la base de datos y el stack en contenedores).
- `openssl` (lo usan los scripts que generan secretos).

## Primera vez

```bash
bun install
bun run setup:dev
```

`setup:dev` crea el `.env` de la raíz a partir de `.env.example`, rellena los
secretos con valores aleatorios y añade las credenciales del administrador
inicial, que imprime por pantalla. Si ya existe un `.env` no lo toca, salvo
que le pases `--force`.

## Dos formas de arrancar

Hay dos modos equivalentes. Usan los mismos puertos, así que solo puede estar
uno en marcha a la vez.

### Con Docker (`bun run dev`)

```bash
bun run dev        # construye, arranca y vigila cambios; Ctrl+C para parar
bun run dev:down   # elimina los contenedores
```

Levanta el frontend (`astro dev`), el backend (`bun --hot`), el gateway y la
base de datos con `compose.dev.yml`. Las apps usan la red del host, así que
leen el mismo `.env` sin cambios y escuchan en los mismos puertos que en
nativo. No hay volúmenes montados: `docker compose watch` copia tus cambios
dentro de los contenedores.

| Si editas… | Pasa esto |
| --- | --- |
| `apps/*/src`, `packages/*/src`, `apps/frontend/public` | Se sincroniza y la recarga en caliente lo recoge. |
| `apps/frontend/astro.config.mjs`, `apps/gateway/Caddyfile` | Se sincroniza y se reinicia ese servicio. |
| `package.json`, `bun.lock` | Se reconstruyen las imágenes afectadas. |

La red del host solo funciona en Linux, o en Docker Desktop con esa opción
activada.

### En nativo (`bun run dev:local`)

```bash
bun run db:start    # solo la base de datos, en Docker
bun run dev:local   # frontend y backend con Turbo
```

También puedes arrancar una sola app con `bun run dev:frontend` o
`bun run dev:backend`.

### Dónde está cada cosa

- Web: <http://localhost:4321>
- API: <http://localhost:3000>
- Documentación de la API: <http://localhost:4321/scalar> (requiere sesión de admin)
- Gateway, opcional en desarrollo (`bun run gateway`): <http://localhost:8080>

El gateway no hace falta para desarrollar, porque `astro dev` ya reenvía las
rutas de la API al backend. Sirve para probar el enrutado tal como será en
producción.

## Base de datos

`bun run db:start` arranca PostgreSQL 17 en el puerto `POSTGRES_PORT`
(por defecto 5432), que coincide con el `DATABASE_URL` del `.env`. Si ese
puerto está ocupado en tu máquina, cambia los dos.

| Comando | Qué hace |
| --- | --- |
| `bun run db:start` | Arranca Postgres en segundo plano. |
| `bun run db:watch` | Lo mismo, en primer plano. |
| `bun run db:stop` | Lo para. |
| `bun run db:down` | Elimina el contenedor. Los datos siguen en el volumen `db_data`. |
| `bun run db:studio` | Abre Drizzle Studio para explorar los datos. |

**No hay que aplicar el esquema a mano.** El backend aplica las migraciones al
arrancar. Cuando cambias el esquema en `packages/db/src/schema/`, el flujo es:

1. `bun run db:generate` genera una carpeta nueva en
   `packages/db/src/migrations/<timestamp>_<nombre>/` con `migration.sql` y
   `snapshot.json`.
2. Revisas el SQL generado.
3. Lo commiteas junto al cambio de esquema.
4. Reinicias el backend, que la aplica.

`db:push` (aplicar el esquema sin migración) existe, pero conviene usarlo solo
para experimentos. Lo que se despliega son las migraciones.

> Las migraciones las genera y revisa siempre una persona. Los agentes de
> código tienen prohibido generarlas, aplicarlas o editarlas.

## Validar un cambio

| Comando | Qué comprueba |
| --- | --- |
| `bun run check-types` | Tipos de TypeScript en todo el repo (`tsc` y `astro check`). |
| `bun run check` | Biome: formato, lint y orden de imports (corrige lo que puede). |
| `bun run format` | Solo formato. |
| `bun run tailwind:check` | Clases de Tailwind mal escritas o redundantes (`tailwint`). `tailwind:fix` las arregla. |
| `bun run test` | Tests unitarios. |

Para comprobar los tipos de un solo workspace:
`bun run --filter @nonete/api check-types`.

No hay git hooks: nada se ejecuta solo al hacer commit.

## Tests

Hoy solo `packages/api` tiene tests (`bun test`, en `packages/api/tests/`).
Son **herméticos**: no se conectan a la base de datos, no hacen peticiones de
red y no necesitan nada arrancado, ni siquiera un `.env`.

Cómo lo consiguen:

- `packages/api/tests/setup.ts` se carga antes que nada y **sobrescribe** las
  variables de entorno con valores de mentira: el `DATABASE_URL` apunta a un
  puerto cerrado y las variables opcionales se vacían. Así importar
  `@nonete/auth` o `@nonete/db` no falla al validar el entorno y nunca toca tu
  base de datos real.
- Los procedimientos se ejecutan con `call(procedimiento, input, { context })`
  de oRPC, que pasa por los mismos middlewares que una petición real. Los
  contextos se crean con `tests/fixtures/context.ts`.
- Lo que tocaría la base de datos u otros módulos se sustituye con
  `mock.module(...)` antes de importar el código que se prueba.

La carpeta `tests/` replica la de `src/`: `tests/index.test.ts` prueba los
builders, `tests/shared/` los helpers y `tests/v1/<feature>/` los handlers.

No hay tests en el frontend, en el backend ni end-to-end. Si se añaden en otro
paquete, la idea es copiar el montaje de `packages/api`.

## Otros comandos

| Comando | Qué hace |
| --- | --- |
| `bun run build` | Compila todas las apps. |
| `bun run icons:catalog` | Regenera el catálogo de iconos Lucide del selector de iconos (necesita red; hay que commitear el resultado). Se ejecuta tras actualizar `lucide-react`. |
| `bun run docker:up` / `docker:down` / `docker:logs` / `docker:build` | El stack tipo producción construido desde el código (ver [Docker y despliegue](09-docker-despliegue.md)). |
