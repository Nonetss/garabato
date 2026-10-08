import { useCallback, useEffect, useState } from "react"

export interface QueryParamCodec<T> {
  parse: (raw: string) => T
  serialize: (value: T) => string
}

const stringCodec: QueryParamCodec<string> = {
  parse: (raw) => raw,
  serialize: (value) => value,
}

/**
 * An on/off flag such as `?firmar=1`. Pair it with a `false` default so the
 * param only exists while the flag is on; any present value other than "0"
 * or "false" reads as on.
 */
export const flagCodec: QueryParamCodec<boolean> = {
  parse: (raw) => raw !== "0" && raw !== "false",
  serialize: (value) => String(Number(value)),
}

function readParam(key: string): string | null {
  return new URL(window.location.href).searchParams.get(key)
}

function writeParam(key: string, raw: string | null) {
  const url = new URL(window.location.href)
  if (raw === null) {
    url.searchParams.delete(key)
  } else {
    url.searchParams.set(key, raw)
  }
  if (url.href === window.location.href) return
  window.history.replaceState(window.history.state, "", url)
}

/**
 * Reads/writes a single query-string param as component state.
 *
 * The value is seeded from the URL on mount, pushed back with `replaceState`
 * (no new history entry, same approach as `thread-url-state.ts`) so filter
 * changes don't spam the back-button stack, and the param is dropped from the
 * URL entirely once the value equals `defaultValue` — "no filter" means no
 * query param rather than `?q=`. Real back/forward navigation and full Astro
 * page loads resync the value from the URL. Pass a `codec` to store
 * non-string values (numbers, booleans, ...); it defaults to storing the
 * string as-is.
 *
 * Only safe in `client:only` islands (assumes `window` is present on first
 * render) — matches this repo's rule that React components never render
 * server-side.
 */
export function useQueryParam<T = string>(
  key: string,
  defaultValue: T,
  codec: QueryParamCodec<T> = stringCodec as unknown as QueryParamCodec<T>
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readParam(key)
    return raw === null ? defaultValue : codec.parse(raw)
  })

  useEffect(() => {
    const sync = () => {
      const raw = readParam(key)
      setValue(raw === null ? defaultValue : codec.parse(raw))
    }
    window.addEventListener("popstate", sync)
    document.addEventListener("astro:page-load", sync)
    return () => {
      window.removeEventListener("popstate", sync)
      document.removeEventListener("astro:page-load", sync)
    }
  }, [key, defaultValue, codec])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      writeParam(
        key,
        Object.is(next, defaultValue) ? null : codec.serialize(next)
      )
    },
    [key, defaultValue, codec]
  )

  return [value, set]
}
