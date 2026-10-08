import { AppLink } from "@/components/ui/app-link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { SiteNavIcon } from "@/features/app-shell/sidebar/components/site-nav-icon"
import { usePathname } from "@/hooks/use-pathname"
import { getIcon } from "@/lib/icon-registry"
import {
  getSidebarSection,
  getSiteNavItemByHref,
  isNavLinkActive,
} from "@/lib/site-nav"

const PanelLeftIcon = getIcon("views", "sidebar")

interface SectionSidebarProps {
  /** Heading above the subroute list. */
  groupLabel?: string
}

/**
 * Sidebar for any `siteNavItems` section that declares `subItems`.
 * Header, labels and icons all come from `site-nav.ts` — never hardcode them here.
 * Path/section are read from the URL so a persist island stays current.
 */
export function SectionSidebar({
  groupLabel = "Gestión",
}: SectionSidebarProps) {
  const currentPath = usePathname()
  const { state, toggleSidebar } = useSidebar()
  const section = getSidebarSection(currentPath)
  const item = section ? getSiteNavItemByHref(section) : undefined
  if (!item?.subItems) return null

  return (
    <Sidebar
      collapsible="icon"
      className="top-(--navbar-height) h-[calc(100svh-var(--navbar-height))]!"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={item.label}
              render={
                <AppLink
                  href={item.href}
                  className="gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                />
              }
            >
              <SiteNavIcon
                href={item.href}
                className="size-4 shrink-0 text-primary"
              />
              <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                {item.label}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {item.subItems.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={isNavLinkActive(href, currentPath)}
                    tooltip={label}
                    render={<AppLink href={href} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Below `md` the sidebar is an off-canvas sheet; the footer toggle is desktop-only. */}
      <SidebarFooter className="hidden md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Extender menú"
              className="text-muted-foreground"
              onClick={toggleSidebar}
            >
              <PanelLeftIcon />
              <span>
                {state === "collapsed" ? "Extender menú" : "Contraer menú"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
