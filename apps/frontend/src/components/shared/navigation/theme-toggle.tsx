import { textVariants } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { MenuItemText } from "@/components/shared/navigation/menu-item-text"
import { NavbarAction } from "@/components/shared/navigation/navbar-action"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useThemeMode } from "@/hooks/use-theme-mode"
import { getIcon } from "@/lib/icon-registry"
import { type ThemeMode, themeModeOptions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const Check = getIcon("controls", "checkIcon")

export interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useThemeMode()
  const CurrentIcon =
    themeModeOptions.find((option) => option.value === mode)?.icon ??
    themeModeOptions[0].icon

  function handleSelect(next: ThemeMode, event: React.MouseEvent<HTMLElement>) {
    const origin =
      typeof event.clientX === "number" && typeof event.clientY === "number"
        ? { x: event.clientX, y: event.clientY }
        : undefined
    setMode(next, origin)
  }

  return (
    <DropdownMenu>
      <Hint label="Cambiar tema" side="bottom">
        <DropdownMenuTrigger
          render={
            <NavbarAction aria-label="Cambiar tema" className={className} />
          }
        >
          <CurrentIcon className="size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 min-w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel
            className={textVariants({ role: "label", tone: "muted" })}
          >
            Tema
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mb-1" />
          {themeModeOptions.map((option) => {
            const Icon = option.icon
            const active = option.value === mode
            return (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  "group/item flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2",
                  active && "bg-primary/5"
                )}
                onClick={(event) => handleSelect(option.value, event)}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <MenuItemText
                  label={option.label}
                  description={option.description}
                />
                {active ? (
                  <Check
                    className="size-3.5 shrink-0 text-primary"
                    aria-hidden
                  />
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
