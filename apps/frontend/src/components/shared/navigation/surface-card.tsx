import { getIcon } from "@/lib/icon-registry"

const ArrowUpRight = getIcon("navigation", "openSection")
const ChevronRight = getIcon("controls", "next")

import { Text, textVariants } from "@/components/shared/brand/typography"
import { AppLink } from "@/components/ui/app-link"
import type { SiteNavItem, SiteNavSubItem } from "@/lib/site-nav"
import { cn } from "@/lib/utils"

/**
 * Registry-driven card data: a top-level `SiteNavItem` (may carry
 * `subItems` rendered as "Accesos directos" shortcuts) or a `SiteNavSubItem`
 * (a leaf destination with no shortcuts of its own). Both project from
 * `app-surfaces.ts` via `site-nav.ts`.
 */
export type SurfaceCardItem = SiteNavItem | SiteNavSubItem

function getShortcuts(item: SurfaceCardItem): SiteNavSubItem[] | undefined {
  if (!("subItems" in item)) return undefined
  return item.subItems && item.subItems.length > 0 ? item.subItems : undefined
}

/**
 * One destination tile: icon beside label and description, then — for
 * surfaces with subroutes — a bordered two-column grid of shortcut links to
 * its children. Leaf surfaces show a chevron beside the label instead of a
 * footer. The description always reserves two lines, so the footer border
 * lands at the same height in every tile of a grid row and the spare space of
 * a shorter tile sits at its bottom rather than between description and
 * shortcuts. Replaces the previously separate `SiteNavCard` (home) and
 * `SectionNavCard` (section overview) implementations — both rendered the
 * same tile shape from the same navigation data.
 */
export function SurfaceCard({
  item,
  className,
}: {
  item: SurfaceCardItem
  className?: string
}) {
  const Icon = item.icon
  const shortcuts = getShortcuts(item)

  return (
    <article
      className={cn(
        "group dash-enter relative flex flex-col gap-3 rounded-xl border bg-card/40 p-4",
        "transition-colors duration-200 hover:border-foreground/15 hover:bg-muted has-focus-visible:border-foreground/15 has-focus-visible:bg-muted",
        className
      )}
    >
      <AppLink
        href={item.href}
        aria-label={item.label}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-2.5">
        <span aria-hidden className="shrink-0 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as="h2" variant="headline" className="truncate">
            {item.label}
          </Text>
          <Text
            as="p"
            variant="meta"
            tone="muted"
            className="line-clamp-2 min-h-[3.25em] leading-relaxed"
          >
            {item.description}
          </Text>
        </div>
        {shortcuts ? null : (
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        )}
      </div>

      {shortcuts ? (
        <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-1.5 border-t pt-2.5">
          {shortcuts.map((shortcut) => {
            const ShortcutIcon = shortcut.icon

            return (
              <AppLink
                key={shortcut.href}
                href={shortcut.href}
                className={cn(
                  textVariants({ role: "compact" }),
                  "pointer-events-auto flex h-7 min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 font-medium text-foreground/80 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                )}
              >
                <ShortcutIcon
                  className="size-3.5 shrink-0 opacity-80"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {shortcut.label}
                </span>
                <ArrowUpRight
                  className="size-3 shrink-0 opacity-60"
                  aria-hidden
                />
              </AppLink>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

/** Responsive grid of `SurfaceCard` tiles — the shared card/grid API for home
 *  and section overview pages. */
export function SurfaceCardGrid({
  items,
  className,
}: {
  items: SurfaceCardItem[]
  className?: string
}) {
  // Container queries: columns follow the space the grid gets (sidebar open
  // or collapsed, `PageShell` width), not the viewport.
  return (
    <div className={cn("@container", className)}>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 @min-[90rem]:grid-cols-5">
        {items.map((item) => (
          <SurfaceCard key={item.href} item={item} />
        ))}
      </div>
    </div>
  )
}
