import type { User } from "better-auth"
import { useState } from "react"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { StatusDot } from "@/components/shared/data-display/status-dot"
import { MenuItemText } from "@/components/shared/navigation/menu-item-text"
import {
  NavbarPillLink,
  NavbarPillTrigger,
} from "@/components/shared/navigation/navbar-pill"
import { ThemeToggle } from "@/components/shared/navigation/theme-toggle"
import { AppLink } from "@/components/ui/app-link"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Separator } from "@/components/ui/separator"
import { NavbarMobileMenu } from "@/features/app-shell/authenticated/components/navbar-mobile-menu"
import { NavbarSearchTrigger } from "@/features/app-shell/authenticated/components/navbar-search-trigger"
import { SurfaceSearchDialog } from "@/features/app-shell/authenticated/components/surface-search-dialog"
import { UserNav } from "@/features/app-shell/authenticated/components/user-nav"
import { usePathname } from "@/hooks/use-pathname"
import { useScrolled } from "@/hooks/use-scrolled"
import {
  getSiteNavItems,
  isNavItemCurrent,
  isNavLinkActive,
  isNavSubItemCurrent,
  type SiteNavItem,
} from "@/lib/site-nav"
import { cn } from "@/lib/utils"
import { QueryProvider } from "@/providers/query-provider"

export interface NavbarAuthenticatedProps {
  user: User
  nameApp: string
  isAdmin?: boolean
}

function menuIconClass(active: boolean) {
  return cn(
    "size-3.5 shrink-0",
    active ? "text-primary" : "text-muted-foreground"
  )
}

/** Sub-route or section-hub row inside a section's `NavigationMenuContent`. */
const MENU_ROW =
  "group/item flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-foreground/80 outline-none transition-colors hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground data-active:bg-primary/10 data-active:text-primary"

interface SectionLinkProps {
  item: SiteNavItem
  current: boolean
  className?: string
}

/** A plain pill for a section with no sub-routes. */
function SectionLink({ item, current, className }: SectionLinkProps) {
  return (
    <NavigationMenuItem className={className}>
      <NavbarPillLink href={item.href} active={current}>
        {item.label}
        {current ? <StatusDot tone="primary" /> : null}
      </NavbarPillLink>
    </NavigationMenuItem>
  )
}

interface SectionMenuProps {
  item: SiteNavItem
  current: boolean
  currentPath: string
  className?: string
}

/**
 * A `NavigationMenuTrigger` for any `SiteNavItem` with sub-routes — opens on
 * hover or focus, sharing the menu's single animated viewport.
 *
 * The first row is the "section hub" — the section's canonical icon, name
 * and description, sitting on a `bg-primary/5` wash so it reads as the
 * overview rather than another sub-route. A hairline separator then divides
 * the hub from the specific sub-routes below.
 */
function SectionMenu({
  item,
  current,
  currentPath,
  className,
}: SectionMenuProps) {
  // The trigger pill represents the whole section, so it — and its dot —
  // stay lit for any sub-route, not just the exact hub href that `current`
  // tracks for the dropdown's own hub row below.
  const sectionActive = isNavLinkActive(item.href, currentPath)
  return (
    <NavigationMenuItem className={className}>
      <NavbarPillTrigger active={sectionActive}>
        {item.label}
        {sectionActive ? <StatusDot tone="primary" /> : null}
      </NavbarPillTrigger>
      <NavigationMenuContent className="min-w-64">
        <NavigationMenuLink
          active={current}
          closeOnClick
          render={<AppLink href={item.href} />}
          className={cn(MENU_ROW, "min-h-11")}
        >
          <item.icon aria-hidden className={menuIconClass(current)} />
          <MenuItemText label={item.label} description={item.description} />
        </NavigationMenuLink>
        <Separator className="my-1" />
        {item.subItems?.map((sub) => {
          const active = isNavSubItemCurrent(sub.href, currentPath, item)
          return (
            <NavigationMenuLink
              key={sub.href}
              active={active}
              closeOnClick
              render={<AppLink href={sub.href} />}
              className={MENU_ROW}
            >
              <sub.icon aria-hidden className={menuIconClass(active)} />
              <MenuItemText label={sub.label} description={sub.description} />
            </NavigationMenuLink>
          )
        })}
      </NavigationMenuContent>
    </NavigationMenuItem>
  )
}

interface OverflowMenuProps {
  items: SiteNavItem[]
  currentPath: string
}

/**
 * At `lg` (1024–1279px) only the `primary` pills fit in the segmented row;
 * the remaining sections reach the visitor through this "Más" trigger. At
 * `xl+` the rest join the pill row directly and this trigger is hidden.
 */
function OverflowMenu({ items, currentPath }: OverflowMenuProps) {
  if (items.length === 0) return null

  return (
    <NavigationMenuItem className="hidden lg:block xl:hidden">
      <NavbarPillTrigger aria-label="Más secciones">Más</NavbarPillTrigger>
      <NavigationMenuContent className="min-w-60">
        {items.map((item) => {
          const active = isNavItemCurrent(item, currentPath)
          return (
            <NavigationMenuLink
              key={item.href}
              active={active}
              closeOnClick
              render={<AppLink href={item.href} />}
              className={MENU_ROW}
            >
              <item.icon aria-hidden className={menuIconClass(active)} />
              <MenuItemText label={item.label} description={item.description} />
            </NavigationMenuLink>
          )
        })}
      </NavigationMenuContent>
    </NavigationMenuItem>
  )
}

function NavSectionItem({
  item,
  currentPath,
  className,
}: {
  item: SiteNavItem
  currentPath: string
  className?: string
}) {
  const current = isNavItemCurrent(item, currentPath)

  if (item.subItems && item.subItems.length > 0) {
    return (
      <SectionMenu
        item={item}
        current={current}
        currentPath={currentPath}
        className={className}
      />
    )
  }

  return <SectionLink item={item} current={current} className={className} />
}

export function NavbarAuthenticated({
  user,
  nameApp,
  isAdmin = false,
}: NavbarAuthenticatedProps) {
  // Read from site-nav directly: icons are components and cannot be passed as
  // props across the Astro island boundary.
  const navLinks = getSiteNavItems(isAdmin) as SiteNavItem[]
  // Non-primary sections collapse into "Más" at `lg`. At `xl+` every item
  // renders inline and the overflow trigger is hidden.
  const restNavLinks = navLinks.filter((item) => item.primary !== true)
  const currentPath = usePathname()
  const scrolled = useScrolled()
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = () => setSearchOpen(true)

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] bg-background/80 backdrop-blur transition-shadow duration-300 supports-backdrop-filter:bg-background/60",
        scrolled ? "border-border shadow-sm" : "border-border/40"
      )}
    >
      <nav
        aria-label="Navegación principal"
        className="flex h-navbar w-full items-center justify-between gap-3 px-4 md:gap-4 md:px-6 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-x-8 xl:gap-x-10"
      >
        <AppLink
          href="/"
          className="group flex shrink-0 items-center gap-2 font-semibold text-foreground text-sm tracking-tight lg:justify-self-start"
        >
          <AppLogo
            alt={nameApp}
            className="transition-transform duration-300 group-hover:scale-110"
          />
          <span className="hidden sm:inline">{nameApp}</span>
        </AppLink>

        {/* Desktop: lg+ - segmented nav (NavigationMenu) */}
        <div className="hidden min-w-0 items-center gap-6 lg:flex lg:justify-self-start">
          <Separator orientation="vertical" className="h-5 w-px self-center" />
          <NavigationMenu align="center" className="max-w-none">
            <NavigationMenuList className="gap-1">
              {navLinks.map((item) => (
                <NavSectionItem
                  key={item.href}
                  item={item}
                  currentPath={currentPath}
                  className={
                    item.primary === true ? undefined : "hidden xl:block"
                  }
                />
              ))}
              <OverflowMenu items={restNavLinks} currentPath={currentPath} />
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile/tablet: < lg - mobile menu */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
          <ThemeToggle />
          <UserNav user={user} />
          <NavbarSearchTrigger variant="icon" onOpen={openSearch} />
          <NavbarMobileMenu navLinks={navLinks} currentPath={currentPath} />
        </div>

        {/* Desktop: lg+ actions */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex lg:justify-self-end">
          <NavbarSearchTrigger variant="field" onOpen={openSearch} />
          <ThemeToggle />
          <UserNav user={user} />
        </div>
      </nav>
      {/* The search reads record lists through the browser-wide query client,
          sharing its cache with the page islands. */}
      <QueryProvider>
        <SurfaceSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          isAdmin={isAdmin}
          currentPath={currentPath}
          userId={user.id}
        />
      </QueryProvider>
    </header>
  )
}
