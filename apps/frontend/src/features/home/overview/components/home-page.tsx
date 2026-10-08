import { PageShell } from "@/components/shared/layout/page-shell"
import {
  HomeContent,
  type HomePageProps,
} from "@/features/home/overview/components/home-content"

export function HomePage(props: HomePageProps) {
  return (
    <PageShell maxWidth="full" className="lg:w-4/5">
      <HomeContent {...props} />
    </PageShell>
  )
}
