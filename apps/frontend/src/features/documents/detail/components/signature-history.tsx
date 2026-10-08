import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import type { SignatureRecord } from "@/features/documents/shared"
import { formatDateTime, formatPages } from "@/lib/format"

function placementLabel(record: SignatureRecord) {
  if (!record.visible) return "Firma invisible"
  return `Visible en página ${formatPages(record.pages)}`
}

/** The document's signature records, newest first. */
export function SignatureHistory({ records }: { records: SignatureRecord[] }) {
  if (records.length === 0) {
    return (
      <Text as="p" variant="meta" tone="muted">
        Este documento todavía no tiene firmas.
      </Text>
    )
  }
  return (
    <SoftCardList as="ul">
      {records.map((record) => (
        <li key={record.id} className="space-y-0.5 px-4 py-3">
          <Text as="p" variant="title">
            {record.certificateHolder}
          </Text>
          <Text as="p" variant="compact" tone="muted" className="tabular-nums">
            {formatDateTime(record.signedAt, {
              includeYear: true,
              includeSeconds: true,
            })}{" "}
            · v{record.versionNumber} · {placementLabel(record)}
          </Text>
          {record.reason ? (
            <Text as="p" variant="compact" tone="muted">
              Motivo: {record.reason}
            </Text>
          ) : null}
        </li>
      ))}
    </SoftCardList>
  )
}
