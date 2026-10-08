import { Text } from "@/components/shared/brand/typography"
import { useThemeMode } from "@/hooks/use-theme-mode"
import { themeModeOptions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeModeSelector() {
  const { mode, setMode } = useThemeMode()

  return (
    <div className="@container">
      <div
        role="radiogroup"
        aria-label="Tema"
        className="grid grid-cols-1 gap-3 @lg:grid-cols-3"
      >
        {themeModeOptions.map((option) => {
          const Icon = option.icon
          const selected = option.value === mode

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-2 rounded-md border p-4 transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <input
                type="radio"
                name="theme-mode"
                value={option.value}
                checked={selected}
                onChange={() => {}}
                onClick={(event) =>
                  setMode(option.value, { x: event.clientX, y: event.clientY })
                }
                className="sr-only"
              />
              <Icon
                className={cn(
                  "size-5",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden
              />
              <Text variant="title">{option.label}</Text>
              <Text variant="compact" tone="muted">
                {option.description}
              </Text>
            </label>
          )
        })}
      </div>
    </div>
  )
}
