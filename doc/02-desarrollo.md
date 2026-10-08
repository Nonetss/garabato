# Desarrollo local

## Requisitos

- [Bun](https://bun.sh) 1.4.2 (es a la vez runtime, gestor de paquetes y test runner).
- Docker con Compose 2.22 o superior (para Loki y el stack en contenedores).
- Una base de datos PostgreSQL de desarrollo fuera del proyecto, en otro
  servidor (ver [Base de datos](#base-de-datos)).
- `openssl` (lo usan los scripts que generan secretos).

## Primera vez

```bash
bun install
bun run setup:dev
```

`setup:dev` crea el `.env` de la raíz a partir de `.env.example`, rellena los
secretos con valores aleatorios y añade las credenciales del administrador
inicial, que imprime por pantalla. Si ya existe un `.env` no lo toca, salvo
que le pases `--force`. Después pon en `DATABASE_URL` la dirección de tu base
de datos de desarrollo.

## Dos formas de arrancar

Hay dos modos equivalentes. Usan los mismos puertos, así que solo puede estar
uno en marcha a la vez.

### Con Docker (`bun run dev`)

```bash
bun run dev        # construye, arranca y vigila cambios; Ctrl+C para parar
bun run dev:down   # elimina los contenedores
```

Levanta el frontend (`astro dev`, en `:4320`), el backend (`bun --hot`), el
gateway (con `Caddyfile.dev`, que sirve la app en `https://localhost:4321`) y
Loki con `compose.dev.yml`. Como en producción, **solo el gateway publica un
puerto** (`https://localhost:4321`). Las apps y Loki quedan en la red interna
del stack y se encuentran por nombre de servicio: el compose sobrescribe
`BACKEND_URL` y `LOKI_URL`, y el resto sale del `.env` sin cambios. No levanta
ninguna base de datos: el backend usa la de `DATABASE_URL`, que está en otro
servidor. No se monta el repositorio: `docker compose watch` copia tus cambios
dentro de los contenedores. Solo hay volúmenes con nombre para la caché de
Vite (`frontend_vite_cache`) y la autoridad de certificación del gateway
(`gateway_data`); `bun run dev:down -v` los borra.

| Si editas… | Pasa esto |
| --- | --- |
| `apps/*/src`, `packages/*/src`, `apps/frontend/public` | Se sincroniza y la recarga en caliente lo recoge. |
| `apps/frontend/astro.config.mjs`, `apps/gateway/Caddyfile.dev`, `apps/gateway/routes.caddy` | Se sincroniza y se reinicia ese servicio. |
| `package.json`, `bun.lock` | Se reconstruyen las imágenes afectadas. |


### En nativo (`bun run dev:local`)

```bash
bun run loki:start  # solo Loki, en Docker, en 127.0.0.1:3100 (opcional)
bun run gateway     # el gateway de desarrollo: https://localhost:4321
bun run dev:local   # frontend y backend con Turbo
```

En nativo el gateway es obligatorio: es el que sirve `https://localhost:4321`.
`astro dev` escucha en `:4320` y el inicio de sesión solo funciona en el
origen del gateway.

También puedes arrancar una sola app con `bun run dev:frontend` o
`bun run dev:backend`.

### Dónde está cada cosa

- Web: <https://localhost:4321>, el gateway de desarrollo (HTTPS + HTTP/2) y
  el único puerto que se expone. Manda `/rpc`, `/api`, `/scalar` y
  `/openapi.json` al backend y el resto a `astro dev`, igual que en producción.
- Documentación de la API: <https://localhost:4321/scalar> (requiere sesión de admin)
- Detrás del gateway: el backend en `:3000` y `astro dev` en `:4320`. Con
  Docker solo existen en la red interna; en nativo son procesos del host en
  esos puertos, pero el inicio de sesión solo funciona a través de `:4321`.

### Confiar en el certificado local (una vez)

El gateway firma `https://localhost:4321` con la autoridad de certificación
local de Caddy, guardada en el volumen `stack-dev_gateway_data` para que no
cambie entre reinicios. Con el gateway arrancado al menos una vez:

```bash
bun run dev:cert   # deja caddy-local-root.crt (ignorado por git) en la raíz
```

Importa ese fichero en el navegador como autoridad de confianza (Chrome:
`chrome://certificate-manager`, certificados personalizados; Firefox: Ajustes →
Privacidad y seguridad → Certificados → Ver certificados → Autoridades →
Importar, marcando que identifique sitios web) y recarga. Si borras el volumen
(`bun run dev:down -v`) se crea una autoridad nueva y hay que importarla otra
vez.

El gateway sirve la app en HTTPS porque los navegadores solo usan HTTP/2
sobre TLS: así los cientos de módulos sin empaquetar que sirve Vite en
desarrollo comparten una conexión en vez de hacer cola en seis.

## Base de datos

El proyecto no levanta ninguna base de datos en desarrollo. La de desarrollo
vive **fuera del proyecto, en otro servidor**, y `DATABASE_URL` en el `.env`
apunta a ella. Así:

- El modo Docker y el nativo usan siempre los mismos datos.
- Borrar los contenedores o los volúmenes del stack de desarrollo no toca los
  datos.
- Tu máquina no tiene que ejecutar PostgreSQL ni reservar el puerto 5432.

Necesitas una base de datos PostgreSQL vacía (o con datos de desarrollo) y un
usuario con permisos para crear tablas, porque el backend aplica las
migraciones al arrancar. No apuntes `DATABASE_URL` a la base de datos de
producción.

| Comando | Qué hace |
| --- | --- |
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
