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
}: SoftCardListItemProps) {
  const lineClass = truncate ? "truncate" : undefined

  return (
    <li className={cn("flex items-center gap-3", itemPadding[density])}>
      {leading}
      <div className="min-w-0 flex-1 space-y-0.5">
        <Text as="p" variant="title" className={lineClass}>
          {title}
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
      {trailing ? (
        <div className="flex shrink-0 items-center gap-3">{trailing}</div>
      ) : null}
    </li>
  )
}
