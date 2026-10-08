import { LogsContent } from "@/features/admin/logs/components/logs-content"
import { QueryProvider } from "@/providers/query-provider"

export function LogsPage() {
  return (
    <QueryProvider>
      <LogsContent />
    </QueryProvider>
  )
}
