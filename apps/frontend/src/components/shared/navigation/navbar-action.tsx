import type { ComponentPropsWithoutRef } from "react"
import { AppLink } from "@/components/ui/app-link"
import { cn } from "@/lib/utils"

const navbarActionStyles =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground outline-none transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none aria-expanded:border-primary/30 aria-expanded:bg-accent aria-expanded:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 lg:size-9"

export function NavbarAction({
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type={type}
      className={cn(navbarActionStyles, className)}
      {...props}
    />
  )
}

export function NavbarActionLink({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AppLink>) {
  return <AppLink className={cn(navbarActionStyles, className)} {...props} />
}
