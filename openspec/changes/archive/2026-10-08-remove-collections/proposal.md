## Why

Las colecciones (favoritos y colecciones personalizadas) llegaron con la base traída de `stack`, no porque el producto las necesite. Mantenerlas supone código, tablas, superficies de navegación y specs que nadie usa y que condicionan otras features (iconos de entidad, búsqueda de superficies, filas de crons). Se eliminan ahora, mientras no hay datos que conservar.

## What Changes

- **BREAKING** Se elimina la feature `collection` de la API (`packages/api/src/v1/collection/`) y su montaje en el router `v1`: desaparecen `orpc.v1.collection.*`, `/rpc/v1/collection/*`, `/api/v1/collection/*` y la etiqueta OpenAPI `Collections`.
- **BREAKING** Se eliminan las tablas `collections` y `collection_items` del schema Drizzle (`packages/db/src/schema/collection/`) y sus relaciones. La migración que las borra la genera y aplica el usuario.
- Se elimina el dominio de frontend `features/collections` (overview, detail, favorites, save, shared) y las páginas `/collections`, `/collections/favorites`, `/collections/custom` y `/collections/custom/[id]`.
- Se quitan las superficies `collections`, `collections-favorites`, `collection-detail` y `collection-detail-info` de `app-surfaces.ts`, la fuente de búsqueda `custom-collections` y los iconos `collections` del registro de iconos.
- Los crons dejan de mostrar `FavoriteButton` y `CollectionButton` en sus filas y en su página de detalle.
- Los iconos de entidad se mantienen como capacidad, pero `collection` deja de ser un tipo registrado: el registro queda vacío hasta que otra entidad lo use.
- Las specs que citaban colecciones como ejemplo pasan a citar otras features existentes.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `collections`: se eliminan todos sus requisitos (la capacidad desaparece).
- `entity-icons`: el registro deja de exigir `collection`, se elimina el requisito "Collections use entity icons" y los ejemplos dejan de referirse a colecciones.
- `rpc-api`: el router `v1` deja de contener `collection`; los ejemplos de protección cross-site y de selección de método usan otra feature.
- `api-documentation`: los ejemplos de `QUERY` y de `CONFLICT` dejan de citar `collection`.
- `web-navigation`: desaparecen las superficies y registros de colecciones de la búsqueda, el resaltado de enlaces y los recientes; los ejemplos usan otras superficies.
- `list-filter-experience`: las páginas de colecciones dejan de figurar entre las que activan el botón "Volver arriba".
- `structured-logging`: el ejemplo de correlación de peticiones usa otro procedimiento.
- `frontend-component-system`: la lista de layouts con container queries deja de citar la rejilla de colecciones y la lista de recursos guardados.

## Impact

- Código: `packages/api/src/v1/collection/`, `packages/api/src/v1/router.ts`, `packages/api/src/v1/entity-icon/targets.ts`; `packages/db/src/schema/collection/`, `packages/db/src/schema/index.ts`, `packages/db/src/relations.ts`; `apps/frontend/src/features/collections/`, `apps/frontend/src/pages/collections/`, `app-surfaces.ts`, `icon-registry.ts`, `surface-search-sources.ts` y las vistas de crons.
- Base de datos: hay que generar y aplicar una migración que borre `collections` y `collection_items`. Las filas de `entity_icons` con `entity_type = 'collection'` quedan huérfanas; no hay datos que conservar.
- Documentación: `README.md`, `PRODUCT.md`, `DESIGN.md` y las referencias de la skill `stack` que citan colecciones.
