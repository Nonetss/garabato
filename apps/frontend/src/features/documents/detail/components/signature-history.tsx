import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import type { SignatureRecord } from "@/features/documents/shared"
import { formatDateTime, formatPages } from "@/lib/format"

function placementLabel(record: SignatureRecord) {
  if (!record.visible) return "Firma invisible"
  return `Visible en página ${formatPages(record.pages)}`
}

function reasonNote(record: SignatureRecord) {
  if (!record.reason) return null
  return `Motivo: ${record.reason}`
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
        <SoftCardListItem
          key={record.id}
          title={record.certificateHolder}
          description={
            <>
              {formatDateTime(record.signedAt, {
                includeYear: true,
                includeSeconds: true,
              })}{" "}
              · v{record.versionNumber} · {placementLabel(record)}
            </>
          }
          note={reasonNote(record)}
        />
      ))}
    </SoftCardList>
  )
}
