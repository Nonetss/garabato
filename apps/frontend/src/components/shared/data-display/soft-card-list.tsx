import type { ComponentProps, ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { cn } from "@/lib/utils"

type DivProps = ComponentProps<"div">
type UlProps = ComponentProps<"ul">

interface SoftCardListDivProps extends DivProps {
  as?: "div"
}

interface SoftCardListUlProps extends UlProps {
  as: "ul"
}

/**
 * Quiet-editorial row-of-cards container. Hairline-bordered, `bg-card/40`,
 * `divide-y` between children — replaces the recurring
 * `overflow-hidden rounded-xl border bg-card/40 divide-y` pattern across the
 * list and detail surfaces.
 *
 * Use as `<ul>` when the children are `<li>` (e.g. organization member lists);
 * default `<div>` is fine for everything else.
 */
export function SoftCardList(
  props: SoftCardListDivProps | SoftCardListUlProps
) {
  const { as = "div", className, children, ...rest } = props
  const classes = cn(
    "overflow-hidden rounded-xl border bg-card/40 divide-y",
    className
  )

  if (as === "ul") {
    return (
      <ul className={classes} {...(rest as UlProps)}>
        {children}
      </ul>
    )
  }
  return (
    <div className={classes} {...(rest as DivProps)}>
      {children}
    </div>
  )
}

export type SoftCardListItemDensity = "default" | "dense"

export interface SoftCardListItemProps {
  /** Avatar or icon tile before the text. */
  leading?: ReactNode
  /** The row's name, set in the `title` role. */
  title: ReactNode
  /** Secondary line under the title (muted `compact`, tabular digits). */
  description?: ReactNode
  /** Optional third line, e.g. a signature's stated reason. */
  note?: ReactNode
  /** Controls or a count after the text: an `IconButton`, a role select. */
  trailing?: ReactNode
  /** `dense` for rows inside sheets and dialog sections; `default` for page sections. */
  density?: SoftCardListItemDensity
  /** Truncate the title and description to one line each instead of wrapping. */
  truncate?: boolean
  /**
   * Makes the whole row a button that calls this (the trailing controls stay
   * their own buttons). Its accessible name is the title.
   */
  onSelect?: () => void
  /** Marks the row as the chosen one (`aria-current` on its button). */
  selected?: boolean
}

/**
 * The title, or, on a selectable row, a button around it whose `::after`
 * stretches over the row so the whole row answers the pointer.
 */
function RowTitle({
  title,
  onSelect,
  selected,
}: Pick<SoftCardListItemProps, "title" | "onSelect"> & { selected: boolean }) {
  if (!onSelect) return title
  const current = selected ? "true" : undefined
  return (
    <button
      type="button"
      aria-current={current}
      onClick={onSelect}
      className="cursor-pointer text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
    >
      {title}
    </button>
  )
}

const itemPadding: Record<SoftCardListItemDensity, string> = {
  default: "px-4 py-3",
  dense: "px-3 py-2.5",
}

/**
 * A compact row of a `SoftCardList as="ul"`: leading avatar or icon, a title
 * over muted secondary lines, and trailing controls. The structure is owned
 * here; callers pass content for each slot.
 */
export function SoftCardListItem({
  leading,
  title,
  description,
  note,
  trailing,
  density = "default",
  truncate = false,
  onSelect,
  selected = false,
}: SoftCardListItemProps) {
  const lineClass = truncate ? "truncate" : undefined

  return (
    <li
      className={cn(
        "flex items-center gap-3",
        itemPadding[density],
        onSelect && "relative transition-colors hover:bg-accent/40",
        selected && "bg-accent/60 hover:bg-accent/60"
      )}
    >
      {leading}
      <div className="min-w-0 flex-1 space-y-0.5">
        <Text as="p" variant="title" className={lineClass}>
          <RowTitle title={title} onSelect={onSelect} selected={selected} />
        </Text>
        {description ? (
          <Text
            as="p"
            variant="compact"
            tone="muted"
            className={cn("tabular-nums", lineClass)}
          >
            {description}
          </Text>
        ) : null}
        {note ? (
          <Text as="p" variant="compact" tone="muted">
            {note}
          </Text>
        ) : null}
      </div>
      {/* `relative` keeps the trailing controls above a selectable row's
          stretched button. */}
      {trailing ? (
        <div className="relative flex shrink-0 items-center gap-3">
          {trailing}
        </div>
      ) : null}
    </li>
  )
}
