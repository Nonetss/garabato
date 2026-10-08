import { useRef, useState } from "react"
import {
  InputGroup,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

const FIELD_COUNT = 5
const PREFIX = 4
const LABELS = [
  "Octeto 1",
  "Octeto 2",
  "Octeto 3",
  "Octeto 4",
  "Prefijo",
] as const

const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/

function maxDigits(index: number) {
  return index === PREFIX ? 2 : 3
}

function cap(index: number) {
  return index === PREFIX ? 32 : 255
}

function sanitize(index: number, raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, maxDigits(index))
  if (digits === "") return ""
  return Number(digits) > cap(index) ? String(cap(index)) : digits
}

function splitCidr(value: string): string[] {
  const match = value.trim().match(CIDR_RE)
  if (!match) return ["", "", "", "", ""]
  return [1, 2, 3, 4, 5].map((group) => match[group] ?? "")
}

function joinCidr(parts: string[]): string {
  if (parts.some((part) => part === "")) return ""
  const octets = parts.slice(0, 4).map((part) => String(Number(part)))
  const prefix = Number(parts[PREFIX])
  if (octets.some((part) => Number(part) > 255) || prefix > 32) {
    return ""
  }
  return `${octets.join(".")}/${prefix}`
}

/** Pull a CIDR out of a paste — dotted, spaced, or mixed. */
function partsFromPaste(text: string): string[] | null {
  const trimmed = text.trim()
  const exact = splitCidr(trimmed.replace(/\s+/g, ""))
  if (joinCidr(exact)) return exact

  const chunks = trimmed.split(/[^\d]+/).filter(Boolean)
  if (chunks.length < 4) return null

  return [0, 1, 2, 3, 4].map((index) => sanitize(index, chunks[index] ?? ""))
}

function isDigitKey(key: string) {
  return key.length === 1 && key >= "0" && key <= "9"
}

/**
 * One field that already shows the dots and the slash, so a phone
 * never asks you to hunt for `.` on the keyboard.
 */
export function CidrInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string
  value: string
  onChange: (cidr: string) => void
  disabled?: boolean
}) {
  const [parts, setParts] = useState(() => splitCidr(value))
  const [prevValue, setPrevValue] = useState(value)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== joinCidr(parts)) setParts(splitCidr(value))
  }

  function commit(next: string[]) {
    setParts(next)
    const cidr = joinCidr(next)
    onChange(cidr)
    setPrevValue(cidr)
  }

  function focusAt(index: number) {
    const el = refs.current[index]
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  }

  function handlePaste(text: string, startIndex: number) {
    const pasted = partsFromPaste(text)
    if (pasted) {
      commit(pasted)
      const last = pasted.findLastIndex((part) => part !== "")
      focusAt(last === -1 ? 0 : Math.min(last, PREFIX))
      return
    }

    const digits = text.replace(/\D/g, "")
    if (!digits) return
    applyDigits(startIndex, digits)
  }

  function applyDigits(startIndex: number, digits: string) {
    const next = [...parts]
    let rest = digits
    let index = startIndex
    while (index < FIELD_COUNT && rest.length > 0) {
      const take = rest.slice(0, maxDigits(index))
      rest = rest.slice(maxDigits(index))
      next[index] = sanitize(index, take)
      index++
    }
    commit(next)
    focusAt(Math.min(index, PREFIX))
  }

  return (
    <InputGroup
      className="h-11 px-1 shadow-none"
      data-disabled={disabled || undefined}
      onPointerDown={(event) => {
        if (!(event.target instanceof Element)) return
        if (event.target.closest("input")) return
        event.preventDefault()
        const empty = parts.indexOf("")
        focusAt(empty === -1 ? 0 : empty)
      }}
    >
      {parts.flatMap((part, index) => {
        const isPrefix = index === PREFIX
        const field = (
          <InputGroupInput
            key={LABELS[index]}
            ref={(el) => {
              refs.current[index] = el
            }}
            id={index === 0 ? id : undefined}
            aria-label={LABELS[index]}
            type="text"
            value={part}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={maxDigits(index)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={isPrefix ? "done" : "next"}
            className={cn(
              "h-11 min-w-0 flex-1 px-0.5 text-center font-mono",
              "text-base tabular-nums md:text-base"
            )}
            onPaste={(event) => {
              event.preventDefault()
              handlePaste(event.clipboardData.getData("text"), index)
            }}
            onChange={(event) => {
              const next = [...parts]
              const filled = sanitize(index, event.target.value)
              next[index] = filled
              commit(next)
              if (filled.length >= maxDigits(index) && index < PREFIX) {
                focusAt(index + 1)
              }
            }}
            onKeyDown={(event) => {
              const el = event.currentTarget
              const atStart = (el.selectionStart ?? 0) === 0
              const atEnd = (el.selectionStart ?? 0) === el.value.length
              const hasSelection = el.selectionStart !== el.selectionEnd

              if (
                event.key === "." ||
                event.key === " " ||
                (event.key === "/" && !isPrefix)
              ) {
                event.preventDefault()
                if (index < PREFIX) focusAt(index + 1)
                return
              }

              if (event.key === "Enter" && !isPrefix) {
                event.preventDefault()
                focusAt(index + 1)
                return
              }

              if (
                event.key === "ArrowLeft" &&
                atStart &&
                !hasSelection &&
                !event.shiftKey &&
                index > 0
              ) {
                event.preventDefault()
                focusAt(index - 1)
                return
              }

              if (
                event.key === "ArrowRight" &&
                atEnd &&
                !hasSelection &&
                !event.shiftKey &&
                index < PREFIX
              ) {
                event.preventDefault()
                focusAt(index + 1)
                return
              }

              if (event.key === "Backspace" && el.value === "" && index > 0) {
                event.preventDefault()
                const prev = index - 1
                const next = [...parts]
                next[prev] = (next[prev] ?? "").slice(0, -1)
                commit(next)
                focusAt(prev)
                return
              }

              if (
                isDigitKey(event.key) &&
                !hasSelection &&
                el.value.length >= maxDigits(index) &&
                index < PREFIX
              ) {
                event.preventDefault()
                applyDigits(index + 1, event.key)
              }
            }}
          />
        )

        if (index === 0) return [field]

        return [
          <InputGroupText
            key={isPrefix ? "slash" : `dot-${index}`}
            aria-hidden
            className="shrink-0 px-0.5 font-mono text-base text-muted-foreground"
          >
            {isPrefix ? "/" : "."}
          </InputGroupText>,
          field,
        ]
      })}
    </InputGroup>
  )
}
