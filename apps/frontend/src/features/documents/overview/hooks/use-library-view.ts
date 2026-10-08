import { useState } from "react"
import {
  emptyLibraryFilters,
  isFiltering,
  type LibraryFilters,
} from "@/features/documents/overview/model/library-filters"
import { FOLDER_PARAM } from "@/features/documents/shared"
import { type QueryParamCodec, useQueryParam } from "@/hooks/use-query-param"

// `?carpeta=<id>` is the open folder; no param is the library root.
const folderCodec: QueryParamCodec<string | null> = {
  parse: (raw) => raw,
  serialize: (value) => value ?? "",
}

/**
 * What the documents page shows: the open folder from the URL (so it
 * survives reloads and links), and the filters, which while any is set make
 * the page list matches from the whole library instead.
 */
export function useLibraryView() {
  const [folderId] = useQueryParam<string | null>(
    FOLDER_PARAM,
    null,
    folderCodec
  )
  const [filters, setFilters] = useState<LibraryFilters>(emptyLibraryFilters)

  return {
    folderId,
    filters,
    setFilters,
    clearFilters: () => setFilters(emptyLibraryFilters()),
    filtering: isFiltering(filters),
  }
}
