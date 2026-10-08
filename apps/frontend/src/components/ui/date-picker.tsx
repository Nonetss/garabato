import { getIcon } from "@/lib/icon-registry"

const CalendarIcon = getIcon("scheduling", "calendar")

import type { VariantProps } from "class-variance-authority"
import { lazy, Suspense, useState } from "react"
import { Button, type buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const importCalendarPanel = () => import("@/components/ui/calendar-panel")

const CalendarPanel = lazy(importCalendarPanel)

interface DatePickerProps {
  value?: Date
  onChange: (next: Date | undefined) => void
  placeholder?: string
  className?: string
  "aria-label"?: string
  /**
   * Trigger button height. `"default"` (h-9) matches a bare `<Input>` so the
   * picker aligns with other controls in a filter row; `"sm"` (h-8) reads as
   * a quieter inline trigger when paired with smaller surrounding UI.
   */
  size?: VariantProps<typeof buttonVariants>["size"]
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  "aria-label": ariaLabel,
  size = "default",
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const label = value ? formatDate(value) : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            className={cn(
              "justify-start gap-2 font-normal",
              !label && "text-muted-foreground",
              className
            )}
            aria-label={ariaLabel ?? placeholder}
            // Intent beats the click: the month grid is fetched while the
            // pointer is still travelling, so the popover opens already drawn.
            onPointerEnter={importCalendarPanel}
            onFocus={importCalendarPanel}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        <span className="truncate">{label || placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Suspense fallback={<div className="h-[17.5rem] w-[15.5rem]" />}>
          <CalendarPanel
            selected={value}
            onSelect={(date) => {
              onChange(date)
              setOpen(false)
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  )
}
