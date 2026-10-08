import { keepPreviousData } from "@tanstack/react-query"
import type { CommentEntityRef } from "@/features/comments/thread/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

export function commentsListKey(entity: CommentEntityRef) {
  return orpc.v1.comment.list.queryKey({
    input: {
      entityType: entity.entityType,
      entityId: entity.entityId,
    },
  })
}

export function commentsCountsKey(entities?: CommentEntityRef[]) {
  if (!entities) return orpc.v1.comment.counts.key()
  return orpc.v1.comment.counts.queryKey({
    input: { entities },
  })
}

/** Must match `.max(100)` on `commentInput.counts` in the backend. */
const COMMENT_COUNTS_BATCH_SIZE = 100

/**
 * The backend caps `entities` at 100 per request. Pages with more than 100
 * rows visible at once (a large switch's interfaces, a long-scrolled infinite
 * list…) are split here into parallel calls instead of sending one batch the
 * server would reject whole — still a single TanStack Query underneath, so
 * callers don't have to deal with a more complex loading state.
 */
async function fetchCommentCounts(entities: CommentEntityRef[]) {
  const chunks: CommentEntityRef[][] = []
  for (let i = 0; i < entities.length; i += COMMENT_COUNTS_BATCH_SIZE) {
    chunks.push(entities.slice(i, i + COMMENT_COUNTS_BATCH_SIZE))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      orpc.v1.comment.counts.call(
        { entities: chunk },
        { context: { read: true } }
      )
    )
  )
  return results.flat()
}

export function useComments(entity: CommentEntityRef | null) {
  return useHydratedQuery({
    ...orpc.v1.comment.list.queryOptions({
      input: {
        entityType: entity?.entityType ?? "",
        entityId: entity?.entityId ?? "",
      },
    }),
    enabled: entity !== null,
  })
}

/**
 * One query for a whole list of entities. The key holds every entity, so a
 * list that grows (the next page of an infinite list) refetches the batch;
 * the previous counts stay on screen meanwhile instead of dropping to zero.
 */
export function useCommentCounts(entities: CommentEntityRef[]) {
  return useHydratedQuery({
    queryKey: orpc.v1.comment.counts.queryKey({ input: { entities } }),
    queryFn: () => fetchCommentCounts(entities),
    enabled: entities.length > 0,
    placeholderData: keepPreviousData,
  })
}

export function useCommentCount(entity: CommentEntityRef | null) {
  const entities = entity ? [entity] : []
  const query = useCommentCounts(entities)
  const count =
    query.data?.find(
      (row) =>
        row.entityType === entity?.entityType &&
        row.entityId === entity?.entityId
    )?.count ?? 0

  return { ...query, count }
}
