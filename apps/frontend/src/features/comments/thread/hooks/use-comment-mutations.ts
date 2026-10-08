import {
  commentsCountsKey,
  commentsListKey,
} from "@/features/comments/thread/hooks/use-comments"
import type { CommentEntityRef } from "@/features/comments/thread/model/types"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

type CreateInput = {
  entityType: string
  entityId: string
  content: string
  parentId?: string
}

type UpdateInput = {
  id: string
  content: string
}

type DeleteInput = {
  id: string
}

const countsKey = commentsCountsKey()

export function useCommentCreate(entity: CommentEntityRef) {
  return useResourceMutation({
    mutationFn: (input: CreateInput) => orpc.v1.comment.create.call(input),
    listKey: commentsListKey(entity),
    extraInvalidate: [countsKey],
    messages: {
      success: "Comentario publicado",
      error: "No se pudo publicar el comentario",
    },
  })
}

export function useCommentUpdate(entity: CommentEntityRef) {
  return useResourceMutation({
    mutationFn: (input: UpdateInput) => orpc.v1.comment.update.call(input),
    listKey: commentsListKey(entity),
    messages: {
      success: "Comentario actualizado",
      error: "No se pudo actualizar el comentario",
    },
  })
}

export function useCommentDelete(entity: CommentEntityRef) {
  return useResourceMutation({
    mutationFn: (input: DeleteInput) => orpc.v1.comment.delete.call(input),
    listKey: commentsListKey(entity),
    extraInvalidate: [countsKey],
    messages: {
      success: "Comentario eliminado",
      error: "No se pudo eliminar el comentario",
    },
  })
}
