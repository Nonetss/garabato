import type { ComponentProps } from "react"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const LoadingIcon = getIcon("status", "loading")

interface SpinnerProps extends ComponentProps<"svg"> {
  /**
   * Hide the spinner from assistive technology. Use it when the surrounding
   * control or card already says it is busy ("Entrando…", a "Cargando…"
   * title), so the state isn't announced twice.
   */
  decorative?: boolean
}

function Spinner({ className, decorative = false, ...props }: SpinnerProps) {
  const classes = cn("size-4 animate-spin", className)

  if (decorative) {
    return <LoadingIcon aria-hidden="true" className={classes} {...props} />
  }
  return (
    <LoadingIcon
      role="status"
      aria-label="Cargando"
      className={classes}
      {...props}
    />
  )
}

export { Spinner }
