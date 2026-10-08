import { CollectionDetailContent } from "@/features/collections/detail/components/collection-detail-content"
import { QueryProvider } from "@/providers/query-provider"

export function CollectionDetailPage({
  collectionId,
}: {
  collectionId: string
}) {
  return (
    <QueryProvider>
      <CollectionDetailContent collectionId={collectionId} />
    </QueryProvider>
  )
}
