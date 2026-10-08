import { getIcon } from "@/lib/icon-registry"

const UsersRound = getIcon("admin", "teams")

import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
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
        <p className="text-muted-foreground text-sm">
          Esta organización no tiene equipos todavía.
        </p>
      ) : (
        <SoftCardList as="ul">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <UsersRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Text as="p" variant="title" className="truncate">
                  {team.name}
                </Text>
              </div>
              <Text
                variant="compact"
                tone="muted"
                className="shrink-0 tabular-nums"
              >
                {team.memberCount} miembro
                {team.memberCount === 1 ? "" : "s"}
              </Text>
            </li>
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
