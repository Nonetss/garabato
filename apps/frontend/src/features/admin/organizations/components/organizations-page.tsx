import { OrganizationsContent } from "@/features/admin/organizations/components/organizations-content"
import { QueryProvider } from "@/providers/query-provider"

export function OrganizationsPage() {
  return (
    <QueryProvider>
      <OrganizationsContent />
    </QueryProvider>
  )
}
