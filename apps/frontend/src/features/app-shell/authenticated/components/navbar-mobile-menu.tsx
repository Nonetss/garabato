import { getIcon } from "@/lib/icon-registry"

const Menu = getIcon("controls", "menu")

import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { textVariants } from "@/components/shared/brand/typography"
import { NavbarAction } from "@/components/shared/navigation/navbar-action"
import { AppLink } from "@/components/ui/app-link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { SiteNavItem } from "@/lib/site-nav"
import { isNavLinkActive, isNavSubItemCurrent } from "@/lib/site-nav"
import { cn } from "@/lib/utils"

interface NavbarMobileMenuProps {
  navLinks: SiteNavItem[]
  currentPath: string
}

export function NavbarMobileMenu({
  navLinks,
  currentPath,
}: NavbarMobileMenuProps) {
  const [open, setOpen] = useState(false)

  // Navbar is `transition:persist`ed. If the sheet portal is still in the DOM
  // when Astro swaps the page, body scroll-lock + overlay race the view
  // transition and the sticky header jumps. Tear it down before the swap.
  useEffect(() => {
    const forceClose = () => {
      flushSync(() => setOpen(false))
    }
    document.addEventListener("astro:before-preparation", forceClose)
    document.addEventListener("astro:before-swap", forceClose)
    document.addEventListener("astro:page-load", forceClose)
    return () => {
      document.removeEventListener("astro:before-preparation", forceClose)
      document.removeEventListener("astro:before-swap", forceClose)
      document.removeEventListener("astro:page-load", forceClose)
    }
  }, [])

  // Close synchronously on click so the portal is gone before `navigate()`
  // kicks off the view transition — same reason as the swap listeners above.
  const closeBeforeNavigate = () => {
    flushSync(() => setOpen(false))
  }

  return (
    <div className="shrink-0 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <NavbarAction
              aria-label="Abrir menú de navegación"
              aria-haspopup="dialog"
            />
          }
        >
          <Menu className="size-4 shrink-0" aria-hidden />
        </SheetTrigger>
        {/* Mount content only while open so close unmounts the portal
            immediately — no exit animation racing View Transitions. */}
        {open ? (
          <SheetContent
            side="right"
            className="gap-0 border-border bg-popover p-0 text-popover-foreground data-closed:animate-none sm:max-w-xs [&>button]:top-3.5 [&>button]:text-muted-foreground hover:[&>button]:text-foreground"
          >
            <SheetHeader className="shrink-0 border-border border-b px-4 py-4 text-left">
              <SheetTitle className="font-mono font-semibold text-popover-foreground text-sm tracking-wide">
                Navegación principal
              </SheetTitle>
            </SheetHeader>
            <nav
              className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3"
              aria-label="Enlaces principales"
            >
              {navLinks.map(({ href, label, icon: Icon, subItems }, i) => {
                // The section row stays lit for any of its sub-routes
                // (`/config/appearance` → Configuración), like the
                // desktop pill; only the sub-rows pick the exact match.
                const isActive = isNavLinkActive(href, currentPath)
                return (
                  <div
                    key={href}
                    className="dash-enter flex flex-col gap-0.5"
                    style={{ "--dash-delay": `${i * 45}ms` } as CSSProperties}
                  >
                    <AppLink
                      href={href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={closeBeforeNavigate}
                    >
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                        />
                      ) : null}
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {label}
                    </AppLink>

                    {subItems ? (
                      <div className="ml-3.5 flex flex-col gap-0.5 border-border border-l py-0.5 pl-2.5">
                        {subItems.map((sub) => {
                          const subActive = isNavSubItemCurrent(
                            sub.href,
                            currentPath,
                            { href, subItems }
                          )
                          return (
                            <AppLink
                              key={sub.href}
                              href={sub.href}
                              className={cn(
                                textVariants({ role: "compact" }),
                                "flex items-center gap-2 rounded-md px-2.5 py-2 font-medium transition-colors",
                                subActive
                                  ? "text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              onClick={closeBeforeNavigate}
                            >
                              <sub.icon
                                aria-hidden
                                className={cn(
                                  "size-3.5 shrink-0",
                                  subActive
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              />
                              {sub.label}
                            </AppLink>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </nav>
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  )
}
