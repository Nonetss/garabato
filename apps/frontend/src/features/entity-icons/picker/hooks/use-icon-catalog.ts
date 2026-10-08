import { useEffect, useState } from "react"
import {
  type IconCatalog,
  prepareIconCatalog,
} from "@/features/entity-icons/picker/model/icon-catalog"
import catalogUrl from "@/features/entity-icons/picker/model/icon-catalog.generated.json?url"

let catalogPromise: Promise<IconCatalog> | null = null
/** Kept after the first load so reopening a picker skips the skeleton. */
let loadedCatalog: IconCatalog | null = null

/**
 * Fetches the generated catalog once per session. It is served as a static
 * asset (not bundled) so pages only pay for it when a picker opens.
 */
function loadIconCatalog() {
  catalogPromise ??= fetch(catalogUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Catalog ${response.status}`)
      return response.json() as Promise<IconCatalog>
    })
    .then((raw) => {
      loadedCatalog = prepareIconCatalog(raw)
      return loadedCatalog
    })
    .catch((error: unknown) => {
      catalogPromise = null
      throw error
    })
  return catalogPromise
}

type CatalogState =
  | { status: "idle" | "loading" }
  | { status: "ready"; catalog: IconCatalog }
  | { status: "error" }

/** Loads the icon catalog the first time `enabled` becomes true. */
export function useIconCatalog(enabled: boolean): CatalogState {
  const [state, setState] = useState<CatalogState>(() =>
    loadedCatalog
      ? { status: "ready", catalog: loadedCatalog }
      : { status: "idle" }
  )

  useEffect(() => {
    if (!enabled || state.status === "ready") return
    let cancelled = false
    setState({ status: "loading" })
    loadIconCatalog().then(
      (catalog) => {
        if (!cancelled) setState({ status: "ready", catalog })
      },
      () => {
        if (!cancelled) setState({ status: "error" })
      }
    )
    return () => {
      cancelled = true
    }
  }, [enabled, state.status])

  return state
}
