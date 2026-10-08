import type { ReactNode } from "react"
import { StateCard } from "@/components/shared/feedback/state-card"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"

/** Shared "the id in the URL isn't valid" state for detail pages. */
export function InvalidRouteId({
  icon,
  title,
  description,
  backHref,
  backLabel,
}: {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  backHref: string
  backLabel: ReactNode
}) {
  return (
    <StateCard
      icon={icon}
      title={title}
      description={description}
      action={
        <Button
          variant="outline"
          render={<AppLink href={backHref} />}
          nativeButton={false}
        >
          {backLabel}
        </Button>
      }
    />
  )
}
