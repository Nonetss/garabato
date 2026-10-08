export function toIso(date: Date): string {
  return date.toISOString()
}

export function toIsoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}
