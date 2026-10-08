import { getIcon } from "@/lib/icon-registry"

const CircleCheckIcon = getIcon("status", "success")
const InfoIcon = getIcon("status", "info")
const Loader2Icon = getIcon("status", "loading")
const OctagonXIcon = getIcon("status", "error")
const TriangleAlertIcon = getIcon("security", "warning")

import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// The theme system is manual (theme-toggle flips the `dark` class on <html>),
// so the toaster tracks that class instead of a theme provider.
function subscribeToThemeClass(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

function getTheme(): ToasterProps["theme"] {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(
    subscribeToThemeClass,
    getTheme,
    () => "light" as const
  )

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
