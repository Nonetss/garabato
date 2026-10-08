import type { ComponentProps } from "react"
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
