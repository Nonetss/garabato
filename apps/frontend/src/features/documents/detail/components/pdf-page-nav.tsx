import type { ComponentType } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import { getIcon } from "@/lib/icon-registry"

const FirstIcon = getIcon("controls", "first")
const PreviousIcon = getIcon("controls", "previous")
const NextIcon = getIcon("controls", "next")
const LastIcon = getIcon("controls", "last")

interface PdfPageNavProps {
  /** Zero-based index of the page being read. */
  current: number
  count: number
  onGoTo: (index: number) => void
}

function NavButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Hint label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className="size-4" />
      </Button>
    </Hint>
  )
}

/** First / previous / next / last controls along the bottom of the viewer. */
export function PdfPageNav({ current, count, onGoTo }: PdfPageNavProps) {
  const atFirst = current <= 0
  const atLast = current >= count - 1
  return (
    <nav
      aria-label="Páginas del documento"
      className="sticky bottom-0 z-10 flex shrink-0 items-center justify-center gap-0.5 rounded-b-lg border-t bg-background/90 py-1 backdrop-blur"
    >
      <NavButton
        label="Primera página"
        icon={FirstIcon}
        disabled={atFirst}
        onClick={() => onGoTo(0)}
      />
      <NavButton
        label="Página anterior"
        icon={PreviousIcon}
        disabled={atFirst}
        onClick={() => onGoTo(current - 1)}
      />
      <Text
        as="span"
        variant="meta-sm"
        tone="muted"
        className="min-w-16 px-1 text-center tabular-nums"
        aria-live="polite"
      >
        {current + 1} / {count}
      </Text>
      <NavButton
        label="Página siguiente"
        icon={NextIcon}
        disabled={atLast}
        onClick={() => onGoTo(current + 1)}
      />
      <NavButton
        label="Última página"
        icon={LastIcon}
        disabled={atLast}
        onClick={() => onGoTo(count - 1)}
      />
    </nav>
  )
}
