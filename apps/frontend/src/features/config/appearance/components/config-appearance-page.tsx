import { ConfigAppearanceContent } from "@/features/config/appearance/components/config-appearance-content"
import { QueryProvider } from "@/providers/query-provider"

export function ConfigAppearancePage() {
  return (
    <QueryProvider>
      <ConfigAppearanceContent />
    </QueryProvider>
  )
}
