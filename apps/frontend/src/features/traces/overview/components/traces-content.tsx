import { getIcon } from "@/lib/icon-registry"

const SignaturesIcon = getIcon("navigation", "signatures")
const DocumentIcon = getIcon("navigation", "documents")

import { InfiniteScrollSentinel } from "@/components/shared/data-display/infinite-scroll-sentinel"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFilterChip,
  type ResourceFilterDescriptor,
  type ResourceFilterOption,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { SignatureDetailSheet } from "@/features/signatures/overview/components/signature-detail-sheet"
import {
  type SignaturesRowContext,
  signatureDefinition,
} from "@/features/signatures/overview/definitions/signature.definition"
import { useSignatureLog } from "@/features/signatures/overview/hooks/use-signature-log"
import {
  ALL_CERTIFICATES,
  deletedAware,
} from "@/features/signatures/overview/model/filters"
import type {
  SignatureLogCertificate,
  SignatureLogRecord,
} from "@/features/signatures/overview/model/types"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useTargetDialog } from "@/hooks/use-target-dialog"

function certificateOptions(
  certificates: SignatureLogCertificate[]
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
  const label = total === 1 ? "firma" : "firmas"
  return <HeroCount segments={[{ count: total, label }]} />
}

export function SignaturesContent() {
  const {
    records,
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
  } = useSignatureLog()
  const detail = useTargetDialog<SignatureLogRecord>()

  // The page itself scrolls, so the sentinel is observed against the viewport.
  const sentinelRef = useInfiniteScroll(
    null,
    fetchNextPage,
    hasNextPage && !isFetchingNextPage
  )

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "search",
      key: "signature-filter-document",
      label: "Documento",
      value: filters.query,
      onChange: (query) => setFilters((current) => ({ ...current, query })),
      placeholder: "Nombre del documento",
    },
    {
      kind: "select",
      key: "signature-filter-certificate",
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
      // Both ends of the range share one grid cell, so the panel keeps three
      // fields per row.
      kind: "custom",
      key: "signature-filter-dates",
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
      key: "signature-filter-from",
      label: `Desde: ${filters.from.toLocaleDateString()}`,
      onRemove: () =>
        setFilters((current) => ({ ...current, from: undefined })),
    })
  }
  if (filters.to !== undefined) {
    dateChips.push({
      key: "signature-filter-to",
      label: `Hasta: ${filters.to.toLocaleDateString()}`,
      onRemove: () => setFilters((current) => ({ ...current, to: undefined })),
    })
  }

  const rowContext: SignaturesRowContext = { onOpen: detail.open }

  return (
    <>
      <ResourceOverview
        surface="signatures"
        heroChildren={<TotalCount total={total} />}
        filters={
          <div className="space-y-3">
            <ResourceFilters
              columns={3}
              filters={filterDescriptors}
              onClear={clearFilters}
            />
            <FilterChips
              chips={[...chipsFor(filterDescriptors), ...dateChips]}
              onClear={clearFilters}
            />
          </div>
        }
        query={{ data: records, isPending, isError, refetch }}
        loading="Cargando firmas..."
        error={{
          icon: <SignaturesIcon className="size-6" />,
          title: "No se pudo cargar el registro de firmas",
          description:
            "Comprueba tu conexión; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <SignaturesIcon className="size-6" />,
          title: "Todavía no has firmado nada",
          description:
            "Cada firma que hagas quedará registrada aquí con su certificado.",
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
          icon: <SignaturesIcon className="size-6" />,
          title: "Ninguna firma coincide con los filtros",
          description: "Prueba a limpiar o ajustar los filtros.",
          onClear: clearFilters,
        }}
      >
        {(data) => (
          <div>
            <EntityList
              items={data}
              context={rowContext}
              definition={signatureDefinition}
            />
            <InfiniteScrollSentinel
              sentinelRef={sentinelRef}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </div>
        )}
      </ResourceOverview>

      <SignatureDetailSheet record={detail.target} {...detail.dialogProps} />
    </>
  )
}
