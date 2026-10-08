import type { KeyboardEvent } from "react"

/**
 * `onKeyDown` handler that submits the surrounding form on Enter (without
 * Shift). Shift+Enter preserves the default newline behaviour.
 *
 * Use as `onKeyDown={submitOnEnter}` on a form control (`<input>`,
 * `<textarea>`, `<select>`) inside a `<form>` whose `onSubmit` does the real
 * work. The handler dispatches a native `requestSubmit()`, which respects
 * the form's submit button and validation state — falling back to
 * `form.submit()` if `requestSubmit` is unavailable (older browsers).
 *
 * The type is intentionally generic over the form-control element so the
 * same helper works on any text input.
 */
export function submitOnEnter<E extends { form: HTMLFormElement | null }>(
  event: KeyboardEvent<E>
) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  const form = event.currentTarget.form
  if (!form) return
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit()
  } else {
    form.submit()
  }
}
