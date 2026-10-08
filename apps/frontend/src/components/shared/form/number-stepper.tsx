import { getIcon } from "@/lib/icon-registry"

const ChevronLeft = getIcon("controls", "chevronLeft")
const ChevronRight = getIcon("controls", "chevronRight")

import { type KeyboardEvent, useState } from "react"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wrap(value: number, min: number, max: number) {
  const span = max - min + 1
  return min + ((((value - min) % span) + span) % span)
}

/** Numeric dial that supports typing, wheel input, arrow keys and wrapping. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (next: number) => onChange(wrap(next, min, max))

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        event.preventDefault()
        commit(value + 1)
        break
      case "ArrowDown":
      case "ArrowLeft":
        event.preventDefault()
        commit(value - 1)
        break
      case "PageUp":
        event.preventDefault()
        commit(value + 5)
        break
      case "PageDown":
        event.preventDefault()
        commit(value - 5)
        break
      case "Home":
        event.preventDefault()
        commit(min)
        break
      case "End":
        event.preventDefault()
        commit(max)
        break
      case "Enter":
        event.preventDefault()
        event.currentTarget.blur()
        break
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot host this compact dial layout.
    <div
      role="group"
      aria-label={label}
      onWheel={(event) => {
        event.preventDefault()
        commit(value + (event.deltaY < 0 ? 1 : -1))
      }}
      className="flex h-9 items-center rounded-md border border-input bg-transparent"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label}: disminuir`}
        onClick={() => commit(value - 1)}
        className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value).padStart(2, "0")}
        onChange={(event) => {
          setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))
        }}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          if (draft !== null && draft !== "") {
            commit(clamp(Number(draft), min, max))
          }
          setDraft(null)
        }}
        onKeyDown={handleKeyDown}
        className="w-full min-w-0 flex-1 rounded-sm border-0 bg-transparent text-center font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label}: aumentar`}
        onClick={() => commit(value + 1)}
        className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
