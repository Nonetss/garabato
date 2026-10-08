import { useMutation, useQueryClient } from "@tanstack/react-query"
import { entityIconsKey } from "@/features/entity-icons/picker/hooks/use-entity-icons"
import {
  type EntityIconRef,
  type EntityIconValue,
  entityIconKey,
} from "@/features/entity-icons/picker/model/types"
import { orpc } from "@/lib/orpc"

type EntityIconRow = EntityIconRef & EntityIconValue

/**
 * Patches every cached batch that already lists the entity, then refetches
 * the batches so entities that had no icon pick the new one up too.
 */
function useSyncEntityIconCache() {
  const queryClient = useQueryClient()
  return async (ref: EntityIconRef, next: EntityIconValue | null) => {
    const key = entityIconKey(ref)
    queryClient.setQueriesData<EntityIconRow[]>(
      { queryKey: entityIconsKey() },
      (rows) =>
        rows?.flatMap((row) => {
          if (entityIconKey(row) !== key) return [row]
          return next ? [{ ...row, ...next }] : []
        })
    )
    await queryClient.invalidateQueries({ queryKey: entityIconsKey() })
  }
}

/**
 * Persists an entity's icon. Callers decide how to report errors: the
 * collection dialog keeps itself open, `EntityIconPicker` shows a toast.
 */
export function useSetEntityIcon() {
  const sync = useSyncEntityIconCache()
  return useMutation({
    mutationFn: (input: EntityIconRow) => orpc.v1.entityIcon.set.call(input),
    onSuccess: (row) => sync(row, { icon: row.icon, color: row.color }),
  })
}

export function useClearEntityIcon() {
  const sync = useSyncEntityIconCache()
  return useMutation({
    mutationFn: (ref: EntityIconRef) =>
      orpc.v1.entityIcon.clear.call({
        entityType: ref.entityType,
        entityId: ref.entityId,
      }),
    onSuccess: (_result, ref) => sync(ref, null),
  })
}
