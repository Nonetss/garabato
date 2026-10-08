## Context

La capacidad `collections` cruza todas las capas: tablas `collections` y `collection_items` en `@nonete/db` (con relaciones desde `user`), la feature `collection` de `@nonete/api` montada en `v1`, el dominio `features/collections` del frontend con cuatro páginas bajo `/collections`, cuatro superficies en `app-surfaces.ts`, una fuente de búsqueda (`custom-collections`), un grupo de iconos en `icon-registry.ts`, los botones de favorito/guardar en las vistas de crons y la única entrada del registro de `entity-icons`. Ninguna otra feature depende de sus datos.

## Goals / Non-Goals

**Goals:**

- Que no quede código, ruta, superficie, icono ni tabla de colecciones, y que `check-types`, Biome, `tailwind:check` y `bun run test` sigan en verde.
- Que las specs y la documentación (README, PRODUCT, DESIGN, skill `stack`) dejen de describir colecciones.

**Non-Goals:**

- Generar o aplicar la migración que borra las tablas: la hace el usuario.
- Eliminar o simplificar `entity-icons`, `comments` u otras features de la base. `entity-icons` se queda sin consumidores pero intacto.
- Reescribir el historial: el change archivado `2026-10-08-adopt-stack-foundation` y sus migraciones no se tocan.

## Decisions

- **Registro de `entity-icons` vacío en lugar de quitar la feature.** El registro (`entityIconTargets`) queda como `{}` tipado; cualquier llamada falla con `BAD_REQUEST` por tipo no registrado, que es el comportamiento ya especificado. Alternativa descartada: borrar `entity-icons`, que el usuario no ha pedido y que AGENTS.md prohíbe hacer por iniciativa propia.
- **Crons sin acciones de guardado.** Las filas mantienen solo el candado de "declarado en código" o el interruptor de admin; el detalle pierde los dos botones y conserva "Ejecutar ahora". No se sustituyen por otra acción.
- **Ejemplos de specs reubicados en features vivas** (`cron.list`, `cron.get`, `cron.update`/`cron.remove` con `CONFLICT`, superficies de Configuración) en vez de borrarlos, para no perder cobertura de los requisitos genéricos.
- **El `Purpose` de `entity-icons`** (que cita colecciones como primer consumidor) se ajusta a mano al sincronizar, porque los deltas no modifican el propósito.

## Risks / Trade-offs

- [Filas huérfanas en `entity_icons` con `entity_type = 'collection'`] → No hay datos que conservar; el usuario puede borrarlas en la misma migración si lo desea.
- [El schema deja de coincidir con la base de datos hasta que se migre] → Drizzle no consulta esas tablas en ningún sitio tras el cambio; la migración se genera con `db:generate` y se aplica al arrancar el backend.
- [Enlaces guardados por los usuarios a `/collections/*`] → Pasan a dar la página 404 existente; aceptable en un proyecto sin usuarios reales.

## Migration Plan

1. Aplicar el código y las specs de este change.
2. El usuario ejecuta `bun run db:generate` (genera el `DROP TABLE` de `collection_items` y `collections`) y despliega; el backend aplica la migración al arrancar.
3. Rollback: revertir el commit y regenerar la migración inversa.
