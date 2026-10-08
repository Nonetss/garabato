import type { StatusDotTone } from "@/components/shared/data-display/status-dot"
import { documentLabels } from "@/features/documents/shared/definitions/document-labels"
import type { DocumentSummary } from "@/features/documents/shared/model/types"
import { formatFileSize } from "@/lib/format"

/** "1 página", "3 páginas". */
export function formatPageCount(count: number) {
  if (count === 1) return "1 página"
  return `${count} páginas`
}

/** "3 páginas · 412 KB": a document's facts under its name, in the library
 *  and in the detail hero. */
export function documentFacts(
  document: Pick<DocumentSummary, "pageCount" | "sizeBytes">
) {
  return `${formatPageCount(document.pageCount)} · ${formatFileSize(document.sizeBytes)}`
}

/** Signed once any signature exists; the dot follows DESIGN.md (ink for ok,
 *  hairline for the neutral state). */
export function documentSigningStatus(
  document: Pick<DocumentSummary, "signatureCount">
): { tone: StatusDotTone; label: string } {
  if (document.signatureCount === 0) {
    return { tone: "border", label: documentLabels.unsigned }
  }
  return { tone: "foreground", label: documentLabels.signed }
}
