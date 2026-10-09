import { getIcon } from "@/lib/icon-registry"

const Clock = getIcon("navigation", "crons")
const Plus = getIcon("actions", "add")

import { useCallback, useDeferredValue, useMemo } from "react"
import { Text } from "@/components/shared/brand/typography"
import type { SuggestInputItem } from "@/components/shared/form/suggest-input"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFilterDescriptor,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CronFormDialog } from "@/features/crons/overview/components/cron-form-dialog"
import {
  type CronsRowContext,
  cronJobDefinition,
} from "@/features/crons/overview/definitions/cron-job.definition"
import { useCronHandlers } from "@/features/crons/overview/hooks/use-cron-handlers"
import { useCronUsersByIds } from "@/features/crons/overview/hooks/use-cron-users-by-ids"
import {
  availableTags,
  groupJobsByTag,
  jobTag,
} from "@/features/crons/overview/model/group-by-tag"
import type { CronJob } from "@/features/crons/shared"
import { cronLabels, useCronJobs, useCronRemove } from "@/features/crons/shared"
import { useEditDialog } from "@/hooks/use-edit-dialog"
import { useQueryParam } from "@/hooks/use-query-param"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { isAdminUser } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"
import { foldText, textSuggestions } from "@/lib/fold-text"

const ALL_TAGS = "all"
type StatusFilter = "all" | "enabled" | "disabled"

export function CronsContent() {
  const { data: jobs = [], isPending, isError, refetch } = useCronJobs()
  const { data: handlers = [] } = useCronHandlers()
  const removeCron = useCronRemove()
  const session = authClient.useSession()
  const isAdmin = !!isAdminUser(session.data?.user)

  const handlerKeys = useMemo(
    () => new Set(handlers.map((h) => h.key)),
    [handlers]
  )

  const editDialog = useEditDialog<CronJob>()

  const deleteDialog = useTargetConfirmDialog<CronJob>({
    title: cronLabels.deleteTitle,
    description: (job) => cronLabels.deleteDescription(job.name),
    confirmLabel: cronLabels.delete,
    onConfirm: (job) => removeCron.mutateAsync({ id: job.id }),
  })

  const [search, setSearch] = useQueryParam("q", "")
  const [tagFilter, setTagFilter] = useQueryParam("tag", ALL_TAGS)
  const [statusFilter, setStatusFilter] = useQueryParam<StatusFilter>(
    "status",
    "all"
  )

  const activeCount = jobs.filter((job) => job.enabled).length
  const tags = availableTags(jobs)

  const runsAsUserIds = useMemo(
    () => jobs.flatMap((job) => (job.userId ? [job.userId] : [])),
    [jobs]
  )
  const usersById = useCronUsersByIds(runsAsUserIds)

  const normalizedSearch = search.trim().toLowerCase()
  // Keystrokes commit immediately; re-filtering and re-rendering every row
  // happens in a lower-priority pass, so a long job list can't make the input
  // stutter as it grows.
  const searchTerm = useDeferredValue(normalizedSearch)
  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (tagFilter !== ALL_TAGS && jobTag(job) !== tagFilter) {
          return false
        }
        if (statusFilter === "enabled" && !job.enabled) return false
        if (statusFilter === "disabled" && job.enabled) return false
        if (
          searchTerm &&
          !job.name.toLowerCase().includes(searchTerm) &&
          !job.handlerKey.toLowerCase().includes(searchTerm)
        ) {
          return false
        }
        return true
      }),
    [jobs, tagFilter, statusFilter, searchTerm]
  )

  const activeFilterCount =
    (normalizedSearch ? 1 : 0) +
    (tagFilter !== ALL_TAGS ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0)
  const clearFilters = () => {
    setSearch("")
    setTagFilter(ALL_TAGS)
    setStatusFilter("all")
  }

  const searchSuggestions = useMemo<SuggestInputItem[]>(
    () =>
      textSuggestions(jobs, search, {
        match: (job, q) =>
          foldText(job.name).includes(q) ||
          foldText(job.handlerKey).includes(q),
        toItem: (job) => ({
          key: job.id,
          value: job.name,
          label: job.name,
          detail: job.handlerKey,
        }),
      }),
    [jobs, search]
  )

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "suggestion",
      key: "cron-filter-search",
      label: "Buscar",
      value: search,
      onChange: setSearch,
      suggestions: searchSuggestions,
      placeholder: "Nombre o handler…",
    },
    {
      kind: "select",
      key: "cron-filter-tag",
      label: "Tag",
      value: tagFilter,
      onChange: setTagFilter,
      placeholder: "Todos los tags",
      options: [
        { value: ALL_TAGS, label: "Todos los tags" },
        ...tags.map((tag) => ({ value: tag, label: tag })),
      ],
      defaultValue: ALL_TAGS,
      isActive: (value) => value !== ALL_TAGS,
    },
    {
      kind: "select",
      key: "cron-filter-status",
      label: "Estado",
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as StatusFilter),
      placeholder: "Todos los estados",
      options: [
        { value: "all", label: "Todos los estados" },
        { value: "enabled", label: "Activos" },
        { value: "disabled", label: "Pausados" },
      ],
      defaultValue: "all",
      isActive: (value) => value !== "all",
    },
  ]
  // Every filter here applies live, so the sheet's draft total is simply the
  // current filtered count.
  const fetchDraftTotal = useCallback(
    () => filteredJobs.length,
    [filteredJobs.length]
  )

  const rowContext: CronsRowContext = {
    isAdmin,
    handlerKeys,
    usersById,
    onEdit: editDialog.openEdit,
    onDelete: deleteDialog.open,
  }

  return (
    <>
      <ResourceOverview
        surface="crons"
        maxWidth="80%"
        description="Jobs programados del sistema."
        heroMeta={
          <HeroCount
            segments={[
              { count: activeCount, label: "activos" },
              { count: jobs.length, label: "total" },
            ]}
          />
        }
        heroAction={
          isAdmin ? (
            <Button onClick={editDialog.openCreate}>
              <Plus className="size-4" />
              {cronLabels.create}
            </Button>
          ) : null
        }
        filters={
          !isError && !isPending && jobs.length > 0 ? (
            <div className="space-y-3">
              <ResourceFilters
                filters={filterDescriptors}
                onClear={clearFilters}
                fetchDraftTotal={fetchDraftTotal}
                count={
                  filteredJobs.length === jobs.length
                    ? `${jobs.length} crons`
                    : `${filteredJobs.length} de ${jobs.length} crons`
                }
              />
              <FilterChips
                chips={chipsFor(filterDescriptors)}
                onClear={clearFilters}
              />
            </div>
          ) : undefined
        }
        query={{ data: filteredJobs, isPending, isError, refetch }}
        loading="Cargando crons…"
        error={{
          icon: <Clock className="size-6" />,
          title: "No se pudieron cargar los crons",
          description:
            "Comprueba tu conexión y tus permisos; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <Clock className="size-6" />,
          title: "No hay tareas programadas",
          description:
            "Crea una tarea para ejecutarla automáticamente según una expresión de tiempo.",
          action: isAdmin ? (
            <Button onClick={editDialog.openCreate}>{cronLabels.create}</Button>
          ) : undefined,
        }}
        hasActiveFilters={activeFilterCount > 0}
        filteredEmpty={{
          icon: <Clock className="size-6" />,
          title: "Sin resultados",
          description: "Ningún cron coincide con los filtros seleccionados.",
          onClear: clearFilters,
        }}
      >
        {(data) => {
          const groupedJobs = groupJobsByTag(data)
          return (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Accordion
                multiple
                defaultValue={groupedJobs.map(([tag]) => tag)}
                className="space-y-4"
              >
                {groupedJobs.map(([tag, tagJobs]) => (
                  <AccordionItem
                    key={tag}
                    value={tag}
                    className="overflow-hidden rounded-xl border bg-card/40 last:border-b"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-5">
                      <Text variant="title" className="flex items-center gap-2">
                        {tag}
                        <Text
                          variant="compact"
                          tone="muted"
                          className="tabular-nums"
                        >
                          ({tagJobs.length})
                        </Text>
                      </Text>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 pb-0">
                      <EntityList
                        items={tagJobs}
                        context={rowContext}
                        definition={cronJobDefinition}
                        className="rounded-none border-0 border-t bg-transparent"
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )
        }}
      </ResourceOverview>

      <CronFormDialog job={editDialog.editing} {...editDialog.dialogProps} />

      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
