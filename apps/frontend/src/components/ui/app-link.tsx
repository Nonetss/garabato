import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type MouseEvent,
} from "react"
import { navigate } from "@/lib/navigate"

type AppLinkProps = ComponentPropsWithoutRef<"a"> & {
  href: string
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}

/** Internal link that uses Astro View Transitions via {@link navigate}. */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink({ href, onClick, target, ...props }, ref) {
    const isExternal = target === "_blank" || /^https?:\/\//.test(href)

    return (
      <a
        ref={ref}
        href={href}
        target={target}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || isModifiedClick(event) || isExternal) {
            return
          }
          event.preventDefault()
          navigate(href)
        }}
        {...props}
      />
    )
  }
)

/**
 * Like {@link AppLink}, but an unmodified left-click goes back in history
 * (same as Alt+Left). `href` is the fallback when there is nothing to go
 * back to, and for open-in-new-tab / middle-click.
 */
export const AppBackLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppBackLink({ onClick, ...props }, ref) {
    return (
      <AppLink
        ref={ref}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || isModifiedClick(event)) return
          if (window.history.length > 1) {
            event.preventDefault()
            window.history.back()
          }
        }}
        {...props}
      />
    )
  }
)
