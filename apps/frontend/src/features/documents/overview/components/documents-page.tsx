import { DocumentsContent } from "@/features/documents/overview/components/documents-content"
import { QueryProvider } from "@/providers/query-provider"

export function DocumentsPage() {
  return (
    <QueryProvider>
      <DocumentsContent />
    </QueryProvider>
  )
}
