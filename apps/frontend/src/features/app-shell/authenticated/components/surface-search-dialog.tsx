import { useEffect, useMemo, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { StatusDot } from "@/components/shared/data-display/status-dot"
import { MenuItemText } from "@/components/shared/navigation/menu-item-text"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { DialogClose } from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { SurfaceSearchFooter } from "@/features/app-shell/authenticated/components/surface-search-footer"
import { SurfaceSearchLabel } from "@/features/app-shell/authenticated/components/surface-search-label"
import { useSurfaceSearchRecords } from "@/features/app-shell/authenticated/hooks/use-surface-search-records"
import { foldText } from "@/lib/fold-text"
import { getIcon } from "@/lib/icon-registry"
import { navigate } from "@/lib/navigate"
import { readRecentSurfaces, recordRecentSurface } from "@/lib/recent-surfaces"
import {
  getCurrentSearchHref,
  getSearchableSurfaces,
  type SiteNavSearchItem,
} from "@/lib/site-nav"

export interface SurfaceSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  currentPath: string
  /** Scopes the recently visited list stored in `localStorage`. */
  userId: string
}

const RECENT_PREFIX = "recent:"

const SearchIcon = getIcon("views", "search")

/** Group headings stay pinned while their group scrolls under them. */
const GROUP_CLASS =
  "overflow-visible **:[[cmdk-group-heading]]:sticky **:[[cmdk-group-heading]]:top-0 **:[[cmdk-group-heading]]:z-10 **:[[cmdk-group-heading]]:bg-popover"

function groupHeading(label: string) {
  return (
    <Text variant="label" tone="muted">
      {label}
    </Text>
  )
}

/**
 * Every word of the query must be a substring of one of the item's folded
 * keywords (label, description, section, trail, extra keywords), so
 * "crons limpieza" finds that job. The score stays binary so cmdk keeps the
 * render order, and with it the order a server search returned.
 */
function matchSurface(_value: string, search: string, keywords?: string[]) {
  const words = foldText(search).split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  const folded = (keywords ?? []).map(foldText)
  return words.every((word) => folded.some((keyword) => keyword.includes(word)))
    ? 1
    : 0
}

/**
 * Command palette that jumps to any surface from `app-surfaces`, opened from
 * the navbar triggers or with ⌘K / Ctrl+K. Owns the shortcut listener so the
 * navbar mounts exactly one per page, and records every searchable page the
 * user lands on so an empty query suggests the recent ones first. Once the
 * user types, it also lists the records behind dynamic surfaces (cron jobs,
 * custom collections), loaded while the dialog is open or, for sources
 * listed in pages, searched on the server for the settled text.
 */
export function SurfaceSearchDialog({
  open,
  onOpenChange,
  isAdmin,
  currentPath,
  userId,
}: SurfaceSearchDialogProps) {
  const groups = useMemo(() => getSearchableSurfaces(isAdmin), [isAdmin])
  const itemsByHref = useMemo(
    () =>
      new Map(
        groups.flatMap((group) =>
          group.items.map((item) => [item.href, item] as const)
        )
      ),
    [groups]
  )
  const [search, setSearch] = useState("")
  const recordGroups = useSurfaceSearchRecords({
    isAdmin,
    enabled: open,
    search,
  })
  // Records take part so `/crons/<id>` marks that job, not `/crons`.
  const currentHref = getCurrentSearchHref(currentPath, [
    ...groups,
    ...recordGroups,
  ])
  const [recentHrefs, setRecentHrefs] = useState(() =>
    readRecentSurfaces(userId)
  )

  // Only exact visits count: `/crons/42` is not a visit to `/crons`.
  useEffect(() => {
    if (!itemsByHref.has(currentPath)) return
    setRecentHrefs(recordRecentSurface(userId, currentPath))
  }, [currentPath, itemsByHref, userId])

  // Hrefs no longer searchable (removed route, lost admin role) are skipped.
  const recentItems = recentHrefs
    .filter((href) => href !== currentHref)
    .flatMap((href) => itemsByHref.get(href) ?? [])
  const hasQuery = search.trim() !== ""
  const showRecent = !hasQuery && recentItems.length > 0

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      event.preventDefault()
      handleOpenChange(!open)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  })

  function handleOpenChange(next: boolean) {
    if (!next) setSearch("")
    onOpenChange(next)
  }

  function handleSelect(value: string) {
    const href = value.startsWith(RECENT_PREFIX)
      ? value.slice(RECENT_PREFIX.length)
      : value
    // Close first so the dialog's portal is gone before the View Transition
    // swaps the page.
    handleOpenChange(false)
    if (href !== currentHref) navigate(href)
  }

  function renderItem(item: SiteNavSearchItem, value: string) {
    const current = item.href === currentHref
    return (
      <CommandItem
        key={value}
        value={value}
        keywords={[
          item.label,
          item.description,
          item.section,
          ...(item.trail ?? []),
          ...(item.keywords ?? []),
        ]}
        onSelect={handleSelect}
        className="group gap-3"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors group-data-[selected=true]:bg-primary">
          <item.icon
            aria-hidden
            className="size-4 text-primary transition-colors group-data-[selected=true]:text-primary-foreground"
          />
        </span>
        <MenuItemText
          label={<SurfaceSearchLabel label={item.label} trail={item.trail} />}
          description={item.description}
        />
        {current ? (
          <>
            <StatusDot tone="primary" className="shrink-0" />
            <span className="sr-only">(página actual)</span>
          </>
        ) : null}
        <Kbd
          aria-hidden
          className="hidden group-data-[selected=true]:inline-flex"
        >
          ↵
        </Kbd>
      </CommandItem>
    )
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Buscar páginas"
      description="Escribe para encontrar una página y pulsa Intro para ir a ella."
      filter={matchSurface}
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Buscar páginas…"
        value={search}
        onValueChange={setSearch}
      >
        <DialogClose
          aria-label="Cerrar búsqueda"
          className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:[&>kbd]:text-foreground"
        >
          <Kbd>esc</Kbd>
        </DialogClose>
      </CommandInput>
      <CommandList className="max-h-[min(60vh,440px)] scroll-pt-9 p-1">
        <CommandEmpty className="py-10">
          <Empty className="gap-0 p-0 md:p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon aria-hidden className="size-5" />
              </EmptyMedia>
              <EmptyTitle className={textVariants({ role: "title" })}>
                Sin resultados para «{search.trim()}»
              </EmptyTitle>
              <EmptyDescription
                className={textVariants({ role: "meta", tone: "muted" })}
              >
                Prueba con otra palabra o con el nombre de la sección.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CommandEmpty>
        {showRecent ? (
          <CommandGroup
            heading={groupHeading("Recientes")}
            className={GROUP_CLASS}
          >
            {recentItems.map((item) =>
              renderItem(item, `${RECENT_PREFIX}${item.href}`)
            )}
          </CommandGroup>
        ) : null}
        {groups.map((group) => (
          <CommandGroup
            key={group.label}
            heading={groupHeading(group.label)}
            className={GROUP_CLASS}
          >
            {group.items.map((item) => renderItem(item, item.href))}
          </CommandGroup>
        ))}
        {hasQuery
          ? recordGroups.map((group) => (
              <CommandGroup
                key={group.label}
                heading={groupHeading(group.label)}
                className={GROUP_CLASS}
              >
                {group.items.map((item) => renderItem(item, item.href))}
              </CommandGroup>
            ))
          : null}
      </CommandList>
      <SurfaceSearchFooter />
    </CommandDialog>
  )
}
