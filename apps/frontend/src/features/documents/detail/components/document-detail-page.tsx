import { DocumentDetailContent } from "@/features/documents/detail/components/document-detail-content"
import { QueryProvider } from "@/providers/query-provider"

export function DocumentDetailPage({ documentId }: { documentId: string }) {
  return (
    <QueryProvider>
      <DocumentDetailContent documentId={documentId} />
    </QueryProvider>
  )
}
