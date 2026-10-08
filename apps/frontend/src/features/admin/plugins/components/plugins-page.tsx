import { PluginsContent } from "@/features/admin/plugins/components/plugins-content"
import { QueryProvider } from "@/providers/query-provider"

export function PluginsPage() {
  return (
    <QueryProvider>
      <PluginsContent />
    </QueryProvider>
  )
}
