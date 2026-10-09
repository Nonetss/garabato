import { SignaturesContent } from "@/features/signatures/overview/components/signatures-content"
import { QueryProvider } from "@/providers/query-provider"

export function SignaturesPage() {
  return (
    <QueryProvider>
      <SignaturesContent />
    </QueryProvider>
  )
}
