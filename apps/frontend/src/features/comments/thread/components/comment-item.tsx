import { useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CommentForm } from "@/features/comments/thread/components/comment-form"
import {
  useCommentCreate,
  useCommentDelete,
  useCommentUpdate,
} from "@/features/comments/thread/hooks/use-comment-mutations"
import type {
  Comment,
  CommentEntityRef,
} from "@/features/comments/thread/model/types"
import { authClient } from "@/lib/auth-client"
import { formatDateTime } from "@/lib/format"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const MessageSquareReply = getIcon("communication", "reply")
const Pencil = getIcon("actions", "edit")
const Trash2 = getIcon("actions", "delete")

function AuthorAvatar({ name, image }: { name: string; image: string | null }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  if (image) {
    return (
      <img
        src={image}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        decoding="async"
        className="size-8 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <Text
      variant="compact"
      tone="muted"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium"
      aria-hidden
    >
      {initials || "?"}
    </Text>
  )
}

interface CommentItemProps {
  comment: Comment
  entity: CommentEntityRef
  depth?: number
}

export function CommentItem({ comment, entity, depth = 0 }: CommentItemProps) {
  const { data: session } = authClient.useSession()
  const create = useCommentCreate(entity)
  const update = useCommentUpdate(entity)
  const remove = useCommentDelete(entity)

  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwner = session?.user?.id === comment.author.id
  const isDeleted = comment.deletedAt !== null

  return (
    <li className={cn("flex flex-col gap-3", depth > 0 && "ml-4 sm:ml-8")}>
      <article className="flex gap-3">
        <AuthorAvatar name={comment.author.name} image={comment.author.image} />
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Text variant="title" className="truncate">
              {comment.author.name}
            </Text>
            <time
              dateTime={comment.createdAt}
              className={textVariants({ role: "compact", tone: "muted" })}
            >
              {formatDateTime(comment.createdAt)}
            </time>
          </header>

          {editing && !isDeleted ? (
            <CommentForm
              className="mt-2"
              compact
              autoFocus
              initialValue={comment.content}
              submitLabel="Guardar"
              isPending={update.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={async (content) => {
                await update.mutateAsync({ id: comment.id, content })
                setEditing(false)
              }}
            />
          ) : (
            <Text
              as="p"
              variant="body"
              tone={isDeleted ? "muted" : "default"}
              className={cn(
                "mt-1 whitespace-pre-wrap wrap-break-word leading-relaxed",
                isDeleted && "italic"
              )}
            >
              {isDeleted ? "Comentario eliminado" : comment.content}
            </Text>
          )}

          {!editing ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {!isDeleted ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setReplying((value) => !value)}
                >
                  <MessageSquareReply data-icon="inline-start" />
                  Responder
                </Button>
              ) : null}
              {isOwner && !isDeleted ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil data-icon="inline-start" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Eliminar
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {replying ? (
            <CommentForm
              className="mt-2"
              compact
              autoFocus
              placeholder="Escribe una respuesta…"
              submitLabel="Responder"
              isPending={create.isPending}
              onCancel={() => setReplying(false)}
              onSubmit={async (content) => {
                await create.mutateAsync({
                  ...entity,
                  content,
                  parentId: comment.id,
                })
                setReplying(false)
              }}
            />
          ) : null}
        </div>
      </article>

      {comment.replies.length > 0 ? (
        <ul className="flex flex-col gap-3 border-l border-border/60 pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entity={entity}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar comentario"
        description="El comentario se ocultará. Si tiene respuestas, quedará marcado como eliminado."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          await remove.mutateAsync({ id: comment.id })
          return true
        }}
      />
    </li>
  )
}
