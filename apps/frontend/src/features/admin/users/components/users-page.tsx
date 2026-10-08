import { UsersContent } from "@/features/admin/users/components/users-content"
import { QueryProvider } from "@/providers/query-provider"

export function UsersPage() {
  return (
    <QueryProvider>
      <UsersContent />
    </QueryProvider>
  )
}
