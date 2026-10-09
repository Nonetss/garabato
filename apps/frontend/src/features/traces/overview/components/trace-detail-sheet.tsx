import { Text, textVariants } from "@/components/shared/brand/typography"
import {
  MetadataDefinitionList,
  type MetadataFieldDescriptor,
} from "@/components/shared/data-display/metadata-cell"
import { AppLink } from "@/components/ui/app-link"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { deletedAware } from "@/features/traces/overview/model/filters"
import {
  folderLabel,
  TRAIL_TYPE_LABELS,
  traceSubject,
} from "@/features/traces/overview/model/labels"
import type { TrailEntry } from "@/features/traces/overview/model/types"
import { formatDateTime, joinFacts } from "@/lib/format"

function DocumentLink({
  id,
  name,
  deleted,
}: {
  id: string
  name: string
  deleted: boolean
}) {
  if (deleted) return <Text tone="muted">{deletedAware(name, deleted)}</Text>
  return (
    <AppLink
      href={`/documents/${id}`}
      className="underline-offset-4 hover:underline"
    >
      {name}
    </AppLink>
  )
}

function CertificateName({ entry }: { entry: TrailEntry }) {
  if (!entry.certificate) return null
  const { alias, holder, deleted } = entry.certificate
  const name = deletedAware(alias, deleted)
  if (holder === alias) return <span>{name}</span>
  return <span>{joinFacts([name, holder])}</span>
}

function renameDetails(entry: TrailEntry) {
  if (entry.type !== "certificate.renamed" && entry.type !== "document.renamed")
    return null
  return entry.details
}

function moveDetails(entry: TrailEntry) {
  if (entry.type !== "document.moved") return null
  return entry.details
}

function mergeSources(entry: TrailEntry) {
  if (entry.type !== "document.merged") return null
  return entry.details.sources
}

const fields: MetadataFieldDescriptor<TrailEntry>[] = [
  {
    key: "type",
    label: "Acción",
    value: (entry) => TRAIL_TYPE_LABELS[entry.type],
  },
  {
    key: "occurredAt",
    label: "Fecha",
    value: (entry) => (
      <span className="tabular-nums">
        {formatDateTime(entry.occurredAt, {
          includeYear: true,
          includeSeconds: true,
        })}
      </span>
    ),
  },
  {
    key: "document",
    label: "Documento",
    value: (entry) =>
      entry.document && (
        <DocumentLink
          id={entry.document.id}
          name={entry.document.name}
          deleted={entry.document.deleted}
        />
      ),
    hidden: (entry) => entry.document === null,
  },
  {
    key: "certificate",
    label: "Certificado",
    value: (entry) => <CertificateName entry={entry} />,
    hidden: (entry) => entry.certificate === null,
  },
  {
    key: "version",
    label: "Versión",
    value: (entry) => (
      <span className="tabular-nums">v{entry.version?.number}</span>
    ),
    hidden: (entry) => entry.version === null,
  },
  {
    key: "renamedFrom",
    label: "Nombre anterior",
    value: (entry) => renameDetails(entry)?.from,
    hidden: (entry) => renameDetails(entry) === null,
  },
  {
    key: "renamedTo",
    label: "Nombre nuevo",
    value: (entry) => renameDetails(entry)?.to,
    hidden: (entry) => renameDetails(entry) === null,
  },
  {
    key: "movedFrom",
    label: "Origen",
    value: (entry) => {
      const details = moveDetails(entry)
      if (!details) return null
      return folderLabel(details.from)
    },
    hidden: (entry) => moveDetails(entry) === null,
  },
  {
    key: "movedTo",
    label: "Destino",
    value: (entry) => {
      const details = moveDetails(entry)
      if (!details) return null
      return folderLabel(details.to)
    },
    hidden: (entry) => moveDetails(entry) === null,
  },
  {
    key: "sources",
    label: "Documentos unidos",
    value: (entry) => (
      <ol className="list-decimal space-y-1 pl-5">
        {mergeSources(entry)?.map((source) => (
          <li key={source.id}>{source.name}</li>
        ))}
      </ol>
    ),
    hidden: (entry) => mergeSources(entry) === null,
  },
  {
    key: "ip",
    label: "Dirección IP",
    value: (entry) => <Text variant="data">{entry.ipAddress}</Text>,
    hidden: (entry) => !entry.ipAddress,
  },
]

function titleOf(entry: TrailEntry | null) {
  if (!entry) return "Traza"
  return traceSubject(entry)
}

function descriptionOf(entry: TrailEntry | null) {
  if (!entry) return "Traza"
  return TRAIL_TYPE_LABELS[entry.type]
}

interface TraceDetailSheetProps {
  entry: TrailEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** What one trace recorded, without leaving the trail. Signatures open
 *  `SignatureDetailSheet` instead. */
export function TraceDetailSheet({
  entry,
  open,
  onOpenChange,
}: TraceDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="wrap-break-word">{titleOf(entry)}</SheetTitle>
          <SheetDescription className={textVariants({ role: "compact" })}>
            {descriptionOf(entry)}
          </SheetDescription>
        </SheetHeader>
        {entry && (
          <div className="px-4 pb-6">
            <MetadataDefinitionList
              context={entry}
              fields={fields}
              columns={1}
              bordered={false}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
