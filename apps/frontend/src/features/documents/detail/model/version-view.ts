import type { DocumentVersion } from "@/features/documents/shared"
import type { QueryParamCodec } from "@/hooks/use-query-param"

/** `?version=2`: a version number; anything else reads as no choice. */
export const versionParamCodec: QueryParamCodec<number | null> = {
  parse: (raw) => {
    const number = Number(raw)
    if (!Number.isInteger(number) || number < 1) return null
    return number
  },
  serialize: (value) => String(value),
}

/**
 * The version the viewer shows: the requested one when it is a live version
 * of the document, else the current one (no choice, a stale link, or a
 * version deleted meanwhile).
 */
export function shownVersion(
  versions: DocumentVersion[],
  requested: number | null
) {
  const current = versions.at(-1)
  if (requested === null) return current
  const match = versions.find((version) => version.number === requested)
  if (!match) return current
  return match
}

/**
 * The version number to fetch for the viewer: undefined for the current
 * version, so it shares its cache entry with the thumbnails and signing.
 */
export function viewedVersionNumber(
  versions: DocumentVersion[] | undefined,
  requested: number | null
) {
  if (!versions) return undefined
  const shown = shownVersion(versions, requested)
  if (!shown || shown === versions.at(-1)) return undefined
  return shown.number
}

/** The version that becomes current once the current one is deleted. */
export function previousVersion(versions: DocumentVersion[]) {
  return versions.at(-2)
}
