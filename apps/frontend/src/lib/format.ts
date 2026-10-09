export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(
  iso: string | null,
  options?: { includeSeconds?: boolean; includeYear?: boolean }
): string {
  if (!iso) return "—"
  const config: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }
  if (options?.includeYear) {
    config.year = "numeric"
  }
  if (options?.includeSeconds) {
    config.second = "2-digit"
  }
  return new Date(iso).toLocaleString("es-ES", config)
}

export function formatTime(
  date: string,
  options?: { includeSeconds?: boolean }
): string {
  return new Date(date).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: options?.includeSeconds ? "2-digit" : undefined,
  })
}

export function formatDuration(
  startedAt: string,
  finishedAt: string | null
): string {
  if (!finishedAt) return "—"
  return formatDurationMs(
    new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  )
}

/** Same scale as `formatDuration` for a duration already in milliseconds. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.round(ms / 60_000)} min`
}

export function formatDayLabel(date: string): string {
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const compare = new Date(d)
  compare.setHours(0, 0, 0, 0)
  if (compare.getTime() === today.getTime()) return "Hoy"
  if (compare.getTime() === yesterday.getTime()) return "Ayer"
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: compare.getFullYear() === today.getFullYear() ? undefined : "numeric",
  })
}

/**
 * Relative day label for compact contexts (lists, notifications):
 * "Hoy" / "Ayer" / "Hace N días" within the last week, then `toLocaleDateString`
 * after that. Use this instead of `formatDayLabel` when weekday output isn't
 * wanted and "Hace N días" reads better than a long date.
 *
 * Returns "—" for invalid input so callers can render it directly.
 */
export function formatRelativeDay(date: string | Date): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compare = new Date(d)
  compare.setHours(0, 0, 0, 0)

  const dayMs = 86_400_000
  const days = Math.floor((today.getTime() - compare.getTime()) / dayMs)

  if (days <= 0) return "Hoy"
  if (days === 1) return "Ayer"
  if (days < 7) return `Hace ${days} días`
  return d.toLocaleDateString("es-ES")
}

const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

/**
 * Relative moment for timelines: "hace un momento", "hace 5 minutos",
 * "hace 20 horas" within the last day, then calendar days ("ayer",
 * "anteayer", "hace 3 días") within the week, then `formatDate`.
 *
 * Returns "—" for invalid input so callers can render it directly.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"

  const now = new Date()
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (minutes < 1) return "hace un momento"
  if (minutes < 60) return relativeTime.format(-minutes, "minute")
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relativeTime.format(-hours, "hour")

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const compare = new Date(d)
  compare.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - compare.getTime()) / 86_400_000)
  if (days < 7) return relativeTime.format(-days, "day")
  return formatDate(d)
}

export function formatDayHeader(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/**
 * Coarse recency bucket for grouping lists (history lists, etc.):
 * "Hoy" / "Esta semana" / "Este mes" / "Últimos 3 meses" / "Más de 3 meses".
 * Pair with a stable sort (e.g. by the same date, descending) so items
 * within a bucket stay ordered — this only labels, it doesn't sort.
 */
export function getDateBucketLabel(date: string | Date): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "Más de 3 meses"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compare = new Date(d)
  compare.setHours(0, 0, 0, 0)

  const dayMs = 86_400_000
  const days = Math.floor((today.getTime() - compare.getTime()) / dayMs)

  if (days <= 0) return "Hoy"
  if (days < 7) return "Esta semana"
  if (days < 30) return "Este mes"
  if (days < 90) return "Últimos 3 meses"
  return "Más de 3 meses"
}

/** No-break space. Binds a number to its unit ("412 KB", "3 páginas") so a
 *  narrow column never strands the unit on the next line. */
export const NBSP = "\u00A0"

/** "3 páginas · 412 KB": facts joined by a middle dot that stays on the line
 *  of the fact before it, so a wrapped line never starts with "·". */
export function joinFacts(facts: string[]): string {
  return facts.join(`${NBSP}· `)
}

/** "1 página", "3 páginas", with the number bound to its noun. */
export function formatCount(count: number, one: string, many: string): string {
  if (count === 1) return `1${NBSP}${one}`
  return `${count}${NBSP}${many}`
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB"]

/** "1,2 MB" style sizes, base 1024. */
export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 ? 0 : 1
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: digits })}${NBSP}${FILE_SIZE_UNITS[unit]}`
}

/** 1-based page list for display: "1", "1–3", "1, 3". */
export function formatPages(pages: number[]): string {
  if (pages.length === 0) return "—"
  const sorted = [...pages].sort((a, b) => a - b).map((page) => page + 1)
  const first = sorted[0]
  const last = sorted.at(-1)
  const contiguous = sorted.every(
    (page, index) => page === (first ?? 0) + index
  )
  if (contiguous && sorted.length > 2) return `${first}–${last}`
  return sorted.join(", ")
}
