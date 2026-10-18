import { BrowserTokenContent } from "@/features/admin/browser-token/components/browser-token-content"
import { QueryProvider } from "@/providers/query-provider"

export function BrowserTokenPage() {
  return (
    <QueryProvider>
      <BrowserTokenContent />
    </QueryProvider>
  )
}
