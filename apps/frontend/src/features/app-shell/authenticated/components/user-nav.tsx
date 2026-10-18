import type { User } from "better-auth"
import { getIcon } from "@/lib/icon-registry"

const LogIn = getIcon("auth", "loginAction")
const LogOut = getIcon("actions", "logout")
const OpenExternal = getIcon("actions", "openExternal")
const UserCircle2 = getIcon("identity", "userCircle")
const UserIcon = getIcon("identity", "userIcon")

import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import {
  NavbarAction,
  NavbarActionLink,
} from "@/components/shared/navigation/navbar-action"
import { UserAvatar } from "@/components/shared/user/avatar"
import { AppLink } from "@/components/ui/app-link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useReleaseStatus } from "@/features/app-shell/authenticated/hooks/use-release-status"
import { authClient } from "@/lib/auth-client"
import { navigate } from "@/lib/navigate"
import { userDisplayName } from "@/lib/user-display"

export interface UserNavProps {
  user: User | null
}

export function UserNav({ user }: UserNavProps) {
  const release = useReleaseStatus(user !== null)
  const update = release.data?.update ?? null
  const triggerLabel = update
    ? `Menú de cuenta (versión ${update.version} disponible)`
    : "Menú de cuenta"

  if (!user) {
    return (
      <Hint label="Iniciar sesión" side="bottom">
        <NavbarActionLink href="/login" aria-label="Iniciar sesión">
          <LogIn className="size-4 shrink-0" aria-hidden />
        </NavbarActionLink>
      </Hint>
    )
  }

  const displayName = userDisplayName(user)
  const email = typeof user.email === "string" ? user.email : null

  return (
    <DropdownMenu>
      <Hint label="Menú de cuenta" side="bottom">
        <DropdownMenuTrigger
          render={
            <NavbarAction aria-label={triggerLabel} className="relative" />
          }
        >
          <UserIcon className="size-4 shrink-0" aria-hidden />
          {update ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-2.5 py-0.5">
              <UserAvatar displayName={displayName} email={email} size="sm" />
              <div className="min-w-0 flex-1">
                <Text
                  as="p"
                  variant="title"
                  className="truncate text-foreground leading-tight"
                >
                  {displayName}
                </Text>
                {email ? (
                  <Text
                    as="p"
                    variant="compact"
                    tone="muted"
                    className="mt-0.5 truncate leading-tight"
                  >
                    {email}
                  </Text>
                ) : null}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem render={<AppLink href="/me" />}>
          <UserCircle2 className="size-4 shrink-0" aria-hidden />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2"
          onClick={async () => {
            await authClient.signOut()
            navigate("/login")
          }}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
        {release.data ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <Text as="p" variant="compact" tone="muted">
                  Versión {release.data.current}
                </Text>
              </DropdownMenuLabel>
              {update ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-primary"
                  render={
                    <a
                      href={update.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <OpenExternal className="size-4 shrink-0" aria-hidden />
                  Versión {update.version} disponible
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
