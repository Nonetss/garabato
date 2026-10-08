import { ApiKeysContent } from "@/features/admin/api-keys/components/api-keys-content"
import { QueryProvider } from "@/providers/query-provider"

export function ApiKeysPage() {
  return (
    <QueryProvider>
      <ApiKeysContent />
    </QueryProvider>
  )
}
