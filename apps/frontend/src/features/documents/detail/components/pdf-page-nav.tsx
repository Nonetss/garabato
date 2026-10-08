import { Text } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
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

/** First / previous / next / last controls along the bottom of the viewer. */
export function PdfPageNav({ current, count, onGoTo }: PdfPageNavProps) {
  const atFirst = current <= 0
  const atLast = current >= count - 1
  return (
    <nav
      aria-label="Páginas del documento"
      className="sticky bottom-0 z-10 flex shrink-0 items-center justify-center gap-0.5 rounded-b-lg border-t bg-background/90 py-1 backdrop-blur"
    >
      <IconButton
        className="rounded-full"
        label="Primera página"
        icon={FirstIcon}
        disabled={atFirst}
        onClick={() => onGoTo(0)}
      />
      <IconButton
        className="rounded-full"
        label="Página anterior"
        icon={PreviousIcon}
        disabled={atFirst}
        onClick={() => onGoTo(current - 1)}
      />
      <Text
        as="span"
        variant="compact"
        tone="muted"
        className="min-w-16 px-1 text-center tabular-nums"
        aria-live="polite"
      >
        {current + 1} / {count}
      </Text>
      <IconButton
        className="rounded-full"
        label="Página siguiente"
        icon={NextIcon}
        disabled={atLast}
        onClick={() => onGoTo(current + 1)}
      />
      <IconButton
        className="rounded-full"
        label="Última página"
        icon={LastIcon}
        disabled={atLast}
        onClick={() => onGoTo(count - 1)}
      />
    </nav>
  )
}
