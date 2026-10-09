import { PageShell } from "@/components/shared/layout/page-shell"
import { HomeContent } from "@/features/home/overview/components/home-content"
import { QueryProvider } from "@/providers/query-provider"

export function HomePage() {
  return (
    <QueryProvider>
      <div className="flex flex-1 flex-col bg-desk">
        <PageShell maxWidth="7xl" className="sm:py-8">
          <HomeContent />
        </PageShell>
      </div>
    </QueryProvider>
  )
}
