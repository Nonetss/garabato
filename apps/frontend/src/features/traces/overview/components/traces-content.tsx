import { getIcon } from "@/lib/icon-registry"

const TracesIcon = getIcon("navigation", "traces")
const DocumentIcon = getIcon("navigation", "documents")

import { InfiniteScrollSentinel } from "@/components/shared/data-display/infinite-scroll-sentinel"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFacetOption,
  type ResourceFilterChip,
  type ResourceFilterDescriptor,
  type ResourceFilterOption,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { SignatureDetailSheet } from "@/features/traces/overview/components/signature-detail-sheet"
import { TraceDetailSheet } from "@/features/traces/overview/components/trace-detail-sheet"
import { TraceTimeline } from "@/features/traces/overview/components/trace-timeline"
import { useTraces } from "@/features/traces/overview/hooks/use-traces"
import {
  ALL_CERTIFICATES,
  deletedAware,
} from "@/features/traces/overview/model/filters"
import { TRAIL_TYPE_LABELS } from "@/features/traces/overview/model/labels"
import {
  type SignatureLogRecord,
  TRAIL_TYPES,
  type TraceCertificate,
  type TrailEntry,
} from "@/features/traces/overview/model/types"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useTargetDialog } from "@/hooks/use-target-dialog"

const typeOptions: ResourceFacetOption[] = TRAIL_TYPES.map((type) => ({
  value: type,
  label: TRAIL_TYPE_LABELS[type],
}))

function certificateOptions(
  certificates: TraceCertificate[]
): ResourceFilterOption[] {
  return [
    { value: ALL_CERTIFICATES, label: "Todos los certificados" },
    ...certificates.map((certificate) => ({
      value: certificate.id,
      label: deletedAware(certificate.alias, certificate.deleted),
    })),
  ]
}

function TotalCount({ total }: { total: number | undefined }) {
  if (total === undefined) return null
  const label = total === 1 ? "traza" : "trazas"
  return <HeroCount segments={[{ count: total, label }]} />
}

export function TracesContent() {
  const {
    entries,
    total,
    certificates,
    filters,
    setFilters,
    clearFilters,
    activeCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isPending,
    isError,
    refetch,
  } = useTraces()
  const signatureDetail = useTargetDialog<SignatureLogRecord>()
  const traceDetail = useTargetDialog<TrailEntry>()

  // The page itself scrolls, so the sentinel is observed against the viewport.
  const sentinelRef = useInfiniteScroll(
    null,
    fetchNextPage,
    hasNextPage && !isFetchingNextPage
  )

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "search",
      key: "trace-filter-query",
      label: "Buscar",
      value: filters.query,
      onChange: (query) => setFilters((current) => ({ ...current, query })),
      placeholder: "Documento o certificado",
    },
    {
      kind: "facet",
      key: "trace-filter-type",
      label: "Tipo",
      options: typeOptions,
      value: filters.types,
      onChange: (types) => setFilters((current) => ({ ...current, types })),
    },
    {
      kind: "select",
      key: "trace-filter-certificate",
      label: "Certificado",
      value: filters.certificateId,
      onChange: (certificateId) =>
        setFilters((current) => ({ ...current, certificateId })),
      placeholder: "Todos los certificados",
      options: certificateOptions(certificates),
      defaultValue: ALL_CERTIFICATES,
      searchable: true,
    },
    {
      // Both ends of the range share one grid cell, so at its widest the
      // panel fits every filter on one row.
      kind: "custom",
      key: "trace-filter-dates",
      label: "Fechas",
      isActive: filters.from !== undefined || filters.to !== undefined,
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            value={filters.from}
            onChange={(from) => setFilters((current) => ({ ...current, from }))}
            placeholder="Desde"
            className="w-full"
            aria-label="Desde"
          />
          <DatePicker
            value={filters.to}
            onChange={(to) => setFilters((current) => ({ ...current, to }))}
            placeholder="Hasta"
            className="w-full"
            aria-label="Hasta"
          />
        </div>
      ),
    },
  ]

  // `chipsFor` skips `custom` descriptors, so the date range's chips are
  // appended by hand.
  const dateChips: ResourceFilterChip[] = []
  if (filters.from !== undefined) {
    dateChips.push({
      key: "trace-filter-from",
      label: `Desde: ${filters.from.toLocaleDateString()}`,
      onRemove: () =>
        setFilters((current) => ({ ...current, from: undefined })),
    })
  }
  if (filters.to !== undefined) {
    dateChips.push({
      key: "trace-filter-to",
      label: `Hasta: ${filters.to.toLocaleDateString()}`,
      onRemove: () => setFilters((current) => ({ ...current, to: undefined })),
    })
  }

  const openEntry = (entry: TrailEntry) => {
    if (entry.type === "document.signed") {
      signatureDetail.open(entry.signature)
      return
    }
    traceDetail.open(entry)
  }

  return (
    <>
      <ResourceOverview
        surface="traces"
        heroChildren={<TotalCount total={total} />}
        filters={
          <div className="space-y-3">
            <ResourceFilters
              columns={4}
              filters={filterDescriptors}
              onClear={clearFilters}
            />
            <FilterChips
              chips={[...chipsFor(filterDescriptors), ...dateChips]}
              onClear={clearFilters}
            />
          </div>
        }
        query={{ data: entries, isPending, isError, refetch }}
        loading="Cargando trazas…"
        error={{
          icon: <TracesIcon className="size-6" />,
          title: "No se pudieron cargar las trazas",
          description:
            "Comprueba tu conexión; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <TracesIcon className="size-6" />,
          title: "Todavía no hay actividad",
          description:
            "Cada firma, importación, descarga o cambio que hagas en tus documentos y certificados quedará registrado aquí.",
          action: (
            <Button
              variant="outline"
              render={<AppLink href="/documents" />}
              nativeButton={false}
            >
              <DocumentIcon className="size-4" />
              Ir a documentos
            </Button>
          ),
        }}
        hasActiveFilters={activeCount > 0}
        filteredEmpty={{
          icon: <TracesIcon className="size-6" />,
          title: "Ninguna traza coincide con los filtros",
          description: "Prueba a limpiar o ajustar los filtros.",
          onClear: clearFilters,
        }}
      >
        {(data) => (
          <div>
            <TraceTimeline entries={data} onOpen={openEntry} />
            <InfiniteScrollSentinel
              sentinelRef={sentinelRef}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </div>
        )}
      </ResourceOverview>

      <SignatureDetailSheet
        record={signatureDetail.target}
        {...signatureDetail.dialogProps}
      />
      <TraceDetailSheet
        entry={traceDetail.target}
        {...traceDetail.dialogProps}
      />
    </>
  )
}
