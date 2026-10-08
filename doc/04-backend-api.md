# Backend y API

Toda la API vive en `packages/api`. El backend (`apps/backend`) solo la monta
en Hono junto a Better Auth y los middlewares.

## oRPC en dos frases

[oRPC](https://orpc.dev) permite definir cada operación de la API
(**procedimiento**) una sola vez, con esquemas zod de entrada y salida, y
usarla de dos formas:

- **Por RPC** en `/rpc/v1/...`: es lo que usa el frontend, con un cliente
  totalmente tipado (`orpc.v1.cron.list(...)`). Si cambias la salida de un
  procedimiento, TypeScript te avisa en el frontend.
- **Por HTTP normal (OpenAPI)** en `/api/v1/...`: para scripts y otros
  servicios. El documento está en `/openapi.json` y la documentación
  interactiva en `/scalar` (solo admins).

Se usa oRPC v2, que todavía está en beta y tiene la versión fijada. Ojo con la
documentación: la válida es la de <https://orpc.dev>; la de v1 no aplica.

## Cómo está organizado `packages/api`

![Estructura de packages/api/src](diagrams/api-estructura.svg)

En la base compartida, `index.ts` define los builders de procedimientos y los
metadatos (`cronMeta`…), `context.ts` lo que recibe cada procedimiento
(usuario, sesión, cabeceras, id de petición) y `errors.ts` el mapa de errores.
Además, `src/router.ts` monta cada versión de la API bajo su clave (`v1`).

Las features de v1 son `health`, `private`, `authConfig`, `apiKey`,
`organization`, `plugins`, `sessionHistory`, `logs`, `cron`, `comment` y
`entityIcon`.

### Separación entre router y handler

- **`router.ts` es solo cableado.** Elige quién puede llamar (el builder),
  describe el procedimiento para OpenAPI, declara entrada y salida y delega en
  el handler. Nunca toca la base de datos.
- **`handler.ts` tiene la lógica.** Las llamadas a `@nonete/db` y
  `@nonete/auth` están aquí. Cada método recibe un único objeto
  `{ context, input }`.

Un procedimiento típico:

```ts
// router.ts
list: protectedProcedure
  .meta(openapi({
    summary: "List cron jobs",
    description: "Lists every persistent cron job definition.",
    tags: ["System - Cron"],
    method: "GET",
  }))
  .output(cronOutput.list)
  .handler(() => cronHandler.list()),
```

## Quién puede llamar: los builders

Todo procedimiento parte de uno de estos cinco builders, definidos en
`packages/api/src/index.ts`. El builder decide el acceso y lo deja anotado en
los metadatos; nunca se pone a mano.

| Builder | Quién puede llamarlo |
| --- | --- |
| `publicProcedure` | Cualquiera, incluso sin sesión. |
| `protectedProcedure` | Cualquier usuario con sesión. Sin sesión: `UNAUTHORIZED`. |
| `adminProcedure` | Solo usuarios con el rol global `admin`. Sin sesión: `UNAUTHORIZED`; sin el rol: `FORBIDDEN`. |
| `permissionProcedure(recurso, acción)` | Quien tenga ese permiso en su organización activa. Los admins globales pasan siempre. |
| `cronProcedure` | Solo el planificador de crons. Ni siquiera un admin puede llamarlo por HTTP. |

## Elegir el método HTTP

La API es estilo RPC: las rutas salen del nombre del procedimiento
(`/api/v1/cron/setEnabled`) y los identificadores van en el cuerpo o en la
query string, nunca en la ruta. El método no forma la ruta: dice si la
operación **es segura y si se puede repetir**. Se elige por lo que hace el
handler, no por su nombre:

| El handler… | Método | Ejemplos |
| --- | --- | --- |
| Solo lee, y su entrada cabe en una query string | `GET` | `cron.list`, `organization.search`, `logs.query` |
| Solo lee, pero su entrada es una lista de objetos | `QUERY` | `comment.counts`, `entityIcon.getMany` |
| Crea algo nuevo cuyo id asigna el servidor | `POST` + estado `201` | `comment.create`, `cron.create` |
| Ejecuta una acción que no es un CRUD | `POST` | `cron.runNow` |
| Fija el estado completo de algo identificado por el cliente (repetirlo no cambia nada) | `PUT` | `entityIcon.set` |
| Cambia algunos campos y deja los demás | `PATCH` | `cron.update`, `comment.update` |
| Borra algo (también borrados lógicos) | `DELETE` | `cron.remove` |

Las reglas que hay detrás:

- `GET` y `QUERY` **nunca escriben** nada.
- `QUERY` es un método HTTP nuevo para lecturas con cuerpo. Se usa cuando la
  entrada no cabe en una URL (por ejemplo, 100 referencias a entidades). Una
  lectura nunca se pasa a `POST` solo porque su entrada sea grande.
- Un `PATCH` conserva los campos que no recibe; un `PUT` los reemplaza.
- `201` solo en procedimientos cuyo propósito es crear. Nunca `204`, porque
  todos los procedimientos devuelven un cuerpo.

En `/rpc`, el frontend envía las lecturas como `QUERY` y el resto como `POST`
automáticamente; el servidor rechaza `GET` en `/rpc` (protección CSRF, ver
[Autenticación](05-autenticacion.md)).

## Errores

Se lanzan con `errors.<CÓDIGO>()` importado de `#errors`, nunca con
`new ORPCError(...)`. El mensaje que ve el usuario va en español:

```ts
throw errors.NOT_FOUND({ message: "Comentario no encontrado" })
```

El código tiene que decir **cuál es la causa**:

| Código | Cuándo |
| --- | --- |
| `BAD_REQUEST` 400 | La entrada es inválida o incoherente más allá de lo que comprueba zod (un cursor mal formado, una expresión cron inválida). |
| `UNAUTHORIZED` 401 | No hay usuario autenticado. |
| `FORBIDDEN` 403 | Hay usuario, pero **este** usuario no tiene el rol o el permiso. Otro sí podría. |
| `NOT_FOUND` 404 | No existe, **o es privado de otra persona**. |
| `CONFLICT` 409 | La entrada es válida y el usuario podría, pero el estado o el tipo del objetivo lo impide para todo el mundo (un slug duplicado, un cron declarado en código). |
| `INTERNAL_SERVER_ERROR` 500 | El servidor rompió algo que debería cumplirse siempre. |
| `BAD_GATEWAY` 502 / `SERVICE_UNAVAILABLE` 503 | Falla un servicio externo o no está configurado (Loki caído). |

Dos distinciones que se confunden a menudo:

- **403 o 404.** Si el usuario ni siquiera debería saber que el recurso
  existe (es privado de otro), responde 404 para no filtrar su existencia.
  403 solo cuando lo puede ver pero no modificar.
- **403 o 409.** ¿Podría hacerlo un admin o el dueño? Entonces 403. ¿No puede
  nadie, por cómo está el objetivo? Entonces 409.

Los errores de validación de zod ya se convierten solos en `BAD_REQUEST`.

## Helpers compartidos

Antes de escribir un helper, mira `packages/api/src/shared/`:

| Fichero | Qué ofrece |
| --- | --- |
| `pagination.ts` | Paginación por cursor (`paginate`, `paginateWithTotal`) y los esquemas de entrada `paginationLimit` / `paginationCursor`. |
| `search.ts` | Entradas para procedimientos `search` (`searchQuery`, `searchLimit`) y `likePattern`, que escapa el texto para `ilike`. |
| `dates.ts` | `toIso` y `toIsoOrNull`. |
| `not-found.ts` | `assertFound(fila, mensaje?)`: devuelve la fila o lanza `NOT_FOUND`. |
| `procedure-docs.ts` | Lee la documentación OpenAPI de un procedimiento (lo usa el descubrimiento de crons). |

Un helper que solo usa una feature se queda en su `handler.ts`. Se mueve a
`shared/` cuando lo necesita una segunda.

## Búsquedas de texto libre

Cuando una entidad necesita un buscador (para un selector o para la búsqueda
del navbar), se añade un procedimiento `search` hermano de su `list`:

- Entrada `{ query, limit }` con los helpers de `#shared/search` (mínimo 2
  caracteres, 5 resultados por defecto, máximo 20).
- Salida mínima: el id y los campos que se muestran.
- Una sola consulta con `ilike` y `likePattern`, ordenada primero por los que
  empiezan por el texto y luego alfabéticamente.
- El mismo builder que su `list`, para no devolver nada que la lista no
  enseñaría.

Si el texto tiene que coincidir con columnas de **varias tablas**, no se hace
un `OR` a través de un join (PostgreSQL no puede usar índices así). Se hace
una `union` de una consulta por columna y se filtra con `inArray`. Para tablas
muy grandes (decenas de miles de filas) se pueden añadir índices GIN de
trigramas (`pg_trgm`), pero hoy no hace falta ninguno y la extensión ni
siquiera está activada.

## Añadir un procedimiento, paso a paso

1. **Busca si ya existe.** `rg -n "summary:" packages/api/src/v1` da un índice
   rápido. Si hay uno parecido, extiéndelo (un filtro opcional, un campo más)
   en vez de crear un hermano.
2. **Elige la feature** cuyos datos lee o escribe. Si es un área nueva, crea
   la carpeta `src/v1/<feature>/` y móntala en `src/v1/router.ts`.
3. **Define la entrada y la salida** en `input.ts` y `output.ts`.
4. **Escribe la lógica** en `handler.ts`.
5. **Cabléalo** en `router.ts`: builder, `.meta(openapi({...}))` con un
   `summary` y una `description` en inglés, el método y el estado correctos,
   `.input()`, `.output()` y `.handler()`.
6. **Úsalo desde el frontend** con `orpc.v1.<feature>.<método>`.
7. Valida con `check-types`, Biome y `bun run test`.

## Versiones de la API

Todo lo que depende de la versión vive en `src/v1/`. Una versión nueva sería
una carpeta `src/v2/` más una clave en `src/router.ts`. Las versiones
existentes no se tocan. Por eso las llamadas siempre llevan la versión
(`orpc.v1...`, `/rpc/v1/...`, `/api/v1/...`).
