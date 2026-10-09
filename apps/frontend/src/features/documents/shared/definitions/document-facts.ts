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
 *  hairline for the neutral state). `embeddedSignatures` counts the
 *  signatures found in the PDF itself, when the page has checked them: a PDF
 *  uploaded already signed has none made in Garabato but is still signed. */
export function documentSigningStatus(
  document: Pick<DocumentSummary, "signatureCount">,
  embeddedSignatures = 0
): { tone: StatusDotTone; label: string } {
  if (document.signatureCount > 0) {
    return { tone: "foreground", label: documentLabels.signed }
  }
  if (embeddedSignatures > 0) {
    return { tone: "foreground", label: documentLabels.signedElsewhere }
  }
  return { tone: "border", label: documentLabels.unsigned }
}
