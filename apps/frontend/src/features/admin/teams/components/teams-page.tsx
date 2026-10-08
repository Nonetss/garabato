import { TeamsContent } from "@/features/admin/teams/components/teams-content"
import { QueryProvider } from "@/providers/query-provider"

export function TeamsPage() {
  return (
    <QueryProvider>
      <TeamsContent />
    </QueryProvider>
  )
}
