import { type KeyboardEvent, type SyntheticEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const Send = getIcon("actions", "send")

interface CommentFormProps {
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  autoFocus?: boolean
  compact?: boolean
  isPending?: boolean
  onSubmit: (content: string) => Promise<unknown> | unknown
  onCancel?: () => void
  className?: string
}

export function CommentForm({
  placeholder = "Escribe un comentario...",
  submitLabel = "Publicar",
  initialValue = "",
  autoFocus = false,
  compact = false,
  isPending = false,
  onSubmit,
  onCancel,
  className,
}: CommentFormProps) {
  const [content, setContent] = useState(initialValue)
  const trimmed = content.trim()
  const canSubmit = trimmed.length > 0 && !isPending

  const submit = async () => {
    if (!canSubmit) return
    await onSubmit(trimmed)
    setContent("")
  }

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    await submit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    void submit()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-2", className)}
    >
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={isPending}
        rows={compact ? 2 : 3}
        maxLength={4000}
        aria-label={placeholder}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isPending ? (
            <Spinner decorative data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
