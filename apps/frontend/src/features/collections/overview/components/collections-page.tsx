import { CollectionsContent } from "@/features/collections/overview/components/collections-content"
import { QueryProvider } from "@/providers/query-provider"

export function CollectionsPage() {
  return (
    <QueryProvider>
      <CollectionsContent />
    </QueryProvider>
  )
}
