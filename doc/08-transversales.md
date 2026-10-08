# Funcionalidades transversales

Son piezas que no pertenecen a una página concreta sino que se pueden enganchar
a cualquier entidad. Vienen de la plantilla: úsalas si encajan con el
producto.

## Referencias polimórficas

Comentarios e iconos usan el mismo truco: en vez de una clave foránea a una
tabla concreta, guardan una **referencia polimórfica** con dos campos:

- `entityType`: qué tipo de cosa es (`"cron-run"`, `"invoice"`…).
- `entityId`: su identificador, como texto, para que valgan tanto UUIDs como
  los ids de Better Auth.

Así se puede comentar o poner icono a cualquier entidad sin tocar el esquema.
La contrapartida es que la base de datos no puede borrar en cascada: el
handler que borra una entidad tiene que borrar también sus comentarios o su
icono, en la misma transacción.

## Comentarios

Hilos de comentarios con respuestas sobre cualquier entidad.

- **API** (`orpc.v1.comment.*`): `list` devuelve los comentarios de una entidad
  como árbol de respuestas; `counts` cuenta los de muchas entidades de una vez
  (para mostrar contadores en una lista); `create`, `update` y `delete` (lógico).
  Solo el autor puede editar o borrar sus comentarios.
- **Frontend** (`features/comments`): `CommentsButton` muestra el contador y
  abre el hilo en un panel lateral. Hoy se usa en las ejecuciones de los crons.

Para usarlo en otra entidad basta con renderizar `CommentsButton` con su
`entityType` y `entityId`.

## Iconos de entidad

Permiten que el usuario elija un icono de Lucide y un color para una entidad.

- **Tabla** `entity_icons`: un icono por `(entity_type, entity_id)`, con el
  nombre del icono y una clave de color de una paleta fija.
- **API** (`orpc.v1.entityIcon.*`): `getMany` (en lote, para listas), `set` y
  `clear`.
- **Frontend** (`features/entity-icons`): `IconPicker` (selector controlado),
  `EntityIconPicker` (carga y guarda solo), `EntityIcon` (lo muestra, con un
  icono de reserva) y `useEntityIcons` (carga los de una lista en una
  petición).

A diferencia de los comentarios, aquí **cada tipo de entidad tiene que
registrarse** en `packages/api/src/v1/entity-icon/targets.ts`, indicando qué
entidades puede ver y modificar cada usuario. **Hoy el registro está vacío**,
así que cualquier llamada responde `BAD_REQUEST` hasta que una entidad lo use.
Para activarlo:

1. Añadir una entrada a `entityIconTargets` con las funciones `readable` y
   `writable`, que devuelven qué ids puede tocar el usuario.
2. En el handler que borra esa entidad, llamar a `deleteEntityIcons(...)`.
3. En la interfaz, usar `EntityIconPicker` o `IconPicker` en el formulario y
   `EntityIcon` donde se muestre.

El catálogo de iconos del selector se genera con `bun run icons:catalog` a
partir de los metadatos de Lucide, y se descarga solo cuando se abre un
selector.

## Registro de actividad

`/admin/logs` muestra qué ha pasado en la aplicación: las llamadas a la API y
las páginas visitadas por usuarios con sesión.

- El backend marca cada llamada a `/rpc` y `/api` de un usuario con sesión
  como `api_call` (salvo las de autenticación, documentación y la propia
  consulta del registro).
- El middleware del frontend marca cada página vista como `page_view`.
- Los logs se envían a **Loki**, y `logs.query` los consulta.

Es opcional: sin `LOKI_URL` los logs solo salen por consola y `/admin/logs`
aparece vacío. Si `LOKI_URL` está definido pero Loki no responde, la consulta
falla con `BAD_GATEWAY` (502). Los compose `compose.yml` y `compose.prod.yml`
ya incluyen un Loki con 30 días de retención.
