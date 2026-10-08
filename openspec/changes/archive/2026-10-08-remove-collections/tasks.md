## 1. Base de datos

- [x] 1.1 Borrar `packages/db/src/schema/collection/` y su export en `packages/db/src/schema/index.ts`
- [x] 1.2 Quitar `collection` y `collectionItem` (y `user.collections`) de `packages/db/src/relations.ts`

## 2. API

- [x] 2.1 Borrar `packages/api/src/v1/collection/` y su montaje en `packages/api/src/v1/router.ts`
- [x] 2.2 Dejar vacío el registro de `packages/api/src/v1/entity-icon/targets.ts` y actualizar el ejemplo de `entityType` en `entity-icon/input.ts`

## 3. Frontend

- [x] 3.1 Borrar `apps/frontend/src/features/collections/` y `apps/frontend/src/pages/collections/`
- [x] 3.2 Quitar las superficies de colecciones y la fuente `custom-collections` de `app-surfaces.ts` y `surface-search-sources.ts`
- [x] 3.3 Quitar el grupo `collections` de `icon-registry.ts`
- [x] 3.4 Quitar `FavoriteButton` y `CollectionButton` de la fila y del detalle de crons
- [x] 3.5 Revisar comentarios que citan colecciones como ejemplo (`site-nav.ts`, navbar móvil, diálogo de búsqueda, `use-entity-icon-mutations.ts`, `page-hero.tsx`)

## 4. Documentación

- [x] 4.1 Actualizar `README.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` y `.claude/commands/worktree.md`
- [x] 4.2 Actualizar `AGENTS.md` y las referencias de la skill `stack` que citan colecciones

## 5. Validación

- [x] 5.1 `check-types`, Biome, `tailwind:check` y `bun run test` en verde
- [x] 5.2 `openspec validate remove-collections --strict` y avisar al usuario de que genere la migración
