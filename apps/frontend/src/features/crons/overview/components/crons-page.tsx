import { CronsContent } from "@/features/crons/overview/components/crons-content"
import { QueryProvider } from "@/providers/query-provider"

export function CronsPage() {
  return (
    <QueryProvider>
      <CronsContent />
    </QueryProvider>
  )
}
