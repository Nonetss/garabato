import { PageHero } from "@/components/shared/layout/page-hero"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { SurfaceCardGrid } from "@/components/shared/navigation/surface-card"
import type { SiteNavItem } from "@/lib/site-nav"
import { getSiteNavItems } from "@/lib/site-nav"

function HomeNavSection({
  title,
  items,
}: {
  title?: string
  items: SiteNavItem[]
}) {
  if (items.length === 0) return null

  return (
    <section className="space-y-4">
      {title ? <SectionHeading title={title} /> : null}
      <SurfaceCardGrid items={items} />
    </section>
  )
}

export type HomePageProps = { isAdmin?: boolean }

export function HomeContent({ isAdmin = false }: HomePageProps) {
  const items = getSiteNavItems(isAdmin)
  const primaryItems = items.filter((item) => item.primary === true)
  const restItems = items.filter((item) => item.primary !== true)

  return (
    <>
      <PageHero surface="home" className="mb-8" />
      <div className="space-y-8">
        <HomeNavSection items={primaryItems} />
        <HomeNavSection title="Más módulos" items={restItems} />
      </div>
    </>
  )
}
