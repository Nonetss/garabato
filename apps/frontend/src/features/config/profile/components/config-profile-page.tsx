import { ConfigProfileContent } from "@/features/config/profile/components/config-profile-content"
import { QueryProvider } from "@/providers/query-provider"

export function ConfigProfilePage() {
  return (
    <QueryProvider>
      <ConfigProfileContent />
    </QueryProvider>
  )
}
