import { CertificatesContent } from "@/features/certificates/overview/components/certificates-content"
import { QueryProvider } from "@/providers/query-provider"

export function CertificatesPage() {
  return (
    <QueryProvider>
      <CertificatesContent />
    </QueryProvider>
  )
}
