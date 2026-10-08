import { SidebarProvider } from "@/components/ui/sidebar"
import { SectionSidebar } from "@/features/app-shell/sidebar/components/section-sidebar"

interface WithSidebarChromeProps {
  defaultOpen?: boolean
}

/**
 * Persist island: provider + section sidebar. Page content lives in a sibling
 * slot so it can fade without remounting this chrome (`client:only` would
 * otherwise flash an empty shell on every WithSidebar navigation).
 */
export function WithSidebarChrome({
  defaultOpen = true,
}: WithSidebarChromeProps) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="flex h-full min-h-0 w-auto shrink-0"
    >
      <SectionSidebar />
    </SidebarProvider>
  )
}
