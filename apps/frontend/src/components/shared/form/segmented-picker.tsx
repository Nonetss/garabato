import { textVariants } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { cn } from "@/lib/utils"

export interface SegmentedPickerOption<T extends string> {
  value: T
  label: string
  /** Full name for an abbreviated `label`: shown in a `Hint` and used as the cell's `aria-label`. */
  title?: string
}

/** Compact single-select grid for short, finite sets of values. */
export function SegmentedPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
  mono = false,
}: {
  label: string
  options: readonly SegmentedPickerOption<T>[]
  value: T
  onChange: (value: T) => void
  columns: number
  mono?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value
        const cell = (
          // biome-ignore lint/a11y/useSemanticElements: native radios cannot carry this compact cell treatment.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              textVariants({ role: "compact" }),
              "flex h-8 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              mono && "font-mono tabular-nums",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
        return option.title ? (
          <Hint key={option.value} label={option.title}>
            {cell}
          </Hint>
        ) : (
          cell
        )
      })}
    </div>
  )
}
