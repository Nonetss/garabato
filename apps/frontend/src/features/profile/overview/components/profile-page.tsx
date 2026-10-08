import { PageShell } from "@/components/shared/layout/page-shell"
import {
  ProfileContent,
  type ProfilePageProps,
} from "@/features/profile/overview/components/profile-content"
import { QueryProvider } from "@/providers/query-provider"

export function ProfilePage(props: ProfilePageProps) {
  return (
    <QueryProvider>
      <PageShell maxWidth="3xl">
        <ProfileContent {...props} />
      </PageShell>
    </QueryProvider>
  )
}
