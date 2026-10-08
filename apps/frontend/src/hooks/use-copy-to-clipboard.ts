import { useCallback, useEffect, useRef, useState } from "react"
import { notifyError } from "@/lib/toast"

export interface UseCopyToClipboardOptions {
  /** How long the "copied" state lingers before resetting, in ms. */
  resetMs?: number
  /** Optional toast message when the copy fails. Pass `false` to silence. */
  onError?: string | false
}

export interface UseCopyToClipboardResult {
  copy: (text: string) => Promise<boolean>
  copied: boolean
}

/**
 * Write text to the clipboard and expose a transient "copied" flag that
 * auto-resets after `resetMs`. The reset is timer-cleaned so unmounting
 * during the window doesn't leak.
 *
 * On failure the hook notifies via `notifyError` by default; pass
 * `onError: false` to silence or `onError: "…"` to override the message.
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardResult {
  const { resetMs = 2000, onError } = options
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current)
        }
        timerRef.current = window.setTimeout(() => {
          setCopied(false)
          timerRef.current = null
        }, resetMs)
        return true
      } catch {
        if (onError !== false) {
          notifyError(onError ?? "No se pudo copiar")
        }
        return false
      }
    },
    [resetMs, onError]
  )

  return { copy, copied }
}
