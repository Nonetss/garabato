import type { ComponentProps } from "react"
import { AppLink } from "@/components/ui/app-link"
import {
  NavigationMenuLink,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

const navbarPillStyles =
  "inline-flex h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const navbarPillActiveStyles = "bg-primary/10 text-primary"
const navbarPillIdleStyles =
  "text-muted-foreground hover:bg-muted/40 hover:text-foreground"

type NavbarPillLinkProps = Omit<
  ComponentProps<typeof NavigationMenuLink>,
  "active" | "render"
> & {
  href: string
  active?: boolean
}

export function NavbarPillLink({
  href,
  active = false,
  className,
  ...props
}: NavbarPillLinkProps) {
  return (
    <NavigationMenuLink
      active={active}
      render={<AppLink href={href} />}
      className={cn(
        navbarPillStyles,
        active ? navbarPillActiveStyles : navbarPillIdleStyles,
        className
      )}
      {...props}
    />
  )
}

type NavbarPillTriggerProps = ComponentProps<typeof NavigationMenuTrigger> & {
  active?: boolean
}

export function NavbarPillTrigger({
  active = false,
  className,
  ...props
}: NavbarPillTriggerProps) {
  return (
    <NavigationMenuTrigger
      className={cn(
        navbarPillStyles,
        active ? navbarPillActiveStyles : navbarPillIdleStyles,
        className
      )}
      {...props}
    />
  )
}
