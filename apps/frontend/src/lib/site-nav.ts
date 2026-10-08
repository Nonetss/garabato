import type { ComponentType } from "react"
import {
  type AppSurface,
  appSurfaceList,
  appSurfaces,
  getChildSurfaces,
  getNavigableSurfaces,
  isSurfacePathActive,
} from "@/lib/app-surfaces"
import { resolveIconRef } from "@/lib/icon-registry"

export type SiteNavIconComponent = ComponentType<{ className?: string }>

export interface SiteNavSubItem {
  href: string
  label: string
  description: string
  icon: SiteNavIconComponent
}

export interface SiteNavItem {
  href: string
  label: string
  description: string
  icon: SiteNavIconComponent
  /** Hidden from the navbar/overview cards unless the user is an admin. */
  adminOnly?: boolean
  /**
   * Rendered inline in the segmented navbar row at `lg` (1024–1279px).
   * Non-primary items collapse into the "Más" overflow trigger at `lg` and
   * rejoin the row at `xl+`, once there's enough room for everything.
   */
  primary?: boolean
  /** Subroutes of this section: navbar dropdown, section sidebar and cards. */
  subItems?: SiteNavSubItem[]
}

/** True when `pathname` is exactly `href` or a nested route under it. */
export const isNavLinkActive = isSurfacePathActive

function navItemHrefs(item: Pick<SiteNavItem, "href" | "subItems">) {
  return [item.href, ...(item.subItems?.map((sub) => sub.href) ?? [])]
}

/**
 * The most specific href in `hrefs` that matches `pathname`. A child like
 * `/config/appearance` wins over its parent `/config`, so only one
 * row in a section is current at a time.
 */
function getCurrentNavHref(pathname: string, hrefs: readonly string[]) {
  let current: string | undefined
  for (const href of hrefs) {
    if (!isNavLinkActive(href, pathname)) continue
    if (current == null || href.length > current.length) current = href
  }
  return current
}

/**
 * Whether a top-level navbar item is the current location.
 * Nested pages still highlight a leaf section (`/crons/[id]` → Crons); a
 * parent with `subItems` stays idle when a child is the better match.
 */
export function isNavItemCurrent(
  item: Pick<SiteNavItem, "href" | "subItems">,
  pathname: string
) {
  return getCurrentNavHref(pathname, navItemHrefs(item)) === item.href
}

/** Whether a dropdown/mobile sub-route is the current location. */
export function isNavSubItemCurrent(
  href: string,
  pathname: string,
  item: Pick<SiteNavItem, "href" | "subItems">
) {
  return getCurrentNavHref(pathname, navItemHrefs(item)) === href
}

function toSubItem(surface: AppSurface): SiteNavSubItem {
  return {
    href: surface.path,
    label: surface.label,
    description: surface.description,
    icon: resolveIconRef(surface.icon),
  }
}

function toNavItem(surface: AppSurface): SiteNavItem {
  const children = getChildSurfaces(surface.id)
  return {
    href: surface.path,
    label: surface.label,
    description: surface.description,
    icon: resolveIconRef(surface.icon),
    adminOnly: surface.adminOnly,
    primary: surface.nav?.primary,
    subItems: children.length > 0 ? children.map(toSubItem) : undefined,
  }
}

/**
 * Single source of truth for site navigation: navbar (desktop + mobile),
 * section sidebars and section landing pages all read from here. Projected
 * from `app-surfaces.ts` — register a new navigable surface there, not here.
 *
 * A section that declares `subItems` gets, for free: a hover dropdown in the
 * desktop navbar, a nested group in the mobile menu, a `SectionSidebar` (mount
 * it with the `WithSidebar` layout) and a `SectionNavOverview` landing page.
 *
 * Icons are React components, so they cannot cross the Astro island boundary as
 * props — consumers mounted with `client:only` must import this module directly
 * and receive only primitives (`currentPath`, `isAdmin`) from the layout.
 */
export const siteNavItems: SiteNavItem[] = appSurfaceList
  .filter((surface) => surface.nav)
  .map(toNavItem)

export function getSiteNavItemByHref(href: string) {
  return siteNavItems.find((item) => item.href === href)
}

/**
 * Section hub for a `WithSidebar` route (`/config/profile` → `/config`).
 * Longest prefix among nav items that declare `subItems`.
 */
export function getSidebarSection(pathname: string): string | undefined {
  let match: string | undefined
  for (const item of siteNavItems) {
    if (!item.subItems?.length) continue
    if (!isNavLinkActive(item.href, pathname)) continue
    if (!match || item.href.length > match.length) match = item.href
  }
  return match
}

/** Sections visible to the current user; `adminOnly` entries need an admin. */
export function getSiteNavItems(isAdmin: boolean) {
  return getNavigableSurfaces(isAdmin).map(toNavItem)
}

export interface SiteNavSearchItem {
  href: string
  label: string
  description: string
  icon: SiteNavIconComponent
  /** Label of the group the item is listed under, matched like its own text. */
  section: string
  /**
   * Labels of the sections above the item, outermost first, shown before its
   * label (`Configuración › Apariencia`) and matched like its own text.
   */
  trail?: string[]
  /** Extra terms matched like its own text (e.g. a record's surface label). */
  keywords?: string[]
}

export interface SiteNavSearchGroup {
  label: string
  items: SiteNavSearchItem[]
}

const GENERAL_SEARCH_GROUP = "General"

/** Labels of `surface`'s parent chain, outermost first. */
function getParentTrail(surface: AppSurface): string[] {
  const trail: string[] = []
  let parentId = surface.parentId
  while (parentId != null) {
    const parent = appSurfaces[parentId]
    trail.unshift(parent.label)
    parentId = parent.parentId
  }
  return trail
}

function isSearchableSurface(surface: AppSurface, isAdmin: boolean) {
  if (surface.path.includes("[")) return false
  if (surface.search === false) return false
  return !surface.adminOnly || isAdmin
}

/**
 * Destinations for the navbar surface search, projected from `app-surfaces`:
 * every concrete-path surface the user may see (no dynamic `[param]` routes,
 * no `search: false`, `adminOnly` only for admins). Top-level surfaces
 * without children share a leading "General" group; each section with
 * children gets its own group, hub first, in registry order.
 */
export function getSearchableSurfaces(isAdmin: boolean): SiteNavSearchGroup[] {
  const general: SiteNavSearchGroup = { label: GENERAL_SEARCH_GROUP, items: [] }
  const sections = new Map<string, SiteNavSearchGroup>()

  for (const surface of appSurfaceList) {
    if (!isSearchableSurface(surface, isAdmin)) continue
    const sectionId = surface.parentId ?? surface.id
    const hasGroup =
      surface.parentId != null || getChildSurfaces(surface.id).length > 0
    let group = general
    if (hasGroup) {
      const label = appSurfaces[sectionId].label
      group = sections.get(sectionId) ?? { label, items: [] }
      sections.set(sectionId, group)
    }
    group.items.push({
      href: surface.path,
      label: surface.label,
      description: surface.description,
      icon: resolveIconRef(surface.icon),
      section: group.label,
      trail: getParentTrail(surface),
    })
  }

  return [general, ...sections.values()].filter(
    (group) => group.items.length > 0
  )
}

/**
 * The most specific searchable href that matches `pathname`, so the search
 * marks `/config/appearance` — not also `/config` — as current.
 */
export function getCurrentSearchHref(
  pathname: string,
  groups: readonly SiteNavSearchGroup[]
) {
  return getCurrentNavHref(
    pathname,
    groups.flatMap((group) => group.items.map((item) => item.href))
  )
}

export interface AdminSidebarLink {
  href: string
  label: string
  icon: SiteNavIconComponent
}

/**
 * Links for the `/admin` section's own sidebar
 * (`features/admin/shell/components/app-sidebar.tsx`). Reuses the `/admin`
 * surface's children so routes/labels/icons aren't duplicated; only
 * "Resumen" (the section's own overview page) is added on top, since it
 * isn't a child surface — child surfaces drive the navbar dropdown, and a
 * child pointing back at the parent's own href would double up as "active"
 * there.
 */
const adminNavItem = getSiteNavItemByHref("/admin")
export const adminSidebarLinks: AdminSidebarLink[] = [
  {
    href: "/admin",
    label: "Resumen",
    icon: resolveIconRef(appSurfaces.admin.icon),
  },
  ...(adminNavItem?.subItems ?? []),
]
