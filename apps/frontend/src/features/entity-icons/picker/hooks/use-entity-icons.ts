import { useMemo } from "react"
import {
  type EntityIconRef,
  type EntityIconValue,
  entityIconKey,
} from "@/features/entity-icons/picker/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

/** Prefix shared by every batched icon query, for cache updates. */
export function entityIconsKey() {
  return orpc.v1.entityIcon.getMany.key()
}

/** Must match `.max(100)` on `entityIconInput.getMany` in the backend. */
const ENTITY_ICONS_BATCH_SIZE = 100

async function fetchEntityIcons(entities: EntityIconRef[]) {
  const chunks: EntityIconRef[][] = []
  for (let i = 0; i < entities.length; i += ENTITY_ICONS_BATCH_SIZE) {
    chunks.push(entities.slice(i, i + ENTITY_ICONS_BATCH_SIZE))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      orpc.v1.entityIcon.getMany.call(
        { entities: chunk },
        { context: { read: true } }
      )
    )
  )
  return results.flat()
}

/**
 * Loads the icons of a list of entities with one query (split into parallel
 * requests past the backend's batch cap). `iconFor` returns `null` for
 * entities without an icon.
 */
export function useEntityIcons(entities: EntityIconRef[]) {
  const refs = entities.map(({ entityType, entityId }) => ({
    entityType,
    entityId,
  }))
  const query = useHydratedQuery({
    queryKey: orpc.v1.entityIcon.getMany.queryKey({
      input: { entities: refs },
    }),
    queryFn: () => fetchEntityIcons(refs),
    enabled: refs.length > 0,
  })

  const icons = useMemo(() => {
    const byKey = new Map<string, EntityIconValue>()
    for (const row of query.data ?? []) {
      byKey.set(entityIconKey(row), { icon: row.icon, color: row.color })
    }
    return byKey
  }, [query.data])

  const iconFor = (ref: EntityIconRef) => icons.get(entityIconKey(ref)) ?? null

  return { ...query, icons, iconFor }
}
