import type { User } from "better-auth"
import { getIcon } from "@/lib/icon-registry"

const ArrowLeft = getIcon("navigation", "back")
const ChevronDown = getIcon("controls", "expand")
const LogOut = getIcon("actions", "logout")

import { Collapsible } from "@base-ui/react/collapsible"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Text } from "@/components/shared/brand/typography"
import { UserAvatar } from "@/components/shared/user/avatar"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import { navigate } from "@/lib/navigate"
import { adminSidebarLinks } from "@/lib/site-nav"
import { userDisplayName } from "@/lib/user-display"

function isLinkActive(href: string, currentPath: string) {
  return href === "/admin"
    ? currentPath === "/admin"
    : currentPath.startsWith(href)
}

interface AppSidebarProps {
  nameApp: string
  currentPath: string
  user: User
}

export function AppSidebar({ nameApp, currentPath, user }: AppSidebarProps) {
  const displayName = userDisplayName(user)
  const email = typeof user.email === "string" ? user.email : null

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate("/login")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <AppLink
                  href="/admin"
                  className="gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                />
              }
            >
              <AppLogo alt={nameApp} size={24} className="shrink-0" />
              <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                {nameApp}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminSidebarLinks.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={isLinkActive(href, currentPath)}
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Collapsible.Root className="group/collapsible">
              <Collapsible.Trigger
                render={<SidebarMenuButton size="lg" tooltip={displayName} />}
              >
                <UserAvatar
                  displayName={displayName}
                  email={email}
                  size="sm"
                  className="shrink-0"
                />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  {email ? (
                    <Text variant="compact" tone="muted" className="truncate">
                      {email}
                    </Text>
                  ) : null}
                </div>
                <ChevronDown className="ml-auto size-4 shrink-0 transition-transform group-data-open/collapsible:rotate-180" />
              </Collapsible.Trigger>
              <Collapsible.Panel>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={
                        <Button
                          type="button"
                          onClick={handleSignOut}
                          variant="link"
                          className="w-full justify-start"
                        />
                      }
                    >
                      <LogOut />
                      <span>Cerrar sesión</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </Collapsible.Panel>
            </Collapsible.Root>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Volver a la app"
              render={<AppLink href="/" />}
            >
              <ArrowLeft />
              <span>Volver a la app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
