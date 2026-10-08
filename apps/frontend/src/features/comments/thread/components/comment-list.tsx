import { StateCard } from "@/components/shared/feedback/state-card"
import { Button } from "@/components/ui/button"
import { CommentItem } from "@/features/comments/thread/components/comment-item"
import type {
  Comment,
  CommentEntityRef,
} from "@/features/comments/thread/model/types"
import { getIcon } from "@/lib/icon-registry"

const MessageCircle = getIcon("communication", "conversation")

interface CommentListProps {
  comments: Comment[]
  entity: CommentEntityRef
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
}

export function CommentList({
  comments,
  entity,
  isPending,
  isError,
  onRetry,
}: CommentListProps) {
  if (isError) {
    return (
      <StateCard
        icon={<MessageCircle className="size-6" />}
        title="No se pudieron cargar los comentarios"
        tone="destructive"
        action={
          onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (isPending) {
    return <StateCard spinner title="Cargando comentarios..." />
  }

  if (comments.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Todavía no hay comentarios. Sé el primero en escribir.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} entity={entity} />
      ))}
    </ul>
  )
}
