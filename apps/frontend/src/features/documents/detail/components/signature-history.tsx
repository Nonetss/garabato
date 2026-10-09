import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { useEmbeddedSignatureCount } from "@/features/documents/detail/hooks/use-signature-validation"
import { emptyHistoryMessage } from "@/features/documents/detail/model/signature-validation"
import {
  type SignatureRecord,
  timestampLine,
} from "@/features/documents/shared"
import { formatDateTime, formatPages } from "@/lib/format"

function placementLabel(record: SignatureRecord) {
  if (!record.visible) return "Firma invisible"
  return `Visible en página ${formatPages(record.pages)}`
}

function reasonLine(record: SignatureRecord) {
  if (!record.reason) return null
  return `Motivo: ${record.reason}`
}

/** The timestamp and the reason, one per line; null when neither is set. */
function signatureNote(record: SignatureRecord) {
  const lines = [timestampLine(record), reasonLine(record)].filter(
    (line) => line !== null
  )
  if (lines.length === 0) return null
  return lines.map((line) => (
    <span key={line} className="block">
      {line}
    </span>
  ))
}

/** The document's signature records made in Garabato, newest first. */
export function SignatureHistory({
  records,
  documentId,
  versionId,
}: {
  records: SignatureRecord[]
  documentId: string
  /** The current version, whose embedded signatures the empty state counts. */
  versionId: string
}) {
  const embeddedSignatures = useEmbeddedSignatureCount(documentId, versionId)
  if (records.length === 0) {
    return (
      <Text as="p" variant="meta" tone="muted">
        {emptyHistoryMessage(embeddedSignatures)}
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
          note={signatureNote(record)}
        />
      ))}
    </SoftCardList>
  )
}
