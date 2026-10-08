import { useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import { CommentsSheet } from "@/features/comments/thread/components/comments-sheet"
import { useCommentCount } from "@/features/comments/thread/hooks/use-comments"
import type { CommentEntityRef } from "@/features/comments/thread/model/types"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const MessageCircle = getIcon("communication", "conversation")

interface CommentsButtonProps {
  entity: CommentEntityRef
  title?: string
  description?: string
  className?: string
  /** Accessible label when there is no visible count text. */
  label?: string
  /**
   * When provided (e.g. from a batched `useCommentCounts`), skips the
   * per-entity count query.
   */
  count?: number
  /** Compact icon button for dense layouts like table rows. */
  compact?: boolean
}

export function CommentsButton({
  entity,
  title,
  description,
  className,
  label = "Comentarios",
  count: countProp,
  compact = false,
}: CommentsButtonProps) {
  const [open, setOpen] = useState(false)
  const fetched = useCommentCount(countProp === undefined ? entity : null)
  const count = countProp ?? fetched.count

  const buttonLabel = count > 0 ? `${label}: ${count}` : label
  const button = (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={cn("text-muted-foreground", compact && "relative", className)}
      aria-label={buttonLabel}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setOpen(true)
      }}
    >
      <MessageCircle
        data-icon={compact ? undefined : "inline-start"}
        className={count > 0 ? "fill-current" : undefined}
        aria-hidden="true"
      />
      {compact ? (
        count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null
      ) : (
        <span>{count > 0 ? count : label}</span>
      )}
    </Button>
  )

  return (
    <>
      {compact ? <Hint label={buttonLabel}>{button}</Hint> : button}
      {/*
       * Radix's Sheet/Dialog portals its content to document.body, but React
       * still bubbles its synthetic events through the *component* tree, not
       * the DOM tree — so clicks inside the sheet (send, delete, close,
       * overlay) would otherwise reach whatever clickable ancestor rendered
       * this button (a card that navigates, a row that expands, ...). The
       * `contents` wrapper stops that bubbling here without affecting layout.
       */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: not user-interactive, just an event-bubbling boundary for the portaled sheet content */}
      <span
        className="contents"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <CommentsSheet
          open={open}
          onOpenChange={setOpen}
          entity={open ? entity : null}
          title={title}
          description={description}
        />
      </span>
    </>
  )
}
