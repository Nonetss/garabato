import { useCallback, useMemo, useState } from "react"
import {
  activeSignatureLogFilterCount,
  emptySignatureLogFilters,
  type SignatureLogFilters,
  signatureLogQueryInput,
} from "@/features/signatures/overview/model/filters"
import type {
  SignatureLogCertificate,
  SignatureLogRecord,
} from "@/features/signatures/overview/model/types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHydratedInfiniteQuery } from "@/hooks/use-hydrated-infinite-query"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

const PAGE_SIZE = 25

const noRecords: SignatureLogRecord[] = []
const noCertificates: SignatureLogCertificate[] = []

function certificateOptions(data: SignatureLogCertificate[] | undefined) {
  if (!data) return noCertificates
  return data
}

/** The signature log page's filters, its paged records and the
 *  certificates its filter offers. */
export function useSignatureLog() {
  const [filters, setFilters] = useState<SignatureLogFilters>(
    emptySignatureLogFilters
  )
  // The text box stays instant; only the request waits for a pause.
  const query = useDebouncedValue(filters.query)
  const queryInput = useMemo(
    () => signatureLogQueryInput({ ...filters, query }),
    [filters, query]
  )

  const log = useHydratedInfiniteQuery(
    orpc.v1.document.signatureLog.infiniteOptions({
      input: (cursor: string | null) => ({
        ...queryInput,
        cursor,
        limit: PAGE_SIZE,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  )
  const certificates = useHydratedQuery(
    orpc.v1.document.signatureLogCertificates.queryOptions()
  )

  const records = useMemo(() => {
    if (!log.data) return noRecords
    return log.data.pages.flatMap((page) => page.records)
  }, [log.data])
  const total = log.data?.pages[0]?.total

  const clearFilters = useCallback(
    () => setFilters(emptySignatureLogFilters),
    []
  )

  return {
    records,
    total,
    certificates: certificateOptions(certificates.data),
    filters,
    setFilters,
    clearFilters,
    activeCount: activeSignatureLogFilterCount(filters),
    hasNextPage: log.hasNextPage,
    isFetchingNextPage: log.isFetchingNextPage,
    fetchNextPage: log.fetchNextPage,
    isPending: log.isPending,
    isError: log.isError,
    refetch: log.refetch,
  }
}
