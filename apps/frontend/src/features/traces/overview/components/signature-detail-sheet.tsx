import { Text, textVariants } from "@/components/shared/brand/typography"
import {
  MetadataDefinitionList,
  type MetadataFieldDescriptor,
} from "@/components/shared/data-display/metadata-cell"
import { CopyButton } from "@/components/shared/form/copy-button"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { AppLink } from "@/components/ui/app-link"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { timestampDetail } from "@/features/documents/shared/public"
import {
  deletedAware,
  placementLabel,
} from "@/features/traces/overview/model/filters"
import type { SignatureLogRecord } from "@/features/traces/overview/model/types"
import { formatDate, formatDateTime } from "@/lib/format"

function DocumentName({ record }: { record: SignatureLogRecord }) {
  if (record.documentDeleted) {
    return (
      <Text tone="muted">
        {deletedAware(record.documentName, record.documentDeleted)}
      </Text>
    )
  }
  return (
    <AppLink
      href={`/documents/${record.documentId}`}
      className="underline-offset-4 hover:underline"
    >
      {record.documentName}
    </AppLink>
  )
}

function Hash({ value }: { value: string }) {
  return (
    <Text variant="data" className="break-all">
      {value}
    </Text>
  )
}

const signatureFields: MetadataFieldDescriptor<SignatureLogRecord>[] = [
  {
    key: "document",
    label: "Documento",
    value: (record) => <DocumentName record={record} />,
  },
  {
    key: "version",
    label: "Versión",
    value: (record) => (
      <span className="tabular-nums">v{record.versionNumber}</span>
    ),
  },
  {
    key: "signedAt",
    label: "Fecha",
    value: (record) => (
      <span className="tabular-nums">
        {formatDateTime(record.signedAt, {
          includeYear: true,
          includeSeconds: true,
        })}
      </span>
    ),
  },
  {
    key: "placement",
    label: "Firma",
    value: (record) => placementLabel(record),
  },
  {
    key: "timestamp",
    label: "Sello de tiempo",
    value: (record) => (
      <span className="tabular-nums">{timestampDetail(record)}</span>
    ),
  },
  {
    key: "reason",
    label: "Motivo",
    value: (record) => record.reason,
    hidden: (record) => !record.reason,
  },
  {
    key: "location",
    label: "Lugar",
    value: (record) => record.location,
    hidden: (record) => !record.location,
  },
  {
    key: "ip",
    label: "Dirección IP",
    value: (record) => <Text variant="data">{record.ipAddress}</Text>,
    hidden: (record) => !record.ipAddress,
  },
]

const integrityFields: MetadataFieldDescriptor<SignatureLogRecord>[] = [
  {
    key: "before",
    label: "SHA-256 antes de firmar",
    value: (record) => <Hash value={record.sha256Before} />,
    action: (record) => (
      <CopyButton text={record.sha256Before} label="Copiar hash anterior" />
    ),
  },
  {
    key: "after",
    label: "SHA-256 del documento firmado",
    value: (record) => <Hash value={record.sha256After} />,
    action: (record) => (
      <CopyButton text={record.sha256After} label="Copiar hash firmado" />
    ),
  },
]

const certificateFields: MetadataFieldDescriptor<SignatureLogRecord>[] = [
  {
    key: "alias",
    label: "Alias",
    value: (record) =>
      deletedAware(record.certificateAlias, record.certificateDeleted),
  },
  {
    key: "holder",
    label: "Titular",
    value: (record) => record.certificateHolder,
  },
  {
    key: "taxId",
    label: "NIF",
    value: (record) => <Text variant="data">{record.certificateTaxId}</Text>,
    hidden: (record) => !record.certificateTaxId,
  },
  {
    key: "issuer",
    label: "Emisor",
    value: (record) => record.certificateIssuer,
  },
  {
    key: "validity",
    label: "Validez",
    value: (record) => (
      <span className="tabular-nums">
        {formatDate(record.certificateNotBefore)} –{" "}
        {formatDate(record.certificateNotAfter)}
      </span>
    ),
  },
  {
    key: "serial",
    label: "Número de serie",
    value: (record) => <Hash value={record.certificateSerialNumber} />,
  },
  {
    key: "fingerprint",
    label: "Huella SHA-256",
    value: (record) => <Hash value={record.certificateFingerprint} />,
    action: (record) => (
      <CopyButton
        text={record.certificateFingerprint}
        label="Copiar huella del certificado"
      />
    ),
  },
]

function RecordDetail({ record }: { record: SignatureLogRecord }) {
  return (
    <div className="space-y-6 px-4 pb-6">
      <section>
        <SectionHeading as="h3" title="Firma" />
        <MetadataDefinitionList
          context={record}
          fields={signatureFields}
          columns={2}
          bordered={false}
        />
      </section>
      <section>
        <SectionHeading as="h3" title="Integridad" />
        <MetadataDefinitionList
          context={record}
          fields={integrityFields}
          columns={1}
          bordered={false}
        />
      </section>
      <section>
        <SectionHeading as="h3" title="Certificado" />
        <MetadataDefinitionList
          context={record}
          fields={certificateFields}
          columns={1}
          bordered={false}
        />
      </section>
    </div>
  )
}

interface SignatureDetailSheetProps {
  record: SignatureLogRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Everything one signature record holds, without leaving the log. */
export function SignatureDetailSheet({
  record,
  open,
  onOpenChange,
}: SignatureDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="wrap-break-word">
            {record?.documentName ?? "Firma"}
          </SheetTitle>
          <SheetDescription className={textVariants({ role: "compact" })}>
            Registro de la firma
          </SheetDescription>
        </SheetHeader>
        {record && <RecordDetail record={record} />}
      </SheetContent>
    </Sheet>
  )
}
