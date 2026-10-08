import { getIcon } from "@/lib/icon-registry"

const Check = getIcon("controls", "check")
const ChevronDown = getIcon("controls", "expand")

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { foldText } from "@/lib/fold-text"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  keywords?: string
}

interface SearchableComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange: (next: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allLabel?: string
  className?: string
  "aria-label"?: string
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  allLabel = "Todas",
  className,
  "aria-label": ariaLabel,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const active = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-pressed={active}
            aria-label={ariaLabel ?? placeholder}
            className={cn(
              "min-w-48 max-w-96 justify-between gap-1.5 font-normal",
              active
                ? "border-primary/35 bg-primary/5 text-foreground hover:bg-primary/10"
                : "text-muted-foreground",
              className
            )}
          />
        }
      >
        <span className="truncate">
          {selected?.label ?? (value ? value : placeholder)}
        </span>
        <ChevronDown className="size-3.5 opacity-50" data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width)! p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            foldText(itemValue).includes(foldText(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
              >
                <Check className={cn("opacity-0", !value && "opacity-100")} />
                {allLabel}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "opacity-0",
                      value === option.value && "opacity-100"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
