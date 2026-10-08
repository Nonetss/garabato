import { PageHero } from "@/components/shared/layout/page-hero"
import { PageShell } from "@/components/shared/layout/page-shell"
import { SurfaceCardGrid } from "@/components/shared/navigation/surface-card"
import { getAppSurfaceByPath } from "@/lib/app-surfaces"
import { getSiteNavItemByHref } from "@/lib/site-nav"

interface SectionNavOverviewProps {
  /** Section href in `siteNavItems` (e.g. "/snmp"). Drives hero + cards. */
  section: string
}

/**
 * Landing page for any `siteNavItems` section that declares `subItems`:
 * section hero plus one card per subroute, all read from `site-nav.ts`.
 */
export function SectionNavOverview({ section }: SectionNavOverviewProps) {
  const item = getSiteNavItemByHref(section)
  const surface = getAppSurfaceByPath(section)
  if (!item?.subItems || !surface) return null

  return (
    <PageShell maxWidth="80%">
      <PageHero surface={surface.id} className="mb-8" />
      <SurfaceCardGrid items={item.subItems} />
    </PageShell>
  )
}
