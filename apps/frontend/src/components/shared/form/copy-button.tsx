import { getIcon } from "@/lib/icon-registry"

const Check = getIcon("controls", "check")
const Copy = getIcon("actions", "copy")

import { IconButton } from "@/components/shared/form/icon-button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { notifySuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"

export type CopyButtonSize = "icon-xs" | "icon" | "icon-sm"

interface CopyButtonProps {
  /** Text to write to the clipboard. */
  text: string
  /** ARIA label when idle. The "copied" label is `idleLabel` prefixed with the verb. */
  label: string
  /** Label announced when in the `copied` state. Defaults to `{label} (copiado)`. */
  copiedLabel?: string
  /** When `true`, also show a success toast. */
  showSuccessToast?: boolean
  /** Error toast message; pass `false` to silence. */
  onError?: string | false
  /** Visual size. Defaults to `"icon-xs"`. */
  size?: CopyButtonSize
  /** Visual treatment. Defaults to `"ghost"`. */
  variant?: "ghost" | "outline"
  className?: string
}

/**
 * One-tap clipboard button. Owns the icon-swap, aria-label/`Hint` flip, transient
 * "copied" state, and timer cleanup. Pass `text` (the payload) and `label`
 * (the idle affordance); everything else is a sensible default.
 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  showSuccessToast = false,
  onError,
  size = "icon-xs",
  variant = "ghost",
  className,
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard({ onError })

  const onClick = async () => {
    const ok = await copy(text)
    if (ok && showSuccessToast) {
      notifySuccess("Copiada al portapapeles")
    }
  }

  const Icon = copied ? Check : Copy
  const displayedLabel = copied ? (copiedLabel ?? `${label} (copiado)`) : label
  const iconClassName = size === "icon-xs" ? "size-3.5" : "size-4"

  return (
    <IconButton
      label={displayedLabel}
      icon={Icon}
      iconClassName={iconClassName}
      variant={variant}
      size={size}
      onClick={onClick}
      className={cn("text-muted-foreground", className)}
    />
  )
}
