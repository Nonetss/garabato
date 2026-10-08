import { Separator } from "@/components/ui/separator"
import { CommentForm } from "@/features/comments/thread/components/comment-form"
import { CommentList } from "@/features/comments/thread/components/comment-list"
import { useCommentCreate } from "@/features/comments/thread/hooks/use-comment-mutations"
import { useComments } from "@/features/comments/thread/hooks/use-comments"
import type { CommentEntityRef } from "@/features/comments/thread/model/types"

interface CommentsPanelProps {
  entity: CommentEntityRef
  emptyHint?: string
}

export function CommentsPanel({ entity }: CommentsPanelProps) {
  const {
    data: comments = [],
    isPending,
    isError,
    refetch,
  } = useComments(entity)
  const create = useCommentCreate(entity)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CommentForm
        isPending={create.isPending}
        onSubmit={(content) =>
          create.mutateAsync({
            ...entity,
            content,
          })
        }
      />
      <Separator />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <CommentList
          comments={comments}
          entity={entity}
          isPending={isPending}
          isError={isError}
          onRetry={() => refetch()}
        />
      </div>
    </div>
  )
}
