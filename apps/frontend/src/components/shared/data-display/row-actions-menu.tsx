import { getIcon } from "@/lib/icon-registry"

const MoreHorizontal = getIcon("views", "overflowMenu")

import type { ReactNode } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface RowActionsMenuProps {
  label?: string
  disabled?: boolean
  children: ReactNode
}

/**
 * The kebab-menu trigger for a list row: ghost icon button that fades in on
 * row hover/focus, opening a DropdownMenu. One canonical instance so the
 * fade-in opacity classes and aria-label default stay identical everywhere.
 */
export function RowActionsMenu({
  label = "Acciones",
  disabled,
  children,
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <Hint label={label}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              disabled={disabled}
              className="size-10 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 md:size-9"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
