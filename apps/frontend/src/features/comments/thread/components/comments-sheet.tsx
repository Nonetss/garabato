import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CommentsPanel } from "@/features/comments/thread/components/comments-panel"
import type { CommentEntityRef } from "@/features/comments/thread/model/types"

interface CommentsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: CommentEntityRef | null
  title?: string
  description?: string
}

export function CommentsSheet({
  open,
  onOpenChange,
  entity,
  title = "Comentarios",
  description,
}: CommentsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              Lista y publicación de comentarios
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          {entity ? <CommentsPanel entity={entity} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
