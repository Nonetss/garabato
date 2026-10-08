import { getIcon } from "@/lib/icon-registry"

const UsersRound = getIcon("admin", "teams")

import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { AppLink } from "@/components/ui/app-link"
import type { OrganizationDetail } from "@/features/admin/organizations/model/types"

/** The organization detail sheet's "Equipos" section: read-only summary
 *  with a link to the full Teams section for management. */
export function OrganizationTeamsSection({
  teams,
}: {
  teams: OrganizationDetail["teams"]
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title="Equipos" count={teams.length} />
      {teams.length === 0 ? (
        <Text as="p" variant="meta" tone="muted">
          Esta organización no tiene equipos todavía.
        </Text>
      ) : (
        <SoftCardList as="ul">
          {teams.map((team) => (
            <SoftCardListItem
              key={team.id}
              density="dense"
              truncate
              leading={
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <UsersRound className="size-4" />
                </span>
              }
              title={team.name}
              trailing={
                <Text variant="compact" tone="muted" className="tabular-nums">
                  {team.memberCount} miembro
                  {team.memberCount === 1 ? "" : "s"}
                </Text>
              }
            />
          ))}
        </SoftCardList>
      )}
      <Text as="p" variant="compact" tone="muted">
        Gestiona los equipos desde la sección{" "}
        <AppLink href="/admin/teams" className="underline underline-offset-4">
          Equipos
        </AppLink>
        .
      </Text>
    </section>
  )
}
