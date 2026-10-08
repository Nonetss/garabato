import { getIcon } from "@/lib/icon-registry"

const Mail = getIcon("identity", "email")
const Trash2 = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import { Hint } from "@/components/shared/feedback/hint"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { Button } from "@/components/ui/button"
import { roleLabel } from "@/features/admin/organizations/definitions/role-options"
import type {
  OrganizationInvitation,
  OrganizationRole,
} from "@/features/admin/organizations/model/types"

const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  canceled: "Cancelada",
}

/** The organization detail sheet's "Invitaciones pendientes" section:
 *  header + invite action, empty state, or the pending-invitation list. */
export function OrganizationInvitationsSection({
  invitations,
  isCanceling,
  onInviteClick,
  onCancelClick,
}: {
  invitations: OrganizationInvitation[]
  isCanceling: boolean
  onInviteClick: () => void
  onCancelClick: (invitationId: string) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Invitaciones pendientes"
        count={invitations.length}
        action={
          <Button size="sm" variant="outline" onClick={onInviteClick}>
            <Mail className="size-4" />
            Invitar
          </Button>
        }
      />

      {invitations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay invitaciones pendientes.
        </p>
      ) : (
        <SoftCardList as="ul">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <Text as="p" variant="title" className="truncate">
                  {invitation.email}
                </Text>
                <Text as="p" variant="compact" tone="muted">
                  {roleLabel[
                    (invitation.role ?? "member") as OrganizationRole
                  ] ?? invitation.role}{" "}
                  · {statusLabel[invitation.status]}
                </Text>
              </div>
              <Hint label="Cancelar invitación">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancelar invitación"
                  disabled={isCanceling}
                  onClick={() => onCancelClick(invitation.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Hint>
            </li>
          ))}
        </SoftCardList>
      )}
    </section>
  )
}
