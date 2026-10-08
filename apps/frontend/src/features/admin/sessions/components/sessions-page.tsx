import { SessionsContent } from "@/features/admin/sessions/components/sessions-content"
import { QueryProvider } from "@/providers/query-provider"

export function SessionsPage() {
  return (
    <QueryProvider>
      <SessionsContent />
    </QueryProvider>
  )
}
