import { NBSP } from "@/lib/format"

const DAY_MS = 86_400_000

export type CertificateValidity = {
  /** Share of the validity window already elapsed, clamped to 0–1. */
  progress: number
  /** Calendar days until the expiry date; negative after it. */
  daysLeft: number
  expired: boolean
}

// Calendar days, so "hoy" and "ayer" follow the local date, not 24h spans.
function startOfDay(time: number) {
  const day = new Date(time)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/** Where `now` falls inside the certificate's validity window. */
export function certificateValidity(
  notBefore: string,
  notAfter: string,
  now: Date
): CertificateValidity {
  const start = new Date(notBefore).getTime()
  const end = new Date(notAfter).getTime()
  const current = now.getTime()
  const daysLeft = Math.round((startOfDay(end) - startOfDay(current)) / DAY_MS)
  const expired = current >= end
  if (end <= start) return { progress: 1, daysLeft, expired }
  const progress = Math.min(1, Math.max(0, (current - start) / (end - start)))
  return { progress, daysLeft, expired }
}

/** "Quedan 812 días", "Caduca hoy", "Caducó hace 3 días". */
export function remainingLabel({ daysLeft, expired }: CertificateValidity) {
  if (expired && daysLeft >= 0) return "Caducó hoy"
  if (daysLeft > 1) return `Quedan ${daysLeft}${NBSP}días`
  if (daysLeft === 1) return `Queda 1${NBSP}día`
  if (daysLeft === 0) return "Caduca hoy"
  if (daysLeft === -1) return "Caducó ayer"
  return `Caducó hace ${-daysLeft}${NBSP}días`
}
