import { StatusTag } from "@/components/shared/data-display/status-dot"
import { useEmbeddedSignatureCount } from "@/features/documents/detail/hooks/use-signature-validation"
import {
  type DocumentSummary,
  documentSigningStatus,
} from "@/features/documents/shared"

/**
 * The hero's signing state. It also counts the signatures embedded in the
 * current version, so a PDF uploaded already signed reads "Firmado fuera de
 * Garabato" instead of "Sin firmar".
 */
export function DocumentStatusTag({
  document,
  versionId,
}: {
  document: Pick<DocumentSummary, "id" | "signatureCount">
  versionId: string
}) {
  const embeddedSignatures = useEmbeddedSignatureCount(document.id, versionId)
  const status = documentSigningStatus(document, embeddedSignatures)
  return <StatusTag dotTone={status.tone}>{status.label}</StatusTag>
}
