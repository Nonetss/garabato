import { useState } from "react"
import { useOnOpen } from "@/hooks/use-on-open"

/**
 * Owns a form dialog's field state: seeds from `empty` merged with `initial`
 * exactly once per open (via `useOnOpen`, which re-reads `initial` on every
 * `false -> true` transition — so reopening always reseeds from whatever the
 * caller's current `initial` is, not a stale closure), exposes a per-field
 * setter, field-level errors that clear themselves as their field changes,
 * and a `trimmed()` snapshot that trims every string-valued field for submit.
 */
export function useDialogForm<TValues extends object>(
  open: boolean,
  empty: TValues,
  initial?: Partial<TValues>
) {
  const seed = () => ({ ...empty, ...initial })
  const [values, setValues] = useState<TValues>(seed)
  const [errors, setErrors] = useState<Partial<Record<keyof TValues, string>>>(
    {}
  )

  useOnOpen(open, () => {
    setValues(seed())
    setErrors({})
  })

  function set<K extends keyof TValues>(key: K, value: TValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function setError<K extends keyof TValues>(key: K, message: string) {
    setErrors((current) => ({ ...current, [key]: message }))
  }

  function clearErrors() {
    setErrors({})
  }

  function reset() {
    setValues(seed())
    setErrors({})
  }

  function trimmed(): TValues {
    const result = { ...values }
    for (const key of Object.keys(result) as (keyof TValues)[]) {
      const value = result[key]
      if (typeof value === "string") {
        result[key] = value.trim() as TValues[typeof key]
      }
    }
    return result
  }

  /**
   * Key-safe `{ value, error, onChange }` triple for one field — the adapter
   * declarative field controls bind against instead of writing their own
   * `value`/`onChange`/error-wiring per field.
   */
  function field<K extends keyof TValues>(key: K) {
    return {
      value: values[key],
      error: errors[key],
      onChange: (value: TValues[K]) => set(key, value),
    }
  }

  return { values, errors, set, setError, clearErrors, reset, trimmed, field }
}

export type UseDialogFormReturn<TValues extends object> = ReturnType<
  typeof useDialogForm<TValues>
>
