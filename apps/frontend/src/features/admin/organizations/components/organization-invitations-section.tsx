import { getIcon } from "@/lib/icon-registry"

const Mail = getIcon("identity", "email")
const Trash2 = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { IconButton } from "@/components/shared/form/icon-button"
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
        <Text as="p" variant="meta" tone="muted">
          No hay invitaciones pendientes.
        </Text>
      ) : (
        <SoftCardList as="ul">
          {invitations.map((invitation) => (
            <SoftCardListItem
              key={invitation.id}
              density="dense"
              truncate
              title={invitation.email}
              description={
                <>
                  {roleLabel[
                    (invitation.role ?? "member") as OrganizationRole
                  ] ?? invitation.role}{" "}
                  · {statusLabel[invitation.status]}
                </>
              }
              trailing={
                <IconButton
                  label="Cancelar invitación"
                  icon={Trash2}
                  disabled={isCanceling}
                  onClick={() => onCancelClick(invitation.id)}
                />
              }
            />
          ))}
        </SoftCardList>
      )}
    </section>
  )
}
