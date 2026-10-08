import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type SuggestInputItem = {
  key: string
  value: string
  label: string
  detail?: string | null
}

/**
 * Type-ahead text input with a suggestion dropdown, for filter fields where
 * the typed text is itself a valid value — unlike `SearchableCombobox`,
 * choosing a suggestion is optional, not required. Callers own the
 * suggestion source (a query hook, `textSuggestions` over already-loaded
 * data…) and pass the current candidate list in; this component only owns
 * the dropdown UI and keyboard behavior (debounced typing is the caller's
 * responsibility, arrow-key navigation, Enter/Escape, click-outside are
 * built in).
 *
 * The dropdown renders through a portal to `document.body` with `position:
 * fixed`, so it escapes any ancestor `overflow-hidden` (e.g. an
 * `AccordionContent` inside `CollapsibleFilters`) and local stacking
 * contexts instead of being clipped to the field's height.
 */
export function SuggestInput({
  id,
  value,
  onValueChange,
  onSuggestionSelect,
  suggestions,
  isLoading = false,
  minChars = 2,
  labelStyle = "mono",
  placeholder,
  ariaLabel,
  className,
  required = false,
  type = "text",
  inputMode,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  onSuggestionSelect?: (value: string) => void
  suggestions: SuggestInputItem[]
  isLoading?: boolean
  minChars?: number
  labelStyle?: "mono" | "medium"
  placeholder?: string
  ariaLabel?: string
  className?: string
  required?: boolean
  type?: "text" | "number"
  inputMode?: "text" | "numeric" | "search"
}) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const listId = useId()
  const visible = open && value.trim().length >= minChars
  const activeSuggestion = suggestions[highlightedIndex]

  useEffect(() => {
    setHighlightedIndex(0)
  }, [suggestions])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  // Recompute the dropdown position on open and on every scroll/resize: the
  // input can live inside a container with its own internal scroll region,
  // so a `window`-only listener would fall short.
  useEffect(() => {
    if (!visible) {
      setDropdownPos(null)
      return
    }
    const container = containerRef.current
    if (!container) return

    const update = () => {
      const input = container.querySelector("input")
      if (!input) return
      const rect = input.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [visible])

  const choose = (suggestion: SuggestInputItem) => {
    onValueChange(suggestion.value)
    setOpen(false)
    onSuggestionSelect?.(suggestion.value)
  }

  const showDropdown =
    visible && dropdownPos !== null && (isLoading || suggestions.length > 0)

  const dropdown = showDropdown ? (
    <div
      id={listId}
      role="listbox"
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
      }}
      className="z-50 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {isLoading ? (
        <Text as="p" variant="compact" tone="muted" className="px-3 py-2">
          Buscando sugerencias…
        </Text>
      ) : (
        suggestions.map((suggestion, index) => (
          <button
            key={suggestion.key}
            id={`${listId}-${index}`}
            type="button"
            role="option"
            aria-selected={index === highlightedIndex}
            className={cn(
              textVariants({ role: "compact" }),
              "flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2 text-left outline-none transition-colors",
              index === highlightedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/60"
            )}
            onMouseEnter={() => setHighlightedIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
          >
            <span
              className={cn(
                "w-full truncate",
                labelStyle === "medium" ? "font-medium" : "font-mono"
              )}
            >
              {suggestion.label}
            </span>
            {suggestion.detail ? (
              <Text variant="meta-sm" tone="muted" className="w-full truncate">
                {suggestion.detail}
              </Text>
            ) : null}
          </button>
        ))
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        className={cn(className)}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={visible ? listId : undefined}
        aria-expanded={visible}
        aria-activedescendant={
          visible && activeSuggestion
            ? `${listId}-${highlightedIndex}`
            : undefined
        }
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (!visible || suggestions.length === 0) {
            if (event.key === "Escape") setOpen(false)
            return
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlightedIndex((index) =>
              Math.min(index + 1, suggestions.length - 1)
            )
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlightedIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === "Enter" && activeSuggestion) {
            event.preventDefault()
            choose(activeSuggestion)
          } else if (event.key === "Escape") {
            event.preventDefault()
            setOpen(false)
          }
        }}
      />
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  )
}
